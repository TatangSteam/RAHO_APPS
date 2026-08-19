import {
  AuditAction,
  BranchType,
  HomecareBagRequestStatus,
  HomecareTeamMemberRole,
  LogisticLocationType,
  LogisticTransactionType,
  Role,
  Prisma,
  ProductCategory,
  ShipmentStatus,
  StockMutationType,
  StockRequestStatus,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../utils/auditLog';
import {
  bagStockReceiverRoles,
  branchStockReceiverRoles,
  canReviewBagStockRequest,
  canRequestBagStock,
  centralStockManagerRoles,
  centralStockVisibleRoles,
  logisticStaffRoles,
  stockShipmentRoles,
} from './logistics.access';
import { getHomecareTeamReadiness, homecareRoleForStaffRole } from './homecare-team.policy';
import { dispatchInternalTransfer, receiveInternalTransfer } from './services/internal-transfer-posting.service';
import type {
  AddHomecareTeamMemberInput,
  ApproveBagStockRequestInput,
  ApproveStockRequestInput,
  AssignHomecareBagInput,
  CreateBagOpnameInput,
  CreateBagStockRequestInput,
  CreateBranchStockRequestInput,
  CreateHomecareBagInput,
  CreateHomecareTeamInput,
  UpdateHomecareTeamInput,
  UpdateHomecareBagInput,
  ReceiveShipmentInput,
  RejectStockRequestInput,
  RemoveHomecareTeamMemberInput,
  ReturnBagStockInput,
  ShipStockInput,
  UseBagStockInput,
} from './logistics.schema';

type LogisticsActor = {
  userId: string;
  role: Role;
  branchId?: string | null;
};

type MovementChange = {
  masterProductId: string;
  quantity: number;
  sourceStockBefore?: number;
  sourceStockAfter?: number;
  destinationStockBefore?: number;
  destinationStockAfter?: number;
  notes?: string | null;
};

type HomecareUsageHistoryQuery = {
  branchId?: string;
  teamId?: string;
  bagId?: string;
  masterProductId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string | number;
  limit?: string | number;
};

type BranchStockRequestResponse = Prisma.StockRequestGetPayload<{
  include: { branch: true; items: { include: { masterProduct: true } } };
}>;
type BranchShipmentResponse = Prisma.ShipmentGetPayload<{
  include: {
    fromBranch: true;
    toBranch: true;
    items: { include: { masterProduct: true } };
  };
}> & {
  discrepancies?: Prisma.ShipmentDiscrepancyGetPayload<object>[];
  internalTransfer?: Prisma.InternalTransferLedgerGetPayload<object> | null;
};
type BagRequestResponse = Prisma.HomecareBagStockRequestGetPayload<{
  include: { team: true; bag: true; items: true };
}>;
type BagShipmentResponse = Prisma.HomecareBagShipmentGetPayload<{
  include: { bag: true; items: true };
}>;
type BagUsageResponse = Prisma.HomecareBagUsageGetPayload<{
  include: { bag: { include: { team: true } }; items: true };
}>;
type BagReturnResponse = Prisma.HomecareBagReturnGetPayload<{
  include: { bag: { include: { team: true } }; items: true };
}>;
type BagOpnameResponse = Prisma.HomecareBagOpnameGetPayload<{
  include: { bag: { include: { team: true } }; items: true };
}>;

export class LogisticsService {
  // ============================================================
  // Shared helpers
  // ============================================================

  private assertAuthenticated(actor: LogisticsActor) {
    if (!actor?.userId) {
      throw {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'User tidak terautentikasi',
      };
    }
  }

  private assertRole(actor: LogisticsActor, allowed: Role[], message: string) {
    this.assertAuthenticated(actor);
    if (!allowed.includes(actor.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message,
      };
    }
  }

  private requireNotes(notes?: string | null, message = 'Keterangan wajib diisi') {
    const trimmed = notes?.trim();
    if (!trimmed) {
      throw {
        status: 400,
        code: 'NOTES_REQUIRED',
        message,
      };
    }
    return trimmed;
  }

  private assertPositiveQuantity(quantity: number, field = 'quantity') {
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      throw {
        status: 400,
        code: 'INVALID_QUANTITY',
        message: `${field} harus lebih dari 0`,
      };
    }
  }

  private uniqueCode(prefix: string) {
    return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().slice(0, 8).toUpperCase()}`;
  }

  private async nextRequestCode(
    prefix: string,
    findLastCode: (codePrefix: string) => Promise<string | null | undefined>,
    scope?: string,
  ) {
    const day = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const codePrefix = scope ? `${prefix}-${scope}-${day}` : `${prefix}-${day}`;
    const lastCode = await findLastCode(codePrefix);
    const lastSeq = lastCode ? Number(lastCode.split('-').pop()) : 0;
    return `${codePrefix}-${String(lastSeq + 1).padStart(3, '0')}`;
  }

  private async getCentralBranch(client = prisma) {
    const branch = await client.branch.findFirst({
      where: {
        type: BranchType.PUSAT,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!branch) {
      throw {
        status: 422,
        code: 'CENTRAL_BRANCH_NOT_FOUND',
        message: 'Branch pusat belum tersedia. Buat Branch dengan type PUSAT terlebih dahulu.',
      };
    }

    return branch;
  }

  private async assertManagerBranchAccess(actor: LogisticsActor, branchId: string) {
    if (actor.role !== Role.ADMIN_MANAGER) return;

    const managerBranch = await prisma.managerBranch.findFirst({
      where: { userId: actor.userId, branchId },
      select: { id: true },
    });

    if (!managerBranch) {
      throw {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Anda hanya dapat memproses cabang yang Anda kelola',
      };
    }
  }

  private async assertBranchReceiverAccess(actor: LogisticsActor, branchId: string) {
    this.assertRole(
      actor,
      Array.from(branchStockReceiverRoles),
      'Anda tidak memiliki akses untuk menerima pengiriman cabang',
    );

    if (actor.role === Role.ADMIN_CABANG && actor.branchId !== branchId) {
      throw {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
        message: 'Admin Cabang hanya dapat menerima barang untuk cabangnya sendiri',
      };
    }

    await this.assertManagerBranchAccess(actor, branchId);
  }

  private async assertBagTeamMember(userId: string, teamId: string, roles?: HomecareTeamMemberRole[]) {
    const member = await prisma.homecareTeamMember.findFirst({
      where: {
        userId,
        teamId,
        isActive: true,
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
      select: { id: true },
    });

    if (!member) {
      throw {
        status: 403,
        code: 'BAG_TEAM_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses aktif ke tim/tas homecare ini',
      };
    }
  }

  private async assertBagAccess(actor: LogisticsActor, bagId: string, options: { requireAdminLayanan?: boolean } = {}) {
    if (centralStockManagerRoles.has(actor.role)) {
      return;
    }

    const bag = await prisma.homecareBag.findUnique({
      where: { id: bagId },
      select: { teamId: true },
    });

    if (!bag) {
      throw {
        status: 404,
        code: 'BAG_NOT_FOUND',
        message: 'Tas homecare tidak ditemukan',
      };
    }

    const roles = options.requireAdminLayanan ? [HomecareTeamMemberRole.ADMIN_LAYANAN] : undefined;
    await this.assertBagTeamMember(actor.userId, bag.teamId, roles);
  }

  private async validateHomecareTeamMember(
    userId: string,
    requestedRole: HomecareTeamMemberRole,
    branchId: string,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffBranches: {
          where: { branchId },
          select: { id: true },
        },
      },
    });
    if (!user || !user.isActive) {
      throw { status: 422, code: 'HOMECARE_STAFF_INACTIVE', message: 'Staff homecare tidak ditemukan atau tidak aktif' };
    }

    const allowedTeamRole = homecareRoleForStaffRole(user.role);
    if (!allowedTeamRole || allowedTeamRole !== requestedRole) {
      throw {
        status: 422,
        code: 'HOMECARE_STAFF_ROLE_MISMATCH',
        message: `Peran tim tidak sesuai dengan role akun staff ${user.email}`,
      };
    }
    if (user.branchId !== branchId && user.staffBranches.length === 0) {
      throw {
        status: 422,
        code: 'HOMECARE_STAFF_BRANCH_MISMATCH',
        message: `Staff ${user.email} tidak ditugaskan pada cabang tim homecare`,
      };
    }

    return user;
  }

  private async assertHomecareTeamOperational(teamId: string) {
    const team = await prisma.homecareTeam.findUnique({
      where: { id: teamId },
      include: { members: { where: { isActive: true }, select: { role: true, isActive: true } } },
    });
    if (!team || !team.isActive) {
      throw { status: 404, code: 'TEAM_NOT_FOUND', message: 'Tim homecare tidak ditemukan atau tidak aktif' };
    }

    const readiness = getHomecareTeamReadiness(team.members);
    if (!readiness.isOperational) {
      throw {
        status: 422,
        code: 'HOMECARE_TEAM_INCOMPLETE',
        message: `Tim homecare belum operasional. Lengkapi: ${readiness.missingRoles.join(' dan ')}.`,
      };
    }
    return team;
  }

  private async validateProducts(productIds: string[]) {
    const uniqueIds = Array.from(new Set(productIds));
    const products = await prisma.masterProduct.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
        kitComponents: { none: {} },
      },
      select: { id: true },
    });

    if (products.length !== uniqueIds.length) {
      throw {
        status: 404,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Beberapa produk tidak ditemukan, tidak aktif, atau merupakan kit virtual',
      };
    }
  }

  private async decrementInventoryStock(
    tx: Prisma.TransactionClient,
    params: {
      branchId: string;
      masterProductId: string;
      quantity: number;
      userId: string;
      referenceType: string;
      referenceId: string;
      notes: string;
      locationType: LogisticLocationType;
      allowNegativeStock?: boolean;
    },
  ): Promise<MovementChange> {
    this.assertPositiveQuantity(params.quantity);

    const item = await tx.inventoryItem.findFirst({
      where: {
        branchId: params.branchId,
        masterProductId: params.masterProductId,
      },
      include: { masterProduct: true },
    });

    if (!item) {
      throw {
        status: 422,
        code: 'SOURCE_STOCK_NOT_FOUND',
        message: 'Stok sumber tidak ditemukan untuk produk yang diminta',
      };
    }

    const stockBefore = Number(item.stock);
    const stockAfter = stockBefore - Number(params.quantity);

    if (stockAfter < 0 && !params.allowNegativeStock) {
      throw {
        status: 422,
        code: 'INSUFFICIENT_STOCK',
        message: `Stok ${item.masterProduct.name} tidak mencukupi`,
      };
    }

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { stock: stockAfter },
    });

    await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id,
        type: StockMutationType.USED,
        quantity: params.quantity,
        stockBefore,
        stockAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
        createdBy: params.userId,
      },
    });

    await tx.logisticStockMutation.create({
      data: {
        mutationCode: this.uniqueCode('LGM'),
        locationType: params.locationType,
        locationId: params.branchId,
        masterProductId: params.masterProductId,
        type: LogisticTransactionType.STOCK_OUT,
        quantity: params.quantity,
        stockBefore,
        stockAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
        createdBy: params.userId,
      },
    });

    return {
      masterProductId: params.masterProductId,
      quantity: Number(params.quantity),
      sourceStockBefore: stockBefore,
      sourceStockAfter: stockAfter,
      notes: params.notes,
    };
  }

  private async incrementBranchInventoryStock(
    tx: Prisma.TransactionClient,
    params: {
      branchId: string;
      masterProductId: string;
      quantity: number;
      userId: string;
      referenceType: string;
      referenceId: string;
      notes: string;
    },
  ): Promise<MovementChange> {
    this.assertPositiveQuantity(params.quantity);

    let item = await tx.inventoryItem.findFirst({
      where: {
        branchId: params.branchId,
        masterProductId: params.masterProductId,
      },
    });

    if (!item) {
      item = await tx.inventoryItem.create({
        data: {
          branchId: params.branchId,
          masterProductId: params.masterProductId,
          stock: 0,
          minThreshold: 0,
        },
      });
    }

    const stockBefore = Number(item.stock);
    const stockAfter = stockBefore + Number(params.quantity);

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { stock: stockAfter },
    });

    await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id,
        type: StockMutationType.RECEIVED,
        quantity: params.quantity,
        stockBefore,
        stockAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
        createdBy: params.userId,
      },
    });

    await tx.logisticStockMutation.create({
      data: {
        mutationCode: this.uniqueCode('LGM'),
        locationType: LogisticLocationType.BRANCH_STOCK,
        locationId: params.branchId,
        masterProductId: params.masterProductId,
        type: LogisticTransactionType.STOCK_IN,
        quantity: params.quantity,
        stockBefore,
        stockAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
        createdBy: params.userId,
      },
    });

    return {
      masterProductId: params.masterProductId,
      quantity: Number(params.quantity),
      destinationStockBefore: stockBefore,
      destinationStockAfter: stockAfter,
      notes: params.notes,
    };
  }

  private async changeBagStock(
    tx: Prisma.TransactionClient,
    params: {
      bagId: string;
      masterProductId: string;
      quantity: number;
      direction: 'IN' | 'OUT' | 'SET';
      userId: string;
      referenceType: string;
      referenceId: string;
      notes: string;
      allowNegativeStock?: boolean;
    },
  ): Promise<MovementChange> {
    let stock = await tx.homecareBagStock.findUnique({
      where: {
        bagId_masterProductId: {
          bagId: params.bagId,
          masterProductId: params.masterProductId,
        },
      },
    });

    if (!stock) {
      stock = await tx.homecareBagStock.create({
        data: {
          bagId: params.bagId,
          masterProductId: params.masterProductId,
          stock: 0,
          minThreshold: 0,
        },
      });
    }

    const stockBefore = Number(stock.stock);
    const stockAfter = params.direction === 'SET'
      ? Number(params.quantity)
      : params.direction === 'IN'
        ? stockBefore + Number(params.quantity)
        : stockBefore - Number(params.quantity);

    if (stockAfter < 0 && !params.allowNegativeStock) {
      throw {
        status: 422,
        code: 'INSUFFICIENT_BAG_STOCK',
        message: 'Stok tas tidak mencukupi',
      };
    }

    const mutationType = params.direction === 'IN'
      ? LogisticTransactionType.STOCK_IN
      : params.direction === 'OUT'
        ? LogisticTransactionType.STOCK_OUT
        : LogisticTransactionType.ADJUSTMENT;

    await tx.homecareBagStock.update({
      where: { id: stock.id },
      data: { stock: stockAfter },
    });

    await tx.logisticStockMutation.create({
      data: {
        mutationCode: this.uniqueCode('LGM'),
        locationType: LogisticLocationType.HOMECARE_BAG,
        locationId: params.bagId,
        homecareBagId: params.bagId,
        masterProductId: params.masterProductId,
        type: mutationType,
        quantity: params.direction === 'SET' ? Math.abs(stockAfter - stockBefore) : params.quantity,
        stockBefore,
        stockAfter,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        notes: params.notes,
        createdBy: params.userId,
      },
    });

    return {
      masterProductId: params.masterProductId,
      quantity: params.direction === 'SET' ? Math.abs(stockAfter - stockBefore) : Number(params.quantity),
      sourceStockBefore: params.direction === 'OUT' ? stockBefore : undefined,
      sourceStockAfter: params.direction === 'OUT' ? stockAfter : undefined,
      destinationStockBefore: params.direction !== 'OUT' ? stockBefore : undefined,
      destinationStockAfter: params.direction !== 'OUT' ? stockAfter : undefined,
      notes: params.notes,
    };
  }

  private async createLogisticTransaction(
    tx: Prisma.TransactionClient,
    params: {
      type: LogisticTransactionType;
      sourceType?: LogisticLocationType;
      sourceId?: string;
      destinationType?: LogisticLocationType;
      destinationId?: string;
      referenceType?: string;
      referenceId?: string;
      reason?: string;
      notes: string;
      createdBy: string;
      supportFileUrl?: string;
      supportFileName?: string;
      supportFileSize?: number;
      supportFileMimeType?: string;
      changes: MovementChange[];
    },
  ) {
    return tx.logisticStockTransaction.create({
      data: {
        transactionCode: this.uniqueCode('LGT'),
        type: params.type,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        destinationType: params.destinationType,
        destinationId: params.destinationId,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        reason: params.reason,
        notes: params.notes,
        supportFileUrl: params.supportFileUrl,
        supportFileName: params.supportFileName,
        supportFileSize: params.supportFileSize,
        supportFileMimeType: params.supportFileMimeType,
        createdBy: params.createdBy,
        items: {
          create: params.changes.map((change) => ({
            masterProductId: change.masterProductId,
            quantity: change.quantity,
            sourceStockBefore: change.sourceStockBefore,
            sourceStockAfter: change.sourceStockAfter,
            destinationStockBefore: change.destinationStockBefore,
            destinationStockAfter: change.destinationStockAfter,
            notes: change.notes,
          })),
        },
      },
    });
  }

  // ============================================================
  // Central stock
  // ============================================================

  async getCentralStock(actor: LogisticsActor, query: { search?: string; category?: string; includeInactive?: boolean } = {}) {
    this.assertAuthenticated(actor);
    if (actor.role === Role.MEMBER) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Member tidak memiliki akses logistik',
      };
    }

    const central = await this.getCentralBranch();
    const showQty = centralStockVisibleRoles.has(actor.role);
    const products = await prisma.masterProduct.findMany({
      where: {
        kitComponents: { none: {} },
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.category ? { category: query.category as ProductCategory } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        inventoryItems: {
          where: { branchId: central.id },
          select: { stock: true, minThreshold: true, storageLocation: true },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return {
      centralBranch: showQty
        ? { id: central.id, branchCode: central.branchCode, name: central.name }
        : undefined,
      products: products.map((product) => {
        const centralStock = product.inventoryItems[0];
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          baseUnit: product.baseUnit,
          usageUnit: product.usageUnit,
          conversionFactor: Number(product.conversionFactor),
          isActive: product.isActive,
          ...(showQty
            ? {
                centralStockQty: centralStock ? Number(centralStock.stock) : 0,
                minThreshold: centralStock ? Number(centralStock.minThreshold) : 0,
                storageLocation: centralStock?.storageLocation || null,
              }
            : {}),
        };
      }),
    };
  }

  async listHomecareBranches(actor: LogisticsActor) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses logistik homecare');

    if (centralStockManagerRoles.has(actor.role)) {
      const branches = await prisma.branch.findMany({
        where: { isActive: true },
        orderBy: [{ type: 'desc' }, { name: 'asc' }],
      });

      return branches.map((branch) => ({
        id: branch.id,
        branchCode: branch.branchCode,
        name: branch.name,
        type: branch.type,
      }));
    }

    const branchIds = new Set<string>();
    if (actor.branchId) branchIds.add(actor.branchId);

    const teamMemberships = await prisma.homecareTeamMember.findMany({
      where: { userId: actor.userId, isActive: true },
      include: { team: true },
    });
    teamMemberships.forEach((membership) => branchIds.add(membership.team.branchId));

    const branches = await prisma.branch.findMany({
      where: { id: { in: Array.from(branchIds) }, isActive: true },
      orderBy: [{ type: 'desc' }, { name: 'asc' }],
    });

    return branches.map((branch) => ({
      id: branch.id,
      branchCode: branch.branchCode,
      name: branch.name,
      type: branch.type,
    }));
  }

  async listHomecareStaff(actor: LogisticsActor, query: { branchId?: string; search?: string } = {}) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses melihat staff homecare');

    if (query.branchId) {
      await this.assertManagerBranchAccess(actor, query.branchId);
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_LAYANAN, Role.DOCTOR, Role.NURSE] },
        ...(query.branchId
          ? {
              OR: [
                { branchId: query.branchId },
                { staffBranches: { some: { branchId: query.branchId } } },
              ],
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' } },
                { staffCode: { contains: query.search, mode: 'insensitive' } },
                { profile: { fullName: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        staffCode: true,
        branchId: true,
        profile: { select: { fullName: true, phone: true } },
        branch: { select: { id: true, branchCode: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return users.map((user) => ({
      userId: user.id,
      email: user.email,
      role: user.role,
      staffCode: user.staffCode,
      fullName: user.profile?.fullName || user.email,
      phone: user.profile?.phone || null,
      branchId: user.branchId,
      branchName: user.branch?.name || null,
      branchCode: user.branch?.branchCode || null,
    }));
  }

  async listHomecareTeams(actor: LogisticsActor, query: { branchId?: string; search?: string; includeInactive?: boolean } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat tim homecare');

    if (query.branchId) {
      await this.assertManagerBranchAccess(actor, query.branchId);
    }

    const where = {
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { teamCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    } as Prisma.HomecareTeamWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.members = { some: { userId: actor.userId, isActive: true } };
    }

    const teams = await prisma.homecareTeam.findMany({
      where,
      include: {
        members: { where: { isActive: true }, orderBy: { joinedAt: 'desc' } },
        bags: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const branches = await prisma.branch.findMany({
      where: { id: { in: Array.from(new Set(teams.map((team) => team.branchId))) } },
      select: { id: true, branchCode: true, name: true, type: true },
    });
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));

    const userIds = Array.from(new Set(teams.flatMap((team) => team.members.map((member) => member.userId))));
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, role: true, staffCode: true, email: true, profile: { select: { fullName: true } } },
        })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    return teams.map((team) => {
      const branch = branchMap.get(team.branchId);
      const readiness = getHomecareTeamReadiness(team.members);
      return {
        id: team.id,
        teamCode: team.teamCode,
        name: team.name,
        branchId: team.branchId,
        branchName: branch?.name || null,
        branchCode: branch?.branchCode || null,
        branchType: branch?.type || null,
        description: team.description,
        isActive: team.isActive,
        memberCount: team.members.length,
        bagCount: team.bags.length,
        ...readiness,
        members: team.members.map((member) => {
          const user = userMap.get(member.userId);
          return {
            id: member.id,
            userId: member.userId,
            role: member.role,
            notes: member.notes,
            joinedAt: member.joinedAt?.toISOString?.(),
            fullName: user?.profile?.fullName || user?.email || member.userId,
            staffCode: user?.staffCode || null,
            userRole: user?.role || null,
          };
        }),
        bags: team.bags.map((bag) => ({
          id: bag.id,
          bagCode: bag.bagCode,
          name: bag.name,
          status: bag.status,
        })),
        createdAt: team.createdAt?.toISOString?.(),
        updatedAt: team.updatedAt?.toISOString?.(),
      };
    });
  }

  async updateHomecareTeam(actor: LogisticsActor, teamId: string, input: UpdateHomecareTeamInput) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses mengubah tim homecare');
    const team = await prisma.homecareTeam.findUnique({ where: { id: teamId } });
    if (!team) throw { status: 404, code: 'TEAM_NOT_FOUND', message: 'Tim homecare tidak ditemukan' };
    await this.assertManagerBranchAccess(actor, team.branchId);

    const updated = await prisma.homecareTeam.update({
      where: { id: teamId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await logAudit({
      userId: actor.userId,
      branchId: team.branchId,
      action: AuditAction.UPDATE,
      resource: 'HomecareTeam',
      resourceId: teamId,
      meta: {
        action: 'UPDATE_HOMECARE_TEAM',
        before: { name: team.name, description: team.description, isActive: team.isActive },
        after: { name: updated.name, description: updated.description, isActive: updated.isActive },
      },
    });
    return updated;
  }

  async listHomecareBags(actor: LogisticsActor, query: { teamId?: string; branchId?: string; status?: string; search?: string } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat tas homecare');

    if (query.branchId) {
      await this.assertManagerBranchAccess(actor, query.branchId);
    }

    const where = {
      isActive: true,
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { bagCode: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    } as Prisma.HomecareBagWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.team = { members: { some: { userId: actor.userId, isActive: true } } };
    }

    const bags = await prisma.homecareBag.findMany({
      where,
      include: {
        team: true,
        stocks: true,
        stockRequests: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const branches = await prisma.branch.findMany({
      where: { id: { in: Array.from(new Set(bags.map((bag) => bag.branchId))) } },
      select: { id: true, branchCode: true, name: true, type: true },
    });
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));

    return bags.map((bag) => {
      const branch = branchMap.get(bag.branchId);
      return {
        id: bag.id,
        bagCode: bag.bagCode,
        name: bag.name,
        teamId: bag.teamId,
        teamCode: bag.team?.teamCode,
        teamName: bag.team?.name,
        branchId: bag.branchId,
        branchName: branch?.name || null,
        branchCode: branch?.branchCode || null,
        branchType: branch?.type || null,
        status: bag.status,
        notes: bag.notes,
        stockCount: bag.stocks.length,
        lowStockCount: bag.stocks.filter((stock) => Number(stock.stock) <= Number(stock.minThreshold)).length,
        totalStockQty: bag.stocks.reduce((sum, stock) => sum + Number(stock.stock), 0),
        recentRequests: bag.stockRequests.map((request) => ({
          id: request.id,
          requestCode: request.requestCode,
          status: request.status,
          createdAt: request.createdAt?.toISOString?.(),
        })),
        createdAt: bag.createdAt?.toISOString?.(),
        updatedAt: bag.updatedAt?.toISOString?.(),
      };
    });
  }

  async updateHomecareBag(actor: LogisticsActor, bagId: string, input: UpdateHomecareBagInput) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses mengubah tas homecare');
    const bag = await prisma.homecareBag.findUnique({ where: { id: bagId } });
    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };
    await this.assertManagerBranchAccess(actor, bag.branchId);

    const updated = await prisma.homecareBag.update({
      where: { id: bagId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await logAudit({
      userId: actor.userId,
      branchId: bag.branchId,
      action: AuditAction.UPDATE,
      resource: 'HomecareBag',
      resourceId: bagId,
      meta: {
        action: 'UPDATE_HOMECARE_BAG',
        before: { name: bag.name, status: bag.status, notes: bag.notes, isActive: bag.isActive },
        after: { name: updated.name, status: updated.status, notes: updated.notes, isActive: updated.isActive },
      },
    });
    return updated;
  }

  async listHomecareBagRequests(actor: LogisticsActor, query: { status?: string; teamId?: string; bagId?: string } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat request stok tas');

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.bagId ? { bagId: query.bagId } : {}),
    } as Prisma.HomecareBagStockRequestWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.bag = { team: { members: { some: { userId: actor.userId, isActive: true } } } };
    }

    const requests = await prisma.homecareBagStockRequest.findMany({
      where,
      include: { team: true, bag: true, items: true, shipment: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return requests.map((request) => ({
      ...this.formatBagRequest(request),
      shipment: request.shipment
        ? { id: request.shipment.id, shipmentCode: request.shipment.shipmentCode, status: request.shipment.status }
        : null,
    }));
  }

  async listHomecareBagShipments(actor: LogisticsActor, query: { status?: string; bagId?: string } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat shipment tas');

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.bagId ? { toBagId: query.bagId } : {}),
    } as Prisma.HomecareBagShipmentWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.bag = { team: { members: { some: { userId: actor.userId, isActive: true } } } };
    }

    const shipments = await prisma.homecareBagShipment.findMany({
      where,
      include: { bag: true, request: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return shipments.map((shipment) => this.formatBagShipment(shipment));
  }

  async listHomecareBagUsages(actor: LogisticsActor, query: { status?: string; bagId?: string; teamId?: string } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat pemakaian tas');

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.bagId ? { bagId: query.bagId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
    } as Prisma.HomecareBagUsageWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.bag = { team: { members: { some: { userId: actor.userId, isActive: true } } } };
    }

    const usages = await prisma.homecareBagUsage.findMany({
      where,
      include: { bag: { include: { team: true } }, items: true },
      orderBy: { usageDate: 'desc' },
      take: 100,
    });

    return usages.map((usage) => this.formatBagUsage(usage));
  }

  async getHomecareUsageHistory(actor: LogisticsActor, query: HomecareUsageHistoryQuery = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat riwayat penggunaan inventori tim');
    if (query.branchId) await this.assertManagerBranchAccess(actor, query.branchId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(5000, Math.max(1, Number(query.limit) || 25));
    const usageDate: Prisma.DateTimeFilter = {};
    if (query.startDate) usageDate.gte = new Date(`${query.startDate}T00:00:00.000+07:00`);
    if (query.endDate) usageDate.lte = new Date(`${query.endDate}T23:59:59.999+07:00`);

    const where: Prisma.HomecareBagUsageWhereInput = {
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.bagId ? { bagId: query.bagId } : {}),
      ...(query.masterProductId ? { items: { some: { masterProductId: query.masterProductId } } } : {}),
      ...(Object.keys(usageDate).length ? { usageDate } : {}),
      ...(query.search ? {
        OR: [
          { usageCode: { contains: query.search, mode: 'insensitive' } },
          { notes: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const bagWhere: Prisma.HomecareBagWhereInput = {};
    if (query.branchId) bagWhere.branchId = query.branchId;
    if (actor.role === Role.ADMIN_MANAGER) {
      const managed = await prisma.managerBranch.findMany({
        where: { userId: actor.userId },
        select: { branchId: true },
      });
      const managedIds = managed.map((item) => item.branchId);
      bagWhere.branchId = query.branchId || { in: managedIds };
    } else if (!centralStockManagerRoles.has(actor.role)) {
      bagWhere.team = { members: { some: { userId: actor.userId, isActive: true } } };
    }
    if (Object.keys(bagWhere).length) where.bag = bagWhere;

    const [usages, total] = await Promise.all([
      prisma.homecareBagUsage.findMany({
        where,
        include: { bag: { include: { team: true } }, items: true },
        orderBy: [{ usageDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.homecareBagUsage.count({ where }),
    ]);

    const productIds = Array.from(new Set(usages.flatMap((usage) => usage.items.map((item) => item.masterProductId))));
    const userIds = Array.from(new Set(usages.map((usage) => usage.usedBy)));
    const sessionIds = Array.from(new Set(usages.map((usage) => usage.treatmentSessionId).filter(Boolean))) as string[];
    const products: Array<{ id: string; sku: string; name: string; baseUnit: string }> = productIds.length ? await prisma.masterProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, baseUnit: true },
    }) : [];
    const users: Array<{ id: string; email: string; profile: { fullName: string | null } | null }> = userIds.length ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, profile: { select: { fullName: true } } },
    }) : [];
    const sessions = sessionIds.length ? await prisma.treatmentSession.findMany({
      where: { id: { in: sessionIds } },
      select: {
        id: true,
        sessionCode: true,
        encounter: { select: { member: { select: { memberNo: true, user: { select: { profile: { select: { fullName: true } } } } } } } },
      },
    }) : [];
    const branches: Array<{ id: string; branchCode: string; name: string }> = usages.length ? await prisma.branch.findMany({
      where: { id: { in: Array.from(new Set(usages.map((usage) => usage.bag.branchId))) } },
      select: { id: true, branchCode: true, name: true },
    }) : [];
    const productMap = new Map(products.map((item) => [item.id, item]));
    const userMap = new Map(users.map((item) => [item.id, item]));
    const sessionMap = new Map(sessions.map((item) => [item.id, item]));
    const branchMap = new Map(branches.map((item) => [item.id, item]));

    const items = usages.flatMap((usage) => usage.items
      .filter((item) => !query.masterProductId || item.masterProductId === query.masterProductId)
      .map((item) => {
      const product = productMap.get(item.masterProductId);
      const user = userMap.get(usage.usedBy);
      const session = usage.treatmentSessionId ? sessionMap.get(usage.treatmentSessionId) : undefined;
      const branch = branchMap.get(usage.bag.branchId);
      return {
        id: item.id,
        usageId: usage.id,
        usageCode: usage.usageCode,
        usageDate: usage.usageDate.toISOString(),
        status: usage.status,
        branchId: usage.bag.branchId,
        branchCode: branch?.branchCode || null,
        branchName: branch?.name || null,
        teamId: usage.teamId,
        teamCode: usage.bag.team.teamCode,
        teamName: usage.bag.team.name,
        bagId: usage.bagId,
        bagCode: usage.bag.bagCode,
        bagName: usage.bag.name,
        masterProductId: item.masterProductId,
        sku: product?.sku || null,
        productName: product?.name || item.masterProductId,
        quantity: Number(item.quantity),
        unit: item.unit || product?.baseUnit || null,
        treatmentSessionId: usage.treatmentSessionId,
        sessionCode: session?.sessionCode || null,
        memberNo: session?.encounter.member.memberNo || null,
        memberName: session?.encounter.member.user.profile?.fullName || null,
        usedBy: usage.usedBy,
        usedByName: user?.profile?.fullName || user?.email || usage.usedBy,
        notes: item.notes || usage.notes,
      };
      }));

    return { items, total, page, limit, usageCount: usages.length };
  }

  async exportHomecareUsageHistory(actor: LogisticsActor, query: HomecareUsageHistoryQuery = {}) {
    const history = await this.getHomecareUsageHistory(actor, { ...query, page: 1, limit: 5000 });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RAHO ERP';
    const sheet = workbook.addWorksheet('Penggunaan Inventori Tim', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Tanggal', key: 'date', width: 22 }, { header: 'Kode Penggunaan', key: 'usageCode', width: 24 },
      { header: 'Cabang', key: 'branch', width: 26 }, { header: 'Tim', key: 'team', width: 26 },
      { header: 'Tas', key: 'bag', width: 24 }, { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Produk', key: 'product', width: 34 }, { header: 'Jumlah', key: 'quantity', width: 14 },
      { header: 'Satuan', key: 'unit', width: 14 }, { header: 'Kode Sesi', key: 'session', width: 24 },
      { header: 'No. Member', key: 'memberNo', width: 18 }, { header: 'Nama Member', key: 'member', width: 28 },
      { header: 'Digunakan Oleh', key: 'usedBy', width: 28 }, { header: 'Status', key: 'status', width: 16 },
      { header: 'Catatan', key: 'notes', width: 42 },
    ];
    history.items.forEach((item) => sheet.addRow({
      date: new Date(item.usageDate), usageCode: item.usageCode, branch: item.branchName || item.branchCode || '-',
      team: `${item.teamCode} - ${item.teamName}`, bag: `${item.bagCode} - ${item.bagName}`,
      sku: item.sku || '-', product: item.productName, quantity: item.quantity, unit: item.unit || '-',
      session: item.sessionCode || '-', memberNo: item.memberNo || '-', member: item.memberName || '-',
      usedBy: item.usedByName, status: item.status, notes: item.notes,
    }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    sheet.autoFilter = { from: 'A1', to: 'O1' };
    sheet.getColumn(1).numFmt = 'dd/mm/yyyy hh:mm';
    sheet.getColumn(8).numFmt = '#,##0.0000';
    const buffer = await workbook.xlsx.writeBuffer();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
    return { buffer: Buffer.from(buffer), filename: `history-penggunaan-inventori-tim-${stamp}.xlsx` };
  }

  async listHomecareBagReturns(actor: LogisticsActor, query: { bagId?: string; teamId?: string } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat pengembalian tas');

    const where = {
      ...(query.bagId ? { bagId: query.bagId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
    } as Prisma.HomecareBagReturnWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.bag = { team: { members: { some: { userId: actor.userId, isActive: true } } } };
    }

    const returns = await prisma.homecareBagReturn.findMany({
      where,
      include: { bag: { include: { team: true } }, items: true },
      orderBy: { returnedAt: 'desc' },
      take: 100,
    });

    return returns.map((bagReturn) => this.formatBagReturn(bagReturn));
  }

  async listHomecareBagOpnames(actor: LogisticsActor, query: { status?: string; bagId?: string; teamId?: string } = {}) {
    this.assertRole(actor, logisticStaffRoles, 'Anda tidak memiliki akses melihat inspeksi tas');

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.bagId ? { bagId: query.bagId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
    } as Prisma.HomecareBagOpnameWhereInput;

    if (!centralStockManagerRoles.has(actor.role)) {
      where.bag = { team: { members: { some: { userId: actor.userId, isActive: true } } } };
    }

    const opnames = await prisma.homecareBagOpname.findMany({
      where,
      include: { bag: { include: { team: true } }, items: true },
      orderBy: { checkedAt: 'desc' },
      take: 100,
    });

    return opnames.map((opname) => this.formatBagOpname(opname));
  }

  // ============================================================
  // Branch stock requests using legacy tables
  // ============================================================

  async createBranchStockRequest(actor: LogisticsActor, input: CreateBranchStockRequestInput) {
    this.assertRole(actor, [Role.ADMIN_CABANG], 'Hanya Admin Cabang yang dapat membuat request stok cabang');
    const notes = this.requireNotes(input.notes);
    if (!actor.branchId) {
      throw {
        status: 400,
        code: 'BRANCH_ID_REQUIRED',
        message: 'Admin Cabang harus memiliki cabang',
      };
    }

    await this.validateProducts(input.items.map((item) => item.masterProductId));
    input.items.forEach((item) => this.assertPositiveQuantity(item.requestedQty, 'requestedQty'));

    const branch = await prisma.branch.findUnique({
      where: { id: actor.branchId },
      select: { branchCode: true, name: true },
    });

    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    const requestCode = await this.nextRequestCode('REQ', async (codePrefix) => (
      await prisma.stockRequest.findFirst({
        where: { requestCode: { startsWith: codePrefix } },
        orderBy: { requestCode: 'desc' },
        select: { requestCode: true },
      })
    )?.requestCode, branch.branchCode);
    const request = await prisma.$transaction(async (tx) => {
      return tx.stockRequest.create({
        data: {
          requestCode,
          branchId: actor.branchId,
          requestedBy: actor.userId,
          status: StockRequestStatus.PENDING,
          notes,
          items: {
            create: input.items.map((item) => ({
              masterProductId: item.masterProductId,
              requestedQty: item.requestedQty,
              finalQty: item.requestedQty,
              notes: item.notes?.trim() || null,
            })),
          },
        },
        include: {
          branch: true,
          items: { include: { masterProduct: true } },
        },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: actor.branchId,
      action: AuditAction.STOCK_REQUEST,
      resource: 'StockRequest',
      resourceId: request.id,
      meta: {
        action: 'CREATE_BRANCH_STOCK_REQUEST',
        requestCode,
        itemCount: input.items.length,
      },
    });

    return this.formatBranchStockRequest(request);
  }

  async approveBranchStockRequest(actor: LogisticsActor, requestId: string, input: ApproveStockRequestInput) {
    this.assertRole(
      actor,
      Array.from(centralStockManagerRoles),
      'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat approve request stok',
    );

    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        branch: true,
        items: { include: { masterProduct: true } },
        shipment: true,
      },
    });

    if (!request) {
      throw { status: 404, code: 'REQUEST_NOT_FOUND', message: 'Request stok tidak ditemukan' };
    }

    if (request.status !== StockRequestStatus.PENDING) {
      throw {
        status: 422,
        code: 'INVALID_REQUEST_STATUS',
        message: 'Request stok hanya dapat di-approve saat status PENDING',
      };
    }

    if (request.shipment) {
      throw {
        status: 422,
        code: 'SHIPMENT_ALREADY_EXISTS',
        message: 'Shipment untuk request ini sudah dibuat',
      };
    }

    await this.assertManagerBranchAccess(actor, request.branchId);

    const approvalMap = new Map((input.items || []).map((item) => [item.masterProductId, Number(item.approvedQty)]));
    const finalItems = request.items.map((item) => {
      const approvedQty = approvalMap.has(item.masterProductId)
        ? Number(approvalMap.get(item.masterProductId))
        : Number(item.finalQty ?? item.requestedQty);

      if (approvedQty < 0 || approvedQty > Number(item.requestedQty)) {
        throw {
          status: 400,
          code: 'INVALID_APPROVED_QTY',
          message: 'Jumlah approve tidak boleh negatif atau melebihi request',
        };
      }

      return {
        ...item,
        approvedQty,
        finalQty: approvedQty,
      };
    });

    const isPartial = finalItems.some((item) => item.approvedQty < Number(item.requestedQty));
    if (isPartial) {
      this.requireNotes(input.reviewNotes, 'Catatan wajib diisi untuk approve sebagian');
    }

    if (finalItems.every((item) => item.finalQty <= 0)) {
      throw {
        status: 400,
        code: 'NO_APPROVED_ITEMS',
        message: 'Minimal satu item harus disetujui',
      };
    }

    const central = await this.getCentralBranch();
    for (const item of finalItems.filter((item) => item.finalQty > 0)) {
      const centralStock = await prisma.inventoryItem.findFirst({
        where: {
          branchId: central.id,
          masterProductId: item.masterProductId,
        },
      });

      if (!centralStock || Number(centralStock.stock) < item.finalQty) {
        throw {
          status: 422,
          code: 'INSUFFICIENT_CENTRAL_STOCK',
          message: `Stok pusat tidak mencukupi untuk ${item.masterProduct.name}`,
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of finalItems) {
        await tx.stockRequestItem.update({
          where: { id: item.id },
          data: {
            approvedQty: item.approvedQty,
            finalQty: item.finalQty,
          },
        });
      }

      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: StockRequestStatus.APPROVED,
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes?.trim() || null,
        },
        include: {
          branch: true,
          items: { include: { masterProduct: true } },
        },
      });

      const shipmentCode = await this.nextRequestCode('SHP', async (codePrefix) => (
        await tx.shipment.findFirst({
          where: { shipmentCode: { startsWith: codePrefix } },
          orderBy: { shipmentCode: 'desc' },
          select: { shipmentCode: true },
        })
      )?.shipmentCode, `${central.branchCode}-${request.branch.branchCode}`);
      const shipment = await tx.shipment.create({
        data: {
          shipmentCode,
          stockRequestId: requestId,
          fromBranchId: central.id,
          toBranchId: request.branchId,
          status: ShipmentStatus.PREPARING,
          notes: input.reviewNotes?.trim() || `Pengiriman untuk request ${request.requestCode}`,
          items: {
            create: finalItems
              .filter((item) => item.finalQty > 0)
              .map((item) => ({
                masterProductId: item.masterProductId,
                sentQty: item.finalQty,
                requestedQty: item.requestedQty,
              })),
          },
        },
        include: {
          fromBranch: true,
          toBranch: true,
          items: { include: { masterProduct: true } },
        },
      });

      return { request: updatedRequest, shipment };
    });

    await logAudit({
      userId: actor.userId,
      branchId: request.branchId,
      action: AuditAction.VERIFY,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: {
        action: isPartial ? 'PARTIAL_APPROVE_BRANCH_STOCK_REQUEST' : 'APPROVE_BRANCH_STOCK_REQUEST',
        requestCode: request.requestCode,
        shipmentId: result.shipment.id,
        reviewNotes: input.reviewNotes,
      },
    });

    return {
      request: this.formatBranchStockRequest(result.request),
      shipment: this.formatBranchShipment(result.shipment),
    };
  }

  async rejectBranchStockRequest(actor: LogisticsActor, requestId: string, input: RejectStockRequestInput) {
    this.assertRole(
      actor,
      Array.from(centralStockManagerRoles),
      'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat reject request stok',
    );
    const reviewNotes = this.requireNotes(input.reviewNotes, 'Catatan penolakan wajib diisi');

    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: { branch: true, items: { include: { masterProduct: true } } },
    });

    if (!request) throw { status: 404, code: 'REQUEST_NOT_FOUND', message: 'Request stok tidak ditemukan' };
    await this.assertManagerBranchAccess(actor, request.branchId);

    const updatedRequest = await prisma.$transaction(async (tx) => {
      return tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: StockRequestStatus.REJECTED,
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          reviewNotes,
        },
        include: { branch: true, items: { include: { masterProduct: true } } },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: request.branchId,
      action: AuditAction.REJECT_PAYMENT,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { action: 'REJECT_BRANCH_STOCK_REQUEST', reason: reviewNotes },
    });

    return this.formatBranchStockRequest(updatedRequest);
  }

  async shipBranchShipment(actor: LogisticsActor, shipmentId: string, input: ShipStockInput) {
    this.assertRole(actor, Array.from(stockShipmentRoles), 'Anda tidak memiliki akses untuk mengirim barang');
    const notes = this.requireNotes(input.notes);

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        fromBranch: true,
        toBranch: true,
        stockRequest: true,
        items: { include: { masterProduct: true } },
        internalTransfer: true,
      },
    });

    if (!shipment) throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
    if (shipment.status !== ShipmentStatus.PREPARING && !(shipment.status === ShipmentStatus.SHIPPED && shipment.internalTransfer)) {
      throw { status: 422, code: 'INVALID_SHIPMENT_STATUS', message: 'Shipment hanya dapat dikirim saat PREPARING' };
    }
    if (shipment.fromBranch.type !== BranchType.PUSAT) {
      throw { status: 422, code: 'INVALID_SOURCE_BRANCH', message: 'Sumber shipment harus branch PUSAT' };
    }
    await this.assertManagerBranchAccess(actor, shipment.toBranchId);
    await this.assertManagerBranchAccess(actor, shipment.fromBranchId);

    if (shipment.status === ShipmentStatus.SHIPPED && shipment.internalTransfer) {
      return this.formatBranchShipment(shipment);
    }

    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: string; status: ShipmentStatus }>>(Prisma.sql`SELECT "id", "status" FROM "shipments" WHERE "id" = ${shipmentId} FOR UPDATE`);
      if (!locked) throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
      if (locked.status !== ShipmentStatus.PREPARING) {
        if (locked.status === ShipmentStatus.SHIPPED) {
          return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { fromBranch: true, toBranch: true, items: { include: { masterProduct: true } }, internalTransfer: true } });
        }
        throw { status: 422, code: 'INVALID_SHIPMENT_STATUS', message: 'Shipment hanya dapat dikirim saat PREPARING' };
      }
      const transfer = await dispatchInternalTransfer(tx, shipmentId, actor.userId, new Date(), notes);
      const changes: MovementChange[] = transfer.movements;

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.SHIPMENT,
        sourceType: LogisticLocationType.CENTRAL_STOCK,
        sourceId: shipment.fromBranchId,
        destinationType: LogisticLocationType.BRANCH_STOCK,
        destinationId: shipment.toBranchId,
        referenceType: 'SHIPMENT',
        referenceId: shipmentId,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.shipmentPhotoUrl,
        supportFileName: input.shipmentPhotoName,
        changes,
      });

      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: StockRequestStatus.SHIPPED,
            shippedBy: actor.userId,
            shippedAt: new Date(),
          },
        });
      }

      return tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.SHIPPED,
          shippedBy: actor.userId,
          shippedAt: new Date(),
          shipmentPhotoUrl: input.shipmentPhotoUrl,
          shipmentPhotoName: input.shipmentPhotoName,
          notes,
        },
        include: {
          fromBranch: true,
          toBranch: true,
          items: { include: { masterProduct: true } },
          internalTransfer: true,
        },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: shipment.toBranchId,
      action: AuditAction.SHIPMENT,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        action: 'SHIP_BRANCH_SHIPMENT',
        role: actor.role,
        fromBranchId: shipment.fromBranchId,
        toBranchId: shipment.toBranchId,
        items: shipment.items.map((item) => ({
          masterProductId: item.masterProductId,
          quantity: Number(item.sentQty),
        })),
        notes,
      },
    });

    return this.formatBranchShipment(result);
  }

  async receiveBranchShipment(actor: LogisticsActor, shipmentId: string, input: ReceiveShipmentInput) {
    const notes = this.requireNotes(input.notes);
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        fromBranch: true,
        toBranch: true,
        stockRequest: true,
        items: { include: { masterProduct: true } },
        internalTransfer: true,
      },
    });

    if (!shipment) throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
    const completedStatuses: ShipmentStatus[] = [ShipmentStatus.RECEIVED, ShipmentStatus.RECEIVED_WITH_ISSUE];
    if (shipment.status !== ShipmentStatus.SHIPPED && !(completedStatuses.includes(shipment.status) && shipment.internalTransfer?.receiptInventoryPostingId)) {
      throw { status: 422, code: 'INVALID_SHIPMENT_STATUS', message: 'Shipment hanya dapat diterima saat SHIPPED' };
    }

    await this.assertBranchReceiverAccess(actor, shipment.toBranchId);

    if (completedStatuses.includes(shipment.status) && shipment.internalTransfer?.receiptInventoryPostingId) {
      return this.formatBranchShipment(shipment);
    }

    if (input.discrepancies?.length) {
      input.discrepancies.forEach((item) => this.requireNotes(item.notes, 'Catatan discrepancy wajib diisi'));
    }

    const receivedMap = new Map(shipment.items.map((item) => [item.masterProductId, Number(item.sentQty)]));
    (input.receivedItems || []).forEach((item) => receivedMap.set(item.masterProductId, Number(item.receivedQty)));
    const hasQuantityDifference = shipment.items.some((item) => Number(receivedMap.get(item.masterProductId)) !== Number(item.sentQty));
    const hasDiscrepancy = Boolean(input.discrepancies?.length) || hasQuantityDifference;
    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: string; status: ShipmentStatus }>>(Prisma.sql`SELECT "id", "status" FROM "shipments" WHERE "id" = ${shipmentId} FOR UPDATE`);
      if (!locked) throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tidak ditemukan' };
      if (locked.status !== ShipmentStatus.SHIPPED) {
        if (completedStatuses.includes(locked.status)) {
          return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { fromBranch: true, toBranch: true, items: { include: { masterProduct: true } }, discrepancies: true, internalTransfer: true } });
        }
        throw { status: 422, code: 'INVALID_SHIPMENT_STATUS', message: 'Shipment hanya dapat diterima saat SHIPPED' };
      }

      for (const item of shipment.items) {
        const receivedQty = receivedMap.has(item.masterProductId)
          ? Number(receivedMap.get(item.masterProductId))
          : Number(item.sentQty);

        await tx.shipmentItem.update({
          where: { id: item.id },
          data: { receivedQty },
        });

      }

      const transferReceipt = await receiveInternalTransfer(tx, shipmentId, actor.userId, new Date(), receivedMap, notes);
      const changes: MovementChange[] = transferReceipt.movements;

      for (const discrepancy of input.discrepancies || []) {
        const product = shipment.items.find((item) => item.masterProductId === discrepancy.masterProductId)?.masterProduct;
        await tx.shipmentDiscrepancy.create({
          data: {
            shipmentId,
            masterProductId: discrepancy.masterProductId,
            productName: product?.name || 'Unknown',
            expectedQty: discrepancy.expectedQty,
            receivedQty: discrepancy.receivedQty,
            discrepancyType: discrepancy.discrepancyType,
            notes: discrepancy.notes,
            photoUrl: discrepancy.photoUrl,
            photoFileName: discrepancy.photoFileName,
            reportedBy: actor.userId,
          },
        });
      }

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.RECEIVE_SHIPMENT,
        sourceType: LogisticLocationType.CENTRAL_STOCK,
        sourceId: shipment.fromBranchId,
        destinationType: LogisticLocationType.BRANCH_STOCK,
        destinationId: shipment.toBranchId,
        referenceType: 'SHIPMENT',
        referenceId: shipmentId,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.receiptFileUrl,
        supportFileName: input.receiptFileName,
        supportFileSize: input.receiptFileSize,
        supportFileMimeType: input.receiptMimeType,
        changes,
      });

      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: hasDiscrepancy ? StockRequestStatus.COMPLETED_WITH_ISSUE : StockRequestStatus.COMPLETED,
            receivedBy: actor.userId,
            receivedAt: new Date(),
            receivingNotes: notes,
          },
        });
      }

      return tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: hasDiscrepancy ? ShipmentStatus.RECEIVED_WITH_ISSUE : ShipmentStatus.RECEIVED,
          receivedBy: actor.userId,
          receivedAt: new Date(),
          receiptFileUrl: input.receiptFileUrl,
          receiptFileName: input.receiptFileName,
          receiptFileSize: input.receiptFileSize,
          receiptMimeType: input.receiptMimeType,
          notes,
        },
        include: {
          fromBranch: true,
          toBranch: true,
          items: { include: { masterProduct: true } },
          discrepancies: true,
          internalTransfer: true,
        },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: shipment.toBranchId,
      action: AuditAction.RECEIVE_SHIPMENT,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        action: hasDiscrepancy ? 'RECEIVE_BRANCH_SHIPMENT_WITH_ISSUE' : 'RECEIVE_BRANCH_SHIPMENT',
        shipmentCode: shipment.shipmentCode,
        notes,
        discrepancyCount: input.discrepancies?.length || 0,
      },
    });

    return this.formatBranchShipment(result);
  }

  // ============================================================
  // Homecare team and bag setup
  // ============================================================

  async createHomecareTeam(actor: LogisticsActor, input: CreateHomecareTeamInput) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses membuat tim homecare');
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch || !branch.isActive) throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan atau tidak aktif' };
    if (branch.type === BranchType.PUSAT) {
      throw { status: 422, code: 'HOMECARE_SERVICE_BRANCH_REQUIRED', message: 'Tim homecare harus dibuat pada cabang layanan, bukan Head Office' };
    }
    await this.assertManagerBranchAccess(actor, input.branchId);

    const [adminLayanan, nakes] = await Promise.all([
      this.validateHomecareTeamMember(
        input.adminLayananUserId,
        HomecareTeamMemberRole.ADMIN_LAYANAN,
        input.branchId,
      ),
      prisma.user.findUnique({
        where: { id: input.nakesUserId },
        select: { role: true },
      }),
    ]);
    const nakesTeamRole = nakes ? homecareRoleForStaffRole(nakes.role) : null;
    if (nakesTeamRole !== HomecareTeamMemberRole.DOCTOR && nakesTeamRole !== HomecareTeamMemberRole.NURSE) {
      throw { status: 422, code: 'HOMECARE_NAKES_REQUIRED', message: 'Pilih satu akun Dokter atau Perawat yang aktif sebagai Nakes' };
    }
    await this.validateHomecareTeamMember(input.nakesUserId, nakesTeamRole, input.branchId);

    const teamCode = input.teamCode || this.uniqueCode('HCT');
    const team = await prisma.$transaction((tx) => tx.homecareTeam.create({
      data: {
        teamCode,
        name: input.name,
        branchId: input.branchId,
        description: input.description,
        createdBy: actor.userId,
        members: {
          create: [
            { userId: adminLayanan.id, role: HomecareTeamMemberRole.ADMIN_LAYANAN },
            { userId: input.nakesUserId, role: nakesTeamRole },
          ],
        },
      },
      include: { members: true, bags: true },
    }));

    await logAudit({
      userId: actor.userId,
      branchId: input.branchId,
      action: AuditAction.CREATE,
      resource: 'HomecareTeam',
      resourceId: team.id,
      meta: {
        action: 'CREATE_HOMECARE_TEAM',
        teamCode,
        adminLayananUserId: input.adminLayananUserId,
        nakesUserId: input.nakesUserId,
        nakesRole: nakesTeamRole,
      },
    });

    return team;
  }

  async addHomecareTeamMember(actor: LogisticsActor, teamId: string, input: AddHomecareTeamMemberInput) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses mengelola anggota tim homecare');
    const team = await prisma.homecareTeam.findUnique({ where: { id: teamId } });
    if (!team) throw { status: 404, code: 'TEAM_NOT_FOUND', message: 'Tim homecare tidak ditemukan' };
    await this.assertManagerBranchAccess(actor, team.branchId);
    await this.validateHomecareTeamMember(input.userId, input.role, team.branchId);

    const member = await prisma.homecareTeamMember.upsert({
      where: { teamId_userId: { teamId, userId: input.userId } },
      create: {
        teamId,
        userId: input.userId,
        role: input.role,
        notes: input.notes,
      },
      update: {
        role: input.role,
        isActive: true,
        leftAt: null,
        notes: input.notes,
      },
    });

    await logAudit({
      userId: actor.userId,
      branchId: team.branchId,
      action: AuditAction.ASSIGN,
      resource: 'HomecareTeamMember',
      resourceId: member.id,
      meta: { action: 'ADD_HOMECARE_TEAM_MEMBER', teamId, memberUserId: input.userId, role: input.role },
    });

    return member;
  }

  async removeHomecareTeamMember(actor: LogisticsActor, teamId: string, userId: string, input: RemoveHomecareTeamMemberInput = {}) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses mengelola anggota tim homecare');
    const member = await prisma.homecareTeamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { team: true },
    });
    if (!member) throw { status: 404, code: 'TEAM_MEMBER_NOT_FOUND', message: 'Anggota tim tidak ditemukan' };
    await this.assertManagerBranchAccess(actor, member.team.branchId);

    const activeBags = await prisma.homecareBag.count({ where: { teamId, isActive: true } });
    if (activeBags > 0) {
      const remainingMembers = await prisma.homecareTeamMember.findMany({
        where: { teamId, isActive: true, userId: { not: userId } },
        select: { role: true, isActive: true },
      });
      const readiness = getHomecareTeamReadiness(remainingMembers);
      if (!readiness.isOperational) {
        throw {
          status: 422,
          code: 'HOMECARE_TEAM_WOULD_BE_INCOMPLETE',
          message: `Anggota tidak dapat dilepas selama tim memiliki tas aktif. Siapkan pengganti ${readiness.missingRoles.join(' dan ')} terlebih dahulu.`,
        };
      }
    }

    const updated = await prisma.homecareTeamMember.update({
      where: { id: member.id },
      data: { isActive: false, leftAt: new Date(), notes: input.notes || member.notes },
    });

    await logAudit({
      userId: actor.userId,
      branchId: member.team.branchId,
      action: AuditAction.DELETE,
      resource: 'HomecareTeamMember',
      resourceId: member.id,
      meta: { action: 'REMOVE_HOMECARE_TEAM_MEMBER', teamId, memberUserId: userId, notes: input.notes },
    });

    return updated;
  }

  async deleteHomecareTeam(actor: LogisticsActor, teamId: string) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses menghapus tim homecare');
    const team = await prisma.homecareTeam.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { isActive: true },
          select: { id: true },
        },
        bags: {
          select: { id: true },
        },
      },
    });
    if (!team) throw { status: 404, code: 'TEAM_NOT_FOUND', message: 'Tim homecare tidak ditemukan' };
    if (team.bags.length > 0) {
      throw { status: 400, code: 'TEAM_HAS_BAGS', message: 'Tim masih memiliki tas. Pindahkan atau hapus tas terlebih dahulu' };
    }
    if (team.members.length > 0) {
      throw { status: 400, code: 'TEAM_HAS_ACTIVE_MEMBERS', message: 'Tim masih memiliki anggota aktif. Nonaktifkan anggota terlebih dahulu' };
    }

    await prisma.homecareTeam.delete({
      where: { id: teamId },
    });

    await logAudit({
      userId: actor.userId,
      branchId: team.branchId,
      action: AuditAction.DELETE,
      resource: 'HomecareTeam',
      resourceId: teamId,
      meta: { action: 'DELETE_HOMECARE_TEAM', teamCode: team.teamCode, teamName: team.name },
    });

    return { id: teamId };
  }

  async createHomecareBag(actor: LogisticsActor, input: CreateHomecareBagInput) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses membuat tas homecare');
    const team = await this.assertHomecareTeamOperational(input.teamId);
    await this.assertManagerBranchAccess(actor, team.branchId);

    const branchId = input.branchId || team.branchId;
    if (branchId !== team.branchId) {
      throw { status: 422, code: 'BAG_BRANCH_MISMATCH', message: 'Cabang tas harus sama dengan cabang tim homecare' };
    }

    const bagCode = input.bagCode || this.uniqueCode('HCB');
    const bag = await prisma.homecareBag.create({
      data: {
        bagCode,
        name: input.name,
        teamId: input.teamId,
        branchId,
        status: input.status || 'ACTIVE',
        notes: input.notes,
        createdBy: actor.userId,
      },
      include: { team: true, stocks: true },
    });

    await logAudit({
      userId: actor.userId,
      branchId,
      action: AuditAction.CREATE,
      resource: 'HomecareBag',
      resourceId: bag.id,
      meta: { action: 'CREATE_HOMECARE_BAG', bagCode, teamId: input.teamId },
    });

    return bag;
  }

  async assignHomecareBag(actor: LogisticsActor, bagId: string, input: AssignHomecareBagInput) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses assign tas homecare');

    const [bag, team] = await Promise.all([
      prisma.homecareBag.findUnique({
        where: { id: bagId },
        include: { team: true, stocks: true },
      }),
      prisma.homecareTeam.findUnique({
        where: { id: input.teamId },
      }),
    ]);

    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };
    if (!team) throw { status: 404, code: 'TEAM_NOT_FOUND', message: 'Tim homecare tidak ditemukan' };
    await this.assertHomecareTeamOperational(team.id);
    await this.assertManagerBranchAccess(actor, team.branchId);
    if (bag.teamId === team.id) {
      throw {
        status: 400,
        code: 'BAG_ALREADY_ASSIGNED_TO_TEAM',
        message: 'Tas homecare ini sudah berada di tim tersebut',
      };
    }

    const assignedBag = await prisma.homecareBag.update({
      where: { id: bagId },
      data: {
        teamId: team.id,
        branchId: team.branchId,
        notes: input.notes ?? bag.notes,
      },
      include: { team: true, stocks: true },
    });

    await logAudit({
      userId: actor.userId,
      branchId: team.branchId,
      action: AuditAction.ASSIGN,
      resource: 'HomecareBag',
      resourceId: assignedBag.id,
      meta: {
        action: 'ASSIGN_HOMECARE_BAG',
        bagCode: assignedBag.bagCode,
        fromTeamId: bag.teamId,
        toTeamId: team.id,
      },
    });

    return assignedBag;
  }

  async deleteHomecareBag(actor: LogisticsActor, bagId: string) {
    this.assertRole(actor, Array.from(centralStockManagerRoles), 'Anda tidak memiliki akses menghapus tas homecare');
    const bag = await prisma.homecareBag.findUnique({
      where: { id: bagId },
      include: {
        team: true,
        stocks: true,
        stockRequests: { select: { id: true } },
        shipments: { select: { id: true } },
        usages: { select: { id: true } },
        returns: { select: { id: true } },
        opnames: { select: { id: true } },
        mutations: { select: { id: true } },
      },
    });
    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };

    if (
      bag.stocks.length > 0 ||
      bag.stockRequests.length > 0 ||
      bag.shipments.length > 0 ||
      bag.usages.length > 0 ||
      bag.returns.length > 0 ||
      bag.opnames.length > 0 ||
      bag.mutations.length > 0
    ) {
      throw {
        status: 400,
        code: 'BAG_HAS_HISTORY',
        message: 'Tas sudah memiliki stok atau riwayat operasional sehingga tidak dapat dihapus',
      };
    }

    await prisma.homecareBag.delete({
      where: { id: bagId },
    });

    await logAudit({
      userId: actor.userId,
      branchId: bag.branchId,
      action: AuditAction.DELETE,
      resource: 'HomecareBag',
      resourceId: bagId,
      meta: {
        action: 'DELETE_HOMECARE_BAG',
        bagCode: bag.bagCode,
        bagName: bag.name,
        teamId: bag.teamId,
      },
    });

    return { id: bagId };
  }

  async getBagStock(actor: LogisticsActor, bagId: string) {
    await this.assertBagAccess(actor, bagId);
    const bag = await prisma.homecareBag.findUnique({
      where: { id: bagId },
      include: {
        team: true,
        stocks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };

    const productIds = bag.stocks.map((stock) => stock.masterProductId);
    const products = await prisma.masterProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sku: true, name: true, category: true, baseUnit: true, usageUnit: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    return {
      id: bag.id,
      bagCode: bag.bagCode,
      name: bag.name,
      status: bag.status,
      team: { id: bag.team.id, teamCode: bag.team.teamCode, name: bag.team.name },
      stocks: bag.stocks.map((stock) => {
        const product = productMap.get(stock.masterProductId);
        return {
          id: stock.id,
          masterProductId: stock.masterProductId,
          productName: product?.name || null,
          sku: product?.sku || null,
          category: product?.category || null,
          stock: Number(stock.stock),
          minThreshold: Number(stock.minThreshold),
          baseUnit: product?.baseUnit || null,
          usageUnit: product?.usageUnit || null,
        };
      }),
    };
  }

  // ============================================================
  // Homecare bag request and shipment
  // ============================================================

  async createBagStockRequest(actor: LogisticsActor, input: CreateBagStockRequestInput) {
    this.assertRole(actor, canRequestBagStock, 'Anda tidak memiliki akses membuat request stok tas');
    const notes = this.requireNotes(input.requestNotes);
    await this.assertBagAccess(actor, input.bagId, { requireAdminLayanan: true });
    await this.validateProducts(input.items.map((item) => item.masterProductId));

    const bag = await prisma.homecareBag.findUnique({
      where: { id: input.bagId },
      include: { team: true },
    });
    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };
    if (bag.teamId !== input.teamId) {
      throw { status: 400, code: 'BAG_TEAM_MISMATCH', message: 'Tas tidak berada pada tim yang dipilih' };
    }
    await this.assertHomecareTeamOperational(bag.teamId);

    const requestCode = await this.nextRequestCode('HBR', async (codePrefix) => (
      await prisma.homecareBagStockRequest.findFirst({
        where: { requestCode: { startsWith: codePrefix } },
        orderBy: { requestCode: 'desc' },
        select: { requestCode: true },
      })
    )?.requestCode, bag.bagCode);
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.homecareBagStockRequest.create({
        data: {
        requestCode,
        teamId: input.teamId,
        bagId: input.bagId,
        branchId: bag.branchId,
        requestedBy: actor.userId,
        priority: input.priority || 'NORMAL',
        requestNotes: notes,
        supportFileUrl: input.supportFileUrl,
        supportFileName: input.supportFileName,
        supportFileSize: input.supportFileSize,
        supportFileMimeType: input.supportFileMimeType,
        items: {
          create: input.items.map((item) => ({
            masterProductId: item.masterProductId,
            requestedQty: item.requestedQty,
            finalQty: item.requestedQty,
            notes: item.notes?.trim() || null,
          })),
        },
        },
        include: {
          team: true,
          bag: true,
          items: true,
        },
      });
      const managers = await tx.user.findMany({
        where: {
          isActive: true,
          role: Role.ADMIN_MANAGER,
          managedBranches: { some: { branchId: bag.branchId } },
        },
        select: { id: true },
      });
      if (managers.length === 0) {
        throw {
          status: 422,
          code: 'HOMECARE_APPROVER_NOT_FOUND',
          message: 'Cabang belum memiliki Admin Manager aktif. Tetapkan Admin Manager sebelum membuat request stok tas.',
        };
      }
      await tx.notification.createMany({
        data: managers.map((manager) => ({
          userId: manager.id,
          type: 'INFO',
          title: 'Request stok tas homecare',
          body: `${requestCode} dari ${bag.team.name} menunggu persetujuan Anda.`,
          deepLink: '/inventory/homecare-bags',
        })),
      });
      return created;
    });

    await logAudit({
      userId: actor.userId,
      branchId: bag.branchId,
      action: AuditAction.STOCK_REQUEST,
      resource: 'HomecareBagStockRequest',
      resourceId: request.id,
      meta: { action: 'CREATE_BAG_STOCK_REQUEST', requestCode, bagId: bag.id, teamId: bag.teamId },
    });

    return this.formatBagRequest(request);
  }

  async approveBagStockRequest(actor: LogisticsActor, requestId: string, input: ApproveBagStockRequestInput) {
    this.assertRole(actor, canReviewBagStockRequest, 'Hanya Admin Manager yang dapat menyetujui request stok tas');
    const request = await prisma.homecareBagStockRequest.findUnique({
      where: { id: requestId },
      include: { team: true, bag: true, items: true, shipment: true },
    });
    if (!request) throw { status: 404, code: 'REQUEST_NOT_FOUND', message: 'Request stok tas tidak ditemukan' };
    if (request.status !== HomecareBagRequestStatus.PENDING) {
      throw { status: 422, code: 'INVALID_REQUEST_STATUS', message: 'Request hanya dapat di-approve saat PENDING' };
    }
    if (request.shipment) {
      throw { status: 422, code: 'SHIPMENT_ALREADY_EXISTS', message: 'Shipment untuk request ini sudah dibuat' };
    }

    const approvalMap = new Map((input.items || []).map((item) => [item.masterProductId, Number(item.approvedQty)]));
    const finalItems = request.items.map((item) => {
      const approvedQty = approvalMap.has(item.masterProductId)
        ? Number(approvalMap.get(item.masterProductId))
        : Number(item.finalQty ?? item.requestedQty);
      if (approvedQty < 0 || approvedQty > Number(item.requestedQty)) {
        throw { status: 400, code: 'INVALID_APPROVED_QTY', message: 'Jumlah approve tidak valid' };
      }
      return { ...item, approvedQty, finalQty: approvedQty };
    });

    const isPartial = finalItems.some((item) => item.approvedQty < Number(item.requestedQty));
    if (isPartial) this.requireNotes(input.reviewNotes, 'Catatan wajib diisi untuk approve sebagian');
    if (finalItems.every((item) => item.finalQty <= 0)) {
      throw { status: 400, code: 'NO_APPROVED_ITEMS', message: 'Minimal satu item harus disetujui' };
    }

    const sourceBranchId = input.sourceBranchId || request.branchId;
    if (sourceBranchId !== request.branchId) {
      throw {
        status: 422,
        code: 'HOMECARE_SOURCE_BRANCH_MISMATCH',
        message: 'Stok tas homecare harus dipenuhi dari stok cabang tim yang meminta',
      };
    }
    await this.assertManagerBranchAccess(actor, sourceBranchId);

    const sourceBranch = await prisma.branch.findUnique({
      where: { id: sourceBranchId },
      select: { id: true, branchCode: true, name: true, isActive: true },
    });
    if (!sourceBranch || !sourceBranch.isActive) {
      throw { status: 404, code: 'SOURCE_BRANCH_NOT_FOUND', message: 'Cabang sumber stok tidak ditemukan atau tidak aktif' };
    }

    const products = await prisma.masterProduct.findMany({
      where: { id: { in: finalItems.map((item) => item.masterProductId) } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of finalItems.filter((item) => item.finalQty > 0)) {
      const sourceStock = await prisma.inventoryItem.findFirst({
        where: { branchId: sourceBranch.id, masterProductId: item.masterProductId },
      });
      if (!sourceStock || Number(sourceStock.stock) < item.finalQty) {
        throw {
          status: 422,
          code: 'INSUFFICIENT_SOURCE_STOCK',
          message: `Stok ${sourceBranch.name} tidak mencukupi untuk ${productMap.get(item.masterProductId)?.name || item.masterProductId}`,
        };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of finalItems) {
        await tx.homecareBagStockRequestItem.update({
          where: { id: item.id },
          data: { approvedQty: item.approvedQty, finalQty: item.finalQty },
        });
      }

      const updatedRequest = await tx.homecareBagStockRequest.update({
        where: { id: requestId },
        data: {
          status: isPartial ? HomecareBagRequestStatus.PARTIALLY_APPROVED : HomecareBagRequestStatus.APPROVED,
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes?.trim() || null,
        },
        include: { team: true, bag: true, items: true },
      });

      const shipmentCode = await this.nextRequestCode('HBS', async (codePrefix) => (
        await tx.homecareBagShipment.findFirst({
          where: { shipmentCode: { startsWith: codePrefix } },
          orderBy: { shipmentCode: 'desc' },
          select: { shipmentCode: true },
        })
      )?.shipmentCode, `${sourceBranch.branchCode}-${request.bag.bagCode}`);
      const shipment = await tx.homecareBagShipment.create({
        data: {
          shipmentCode,
          requestId,
          fromBranchId: sourceBranch.id,
          toBagId: request.bagId,
          status: ShipmentStatus.PREPARING,
          notes: input.reviewNotes?.trim() || `Pengiriman untuk request ${request.requestCode}`,
          items: {
            create: finalItems
              .filter((item) => item.finalQty > 0)
              .map((item) => ({
                masterProductId: item.masterProductId,
                sentQty: item.finalQty,
              })),
          },
        },
        include: { bag: true, request: true, items: true },
      });

      return { request: updatedRequest, shipment };
    });

    await logAudit({
      userId: actor.userId,
      branchId: request.branchId,
      action: AuditAction.VERIFY,
      resource: 'HomecareBagStockRequest',
      resourceId: requestId,
      meta: {
        action: isPartial ? 'PARTIAL_APPROVE_BAG_STOCK_REQUEST' : 'APPROVE_BAG_STOCK_REQUEST',
        requestCode: request.requestCode,
        shipmentId: result.shipment.id,
        sourceBranchId: sourceBranch.id,
      },
    });

    return {
      request: this.formatBagRequest(result.request),
      shipment: this.formatBagShipment(result.shipment),
    };
  }

  async rejectBagStockRequest(actor: LogisticsActor, requestId: string, input: RejectStockRequestInput) {
    this.assertRole(actor, canReviewBagStockRequest, 'Hanya Admin Manager yang dapat menolak request stok tas');
    const reviewNotes = this.requireNotes(input.reviewNotes, 'Catatan penolakan wajib diisi');

    const request = await prisma.homecareBagStockRequest.update({
      where: { id: requestId },
      data: {
        status: HomecareBagRequestStatus.REJECTED,
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNotes,
        rejectionReason: reviewNotes,
      },
      include: { team: true, bag: true, items: true },
    });

    await logAudit({
      userId: actor.userId,
      branchId: request.branchId,
      action: AuditAction.REJECT_PAYMENT,
      resource: 'HomecareBagStockRequest',
      resourceId: requestId,
      meta: { action: 'REJECT_BAG_STOCK_REQUEST', reason: reviewNotes },
    });

    return this.formatBagRequest(request);
  }

  async shipBagShipment(actor: LogisticsActor, shipmentId: string, input: ShipStockInput) {
    this.assertRole(actor, Array.from(stockShipmentRoles), 'Anda tidak memiliki akses untuk mengirim stok tas');
    const notes = this.requireNotes(input.notes);

    const shipment = await prisma.homecareBagShipment.findUnique({
      where: { id: shipmentId },
      include: { bag: true, request: true, items: true },
    });
    if (!shipment) throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tas tidak ditemukan' };
    if (shipment.status !== ShipmentStatus.PREPARING) {
      throw { status: 422, code: 'INVALID_SHIPMENT_STATUS', message: 'Shipment hanya dapat dikirim saat PREPARING' };
    }

    await this.assertManagerBranchAccess(actor, shipment.fromBranchId);

    const sourceBranch = await prisma.branch.findUnique({
      where: { id: shipment.fromBranchId },
      select: { type: true, isActive: true },
    });
    if (!sourceBranch || !sourceBranch.isActive) {
      throw { status: 404, code: 'SOURCE_BRANCH_NOT_FOUND', message: 'Cabang sumber stok tidak ditemukan atau tidak aktif' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const changes: MovementChange[] = [];
      for (const item of shipment.items) {
        const quantity = Number(item.sentQty);
        if (quantity <= 0) continue;
        changes.push(await this.decrementInventoryStock(tx, {
          branchId: shipment.fromBranchId,
          masterProductId: item.masterProductId,
          quantity,
          userId: actor.userId,
          referenceType: 'HOMECARE_BAG_SHIPMENT',
          referenceId: shipmentId,
          notes,
          locationType: sourceBranch.type === BranchType.PUSAT
            ? LogisticLocationType.CENTRAL_STOCK
            : LogisticLocationType.BRANCH_STOCK,
        }));
      }

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.SHIPMENT,
        sourceType: sourceBranch.type === BranchType.PUSAT ? LogisticLocationType.CENTRAL_STOCK : LogisticLocationType.BRANCH_STOCK,
        sourceId: shipment.fromBranchId,
        destinationType: LogisticLocationType.HOMECARE_BAG,
        destinationId: shipment.toBagId,
        referenceType: 'HOMECARE_BAG_SHIPMENT',
        referenceId: shipmentId,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.shipmentPhotoUrl,
        supportFileName: input.shipmentPhotoName,
        changes,
      });

      await tx.homecareBagStockRequest.update({
        where: { id: shipment.requestId },
        data: {
          status: HomecareBagRequestStatus.SHIPPED,
          shippedBy: actor.userId,
          shippedAt: new Date(),
        },
      });

      return tx.homecareBagShipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.SHIPPED,
          shippedBy: actor.userId,
          shippedAt: new Date(),
          shipmentPhotoUrl: input.shipmentPhotoUrl,
          shipmentPhotoName: input.shipmentPhotoName,
          notes,
        },
        include: { bag: true, request: true, items: true },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: shipment.bag.branchId,
      action: AuditAction.SHIPMENT,
      resource: 'HomecareBagShipment',
      resourceId: shipmentId,
      meta: {
        action: 'SHIP_BAG_SHIPMENT',
        role: actor.role,
        fromBranchId: shipment.fromBranchId,
        toBagId: shipment.toBagId,
        notes,
      },
    });

    return this.formatBagShipment(result);
  }

  async receiveBagShipment(actor: LogisticsActor, shipmentId: string, input: ReceiveShipmentInput) {
    const notes = this.requireNotes(input.notes);
    const shipment = await prisma.homecareBagShipment.findUnique({
      where: { id: shipmentId },
      include: { bag: true, request: true, items: true },
    });
    if (!shipment) throw { status: 404, code: 'SHIPMENT_NOT_FOUND', message: 'Shipment tas tidak ditemukan' };
    if (shipment.status !== ShipmentStatus.SHIPPED) {
      throw { status: 422, code: 'INVALID_SHIPMENT_STATUS', message: 'Shipment hanya dapat diterima saat SHIPPED' };
    }

    const sourceBranch = await prisma.branch.findUnique({
      where: { id: shipment.fromBranchId },
      select: { type: true, isActive: true },
    });
    if (!sourceBranch || !sourceBranch.isActive) {
      throw { status: 404, code: 'SOURCE_BRANCH_NOT_FOUND', message: 'Cabang sumber stok tidak ditemukan atau tidak aktif' };
    }

    if (!bagStockReceiverRoles.has(actor.role)) {
      await this.assertBagAccess(actor, shipment.toBagId);
    } else if (actor.role === Role.ADMIN_LAYANAN) {
      await this.assertBagAccess(actor, shipment.toBagId, { requireAdminLayanan: true });
    }

    if (input.discrepancies?.length) {
      input.discrepancies.forEach((item) => this.requireNotes(item.notes, 'Catatan discrepancy wajib diisi'));
    }

    const receivedMap = new Map((input.receivedItems || []).map((item) => [item.masterProductId, Number(item.receivedQty)]));
    const hasDiscrepancy = Boolean(input.discrepancies?.length);
    const result = await prisma.$transaction(async (tx) => {
      const changes: MovementChange[] = [];
      for (const item of shipment.items) {
        const receivedQty = receivedMap.has(item.masterProductId)
          ? Number(receivedMap.get(item.masterProductId))
          : Number(item.sentQty);

        await tx.homecareBagShipmentItem.update({
          where: { id: item.id },
          data: {
            receivedQty,
            discrepancyType: input.discrepancies?.find((d) => d.masterProductId === item.masterProductId)?.discrepancyType,
            discrepancyNotes: input.discrepancies?.find((d) => d.masterProductId === item.masterProductId)?.notes,
          },
        });

        if (receivedQty > 0) {
          changes.push(await this.changeBagStock(tx, {
            bagId: shipment.toBagId,
            masterProductId: item.masterProductId,
            quantity: receivedQty,
            direction: 'IN',
            userId: actor.userId,
            referenceType: 'HOMECARE_BAG_SHIPMENT',
            referenceId: shipmentId,
            notes,
          }));
        }
      }

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.RECEIVE_SHIPMENT,
        sourceType: sourceBranch.type === BranchType.PUSAT
          ? LogisticLocationType.CENTRAL_STOCK
          : LogisticLocationType.BRANCH_STOCK,
        sourceId: shipment.fromBranchId,
        destinationType: LogisticLocationType.HOMECARE_BAG,
        destinationId: shipment.toBagId,
        referenceType: 'HOMECARE_BAG_SHIPMENT',
        referenceId: shipmentId,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.receiptFileUrl,
        supportFileName: input.receiptFileName,
        supportFileSize: input.receiptFileSize,
        supportFileMimeType: input.receiptMimeType,
        changes,
      });

      await tx.homecareBagStockRequest.update({
        where: { id: shipment.requestId },
        data: {
          status: hasDiscrepancy ? HomecareBagRequestStatus.RECEIVED_WITH_ISSUE : HomecareBagRequestStatus.COMPLETED,
          receivedBy: actor.userId,
          receivedAt: new Date(),
          receivingNotes: notes,
        },
      });

      return tx.homecareBagShipment.update({
        where: { id: shipmentId },
        data: {
          status: hasDiscrepancy ? ShipmentStatus.RECEIVED_WITH_ISSUE : ShipmentStatus.RECEIVED,
          receivedAt: new Date(),
          receivedUserId: actor.userId,
          receiptFileUrl: input.receiptFileUrl,
          receiptFileName: input.receiptFileName,
          receiptFileSize: input.receiptFileSize,
          receiptMimeType: input.receiptMimeType,
          notes,
        },
        include: { bag: true, request: true, items: true },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: shipment.bag.branchId,
      action: AuditAction.RECEIVE_SHIPMENT,
      resource: 'HomecareBagShipment',
      resourceId: shipmentId,
      meta: {
        action: hasDiscrepancy ? 'RECEIVE_BAG_SHIPMENT_WITH_ISSUE' : 'RECEIVE_BAG_SHIPMENT',
        notes,
        discrepancyCount: input.discrepancies?.length || 0,
      },
    });

    return this.formatBagShipment(result);
  }

  // ============================================================
  // Homecare bag usage, return, and opname
  // ============================================================

  async useBagStock(actor: LogisticsActor, input: UseBagStockInput) {
    const notes = this.requireNotes(input.notes);
    await this.assertBagAccess(actor, input.bagId);
    if (input.allowNegativeStock && actor.role !== Role.SUPER_ADMIN) {
      throw { status: 403, code: 'NEGATIVE_STOCK_FORBIDDEN', message: 'Hanya Super Admin yang dapat mengizinkan stok minus' };
    }

    const bag = await prisma.homecareBag.findUnique({ where: { id: input.bagId } });
    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };
    const teamId = input.teamId || bag.teamId;

    const usageCode = await this.nextRequestCode('HBU', async (codePrefix) => (
      await prisma.homecareBagUsage.findFirst({
        where: { usageCode: { startsWith: codePrefix } },
        orderBy: { usageCode: 'desc' },
        select: { usageCode: true },
      })
    )?.usageCode, bag.bagCode);
    const result = await prisma.$transaction(async (tx) => {
      const usage = await tx.homecareBagUsage.create({
        data: {
          usageCode,
          bagId: input.bagId,
          teamId,
          treatmentSessionId: input.treatmentSessionId,
          usedBy: actor.userId,
          status: input.status || 'COMPLETED',
          usageDate: input.usageDate || new Date(),
          notes,
          supportFileUrl: input.supportFileUrl,
          supportFileName: input.supportFileName,
          supportFileSize: input.supportFileSize,
          supportFileMimeType: input.supportFileMimeType,
          items: {
            create: input.items.map((item) => ({
              masterProductId: item.masterProductId,
              quantity: item.quantity,
              unit: item.unit,
              notes: item.notes,
            })),
          },
        },
        include: { bag: true, items: true },
      });

      const changes: MovementChange[] = [];
      for (const item of input.items) {
        changes.push(await this.changeBagStock(tx, {
          bagId: input.bagId,
          masterProductId: item.masterProductId,
          quantity: item.quantity,
          direction: 'OUT',
          userId: actor.userId,
          referenceType: 'HOMECARE_BAG_USAGE',
          referenceId: usage.id,
          notes,
          allowNegativeStock: input.allowNegativeStock,
        }));
      }

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.BAG_USAGE,
        sourceType: LogisticLocationType.HOMECARE_BAG,
        sourceId: input.bagId,
        referenceType: 'HOMECARE_BAG_USAGE',
        referenceId: usage.id,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.supportFileUrl,
        supportFileName: input.supportFileName,
        supportFileSize: input.supportFileSize,
        supportFileMimeType: input.supportFileMimeType,
        changes,
      });

      return tx.homecareBagUsage.findUniqueOrThrow({
        where: { id: usage.id },
        include: { bag: { include: { team: true } }, items: true },
      });
    });

    await logAudit({
      userId: actor.userId,
      branchId: bag.branchId,
      action: AuditAction.STOCK_ADJUSTMENT,
      resource: 'HomecareBagUsage',
      resourceId: result.id,
      meta: { action: 'USE_BAG_STOCK', usageCode, bagId: input.bagId, notes },
    });

    return this.formatBagUsage(result);
  }

  async returnBagStock(actor: LogisticsActor, input: ReturnBagStockInput) {
    const notes = this.requireNotes(input.notes);
    await this.assertBagAccess(actor, input.bagId);
    if (input.allowNegativeStock && actor.role !== Role.SUPER_ADMIN) {
      throw { status: 403, code: 'NEGATIVE_STOCK_FORBIDDEN', message: 'Hanya Super Admin yang dapat mengizinkan stok minus' };
    }

    const bag = await prisma.homecareBag.findUnique({ where: { id: input.bagId } });
    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };
    const teamId = input.teamId || bag.teamId;
    const returnCode = await this.nextRequestCode('HBRN', async (codePrefix) => (
      await prisma.homecareBagReturn.findFirst({
        where: { returnCode: { startsWith: codePrefix } },
        orderBy: { returnCode: 'desc' },
        select: { returnCode: true },
      })
    )?.returnCode, bag.bagCode);

    const result = await prisma.$transaction(async (tx) => {
      const bagReturn = await tx.homecareBagReturn.create({
        data: {
          returnCode,
          bagId: input.bagId,
          teamId,
          toBranchId: input.toBranchId,
          returnedBy: actor.userId,
          returnedAt: input.returnedAt || new Date(),
          notes,
          supportFileUrl: input.supportFileUrl,
          supportFileName: input.supportFileName,
          supportFileSize: input.supportFileSize,
          supportFileMimeType: input.supportFileMimeType,
          items: {
            create: input.items.map((item) => ({
              masterProductId: item.masterProductId,
              quantity: item.quantity,
              isReusable: item.isReusable ?? true,
              condition: item.condition,
              notes: item.notes,
            })),
          },
        },
        include: { bag: { include: { team: true } }, items: true },
      });

      const changes: MovementChange[] = [];
      for (const item of input.items) {
        const bagChange = await this.changeBagStock(tx, {
          bagId: input.bagId,
          masterProductId: item.masterProductId,
          quantity: item.quantity,
          direction: 'OUT',
          userId: actor.userId,
          referenceType: 'HOMECARE_BAG_RETURN',
          referenceId: bagReturn.id,
          notes,
          allowNegativeStock: input.allowNegativeStock,
        });

        if (item.isReusable ?? true) {
          const branchChange = await this.incrementBranchInventoryStock(tx, {
            branchId: input.toBranchId,
            masterProductId: item.masterProductId,
            quantity: item.quantity,
            userId: actor.userId,
            referenceType: 'HOMECARE_BAG_RETURN',
            referenceId: bagReturn.id,
            notes,
          });

          changes.push({
            masterProductId: item.masterProductId,
            quantity: Number(item.quantity),
            sourceStockBefore: bagChange.sourceStockBefore,
            sourceStockAfter: bagChange.sourceStockAfter,
            destinationStockBefore: branchChange.destinationStockBefore,
            destinationStockAfter: branchChange.destinationStockAfter,
            notes,
          });
        } else {
          changes.push(bagChange);
        }
      }

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.BAG_RETURN,
        sourceType: LogisticLocationType.HOMECARE_BAG,
        sourceId: input.bagId,
        destinationType: LogisticLocationType.BRANCH_STOCK,
        destinationId: input.toBranchId,
        referenceType: 'HOMECARE_BAG_RETURN',
        referenceId: bagReturn.id,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.supportFileUrl,
        supportFileName: input.supportFileName,
        supportFileSize: input.supportFileSize,
        supportFileMimeType: input.supportFileMimeType,
        changes,
      });

      return bagReturn;
    });

    await logAudit({
      userId: actor.userId,
      branchId: bag.branchId,
      action: AuditAction.STOCK_ADJUSTMENT,
      resource: 'HomecareBagReturn',
      resourceId: result.id,
      meta: { action: 'RETURN_BAG_STOCK', returnCode, bagId: input.bagId, notes },
    });

    return this.formatBagReturn(result);
  }

  async createBagOpname(actor: LogisticsActor, input: CreateBagOpnameInput) {
    const notes = this.requireNotes(input.notes);
    await this.assertBagAccess(actor, input.bagId);
    const bag = await prisma.homecareBag.findUnique({ where: { id: input.bagId } });
    if (!bag) throw { status: 404, code: 'BAG_NOT_FOUND', message: 'Tas homecare tidak ditemukan' };
    const teamId = input.teamId || bag.teamId;
    const opnameCode = await this.nextRequestCode('HBO', async (codePrefix) => (
      await prisma.homecareBagOpname.findFirst({
        where: { opnameCode: { startsWith: codePrefix } },
        orderBy: { opnameCode: 'desc' },
        select: { opnameCode: true },
      })
    )?.opnameCode, bag.bagCode);
    const createAdjustments = input.createAdjustments !== false;

    const result = await prisma.$transaction(async (tx) => {
      const productIds = input.items.map((item) => item.masterProductId);
      const stocks = await tx.homecareBagStock.findMany({
        where: { bagId: input.bagId, masterProductId: { in: productIds } },
      });
      const stockMap = new Map(stocks.map((stock) => [stock.masterProductId, Number(stock.stock)]));

      const opname = await tx.homecareBagOpname.create({
        data: {
          opnameCode,
          bagId: input.bagId,
          teamId,
          status: input.status || 'COMPLETED',
          checkedBy: actor.userId,
          checkedAt: input.checkedAt || new Date(),
          notes,
          supportFileUrl: input.supportFileUrl,
          supportFileName: input.supportFileName,
          supportFileSize: input.supportFileSize,
          supportFileMimeType: input.supportFileMimeType,
          items: {
            create: input.items.map((item) => {
              const systemQty = stockMap.get(item.masterProductId) || 0;
              const physicalQty = Number(item.physicalQty);
              return {
                masterProductId: item.masterProductId,
                systemQty,
                physicalQty,
                difference: physicalQty - systemQty,
                adjustmentCreated: createAdjustments,
                notes: item.notes,
              };
            }),
          },
        },
        include: { bag: { include: { team: true } }, items: true },
      });

      const changes: MovementChange[] = [];
      if (createAdjustments) {
        for (const item of input.items) {
          const physicalQty = Number(item.physicalQty);
          const currentQty = stockMap.get(item.masterProductId) || 0;
          if (physicalQty === currentQty) continue;
          changes.push(await this.changeBagStock(tx, {
            bagId: input.bagId,
            masterProductId: item.masterProductId,
            quantity: physicalQty,
            direction: 'SET',
            userId: actor.userId,
            referenceType: 'HOMECARE_BAG_OPNAME',
            referenceId: opname.id,
            notes,
          }));
        }
      }

      await this.createLogisticTransaction(tx, {
        type: LogisticTransactionType.STOCK_OPNAME,
        sourceType: LogisticLocationType.HOMECARE_BAG,
        sourceId: input.bagId,
        destinationType: LogisticLocationType.HOMECARE_BAG,
        destinationId: input.bagId,
        referenceType: 'HOMECARE_BAG_OPNAME',
        referenceId: opname.id,
        notes,
        createdBy: actor.userId,
        supportFileUrl: input.supportFileUrl,
        supportFileName: input.supportFileName,
        supportFileSize: input.supportFileSize,
        supportFileMimeType: input.supportFileMimeType,
        changes,
      });

      return opname;
    });

    await logAudit({
      userId: actor.userId,
      branchId: bag.branchId,
      action: AuditAction.STOCK_ADJUSTMENT,
      resource: 'HomecareBagOpname',
      resourceId: result.id,
      meta: { action: 'OPNAME_BAG_STOCK', opnameCode, bagId: input.bagId, notes, createAdjustments },
    });

    return this.formatBagOpname(result);
  }

  // ============================================================
  // Response formatters
  // ============================================================

  private formatBranchStockRequest(request: BranchStockRequestResponse) {
    return {
      id: request.id,
      requestCode: request.requestCode,
      branchId: request.branchId,
      branchName: request.branch?.name,
      status: request.status,
      notes: request.notes,
      reviewNotes: request.reviewNotes,
      requestedBy: request.requestedBy,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt?.toISOString?.(),
      shippedBy: request.shippedBy,
      shippedAt: request.shippedAt?.toISOString?.(),
      receivedBy: request.receivedBy,
      receivedAt: request.receivedAt?.toISOString?.(),
      items: request.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct?.name,
        requestedQty: Number(item.requestedQty),
        approvedQty: item.approvedQty === null || item.approvedQty === undefined ? null : Number(item.approvedQty),
        finalQty: item.finalQty === null || item.finalQty === undefined ? null : Number(item.finalQty),
        notes: item.notes,
      })) || [],
      createdAt: request.createdAt?.toISOString?.(),
      updatedAt: request.updatedAt?.toISOString?.(),
    };
  }

  private formatBranchShipment(shipment: BranchShipmentResponse) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch?.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch?.name,
      status: shipment.status,
      notes: shipment.notes,
      shippedBy: shipment.shippedBy,
      shippedAt: shipment.shippedAt?.toISOString?.(),
      receivedBy: shipment.receivedBy,
      receivedAt: shipment.receivedAt?.toISOString?.(),
      items: shipment.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct?.name,
        sentQty: Number(item.sentQty),
        receivedQty: item.receivedQty === null || item.receivedQty === undefined ? null : Number(item.receivedQty),
      })) || [],
      discrepancies: shipment.discrepancies?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.productName,
        expectedQty: Number(item.expectedQty),
        receivedQty: Number(item.receivedQty),
        discrepancyType: item.discrepancyType,
        notes: item.notes,
      })) || [],
      internalTransfer: shipment.internalTransfer ? {
        status: shipment.internalTransfer.status,
        totalValue: shipment.internalTransfer.totalValue?.toFixed?.(4),
        receivedValue: shipment.internalTransfer.receivedValue?.toFixed?.(4),
      } : null,
      createdAt: shipment.createdAt?.toISOString?.(),
      updatedAt: shipment.updatedAt?.toISOString?.(),
    };
  }

  private formatBagRequest(request: BagRequestResponse) {
    return {
      id: request.id,
      requestCode: request.requestCode,
      teamId: request.teamId,
      teamName: request.team?.name,
      bagId: request.bagId,
      bagCode: request.bag?.bagCode,
      bagName: request.bag?.name,
      branchId: request.branchId,
      status: request.status,
      priority: request.priority,
      requestNotes: request.requestNotes,
      reviewNotes: request.reviewNotes,
      rejectionReason: request.rejectionReason,
      requestedBy: request.requestedBy,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt?.toISOString?.(),
      shippedBy: request.shippedBy,
      shippedAt: request.shippedAt?.toISOString?.(),
      receivedBy: request.receivedBy,
      receivedAt: request.receivedAt?.toISOString?.(),
      supportFileUrl: request.supportFileUrl,
      supportFileName: request.supportFileName,
      items: request.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        requestedQty: Number(item.requestedQty),
        approvedQty: item.approvedQty === null || item.approvedQty === undefined ? null : Number(item.approvedQty),
        finalQty: item.finalQty === null || item.finalQty === undefined ? null : Number(item.finalQty),
        notes: item.notes,
      })) || [],
      createdAt: request.createdAt?.toISOString?.(),
      updatedAt: request.updatedAt?.toISOString?.(),
    };
  }

  private formatBagShipment(shipment: BagShipmentResponse) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      requestId: shipment.requestId,
      fromBranchId: shipment.fromBranchId,
      toBagId: shipment.toBagId,
      bagCode: shipment.bag?.bagCode,
      bagName: shipment.bag?.name,
      status: shipment.status,
      notes: shipment.notes,
      shippedBy: shipment.shippedBy,
      shippedAt: shipment.shippedAt?.toISOString?.(),
      receivedUserId: shipment.receivedUserId,
      receivedAt: shipment.receivedAt?.toISOString?.(),
      shipmentPhotoUrl: shipment.shipmentPhotoUrl,
      shipmentPhotoName: shipment.shipmentPhotoName,
      receiptFileUrl: shipment.receiptFileUrl,
      receiptFileName: shipment.receiptFileName,
      items: shipment.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        sentQty: Number(item.sentQty),
        receivedQty: item.receivedQty === null || item.receivedQty === undefined ? null : Number(item.receivedQty),
        discrepancyType: item.discrepancyType,
        discrepancyNotes: item.discrepancyNotes,
      })) || [],
      createdAt: shipment.createdAt?.toISOString?.(),
      updatedAt: shipment.updatedAt?.toISOString?.(),
    };
  }

  private formatBagUsage(usage: BagUsageResponse) {
    return {
      id: usage.id,
      usageCode: usage.usageCode,
      bagId: usage.bagId,
      bagCode: usage.bag?.bagCode,
      bagName: usage.bag?.name,
      teamId: usage.teamId,
      teamCode: usage.bag?.team?.teamCode,
      teamName: usage.bag?.team?.name,
      treatmentSessionId: usage.treatmentSessionId,
      usedBy: usage.usedBy,
      status: usage.status,
      usageDate: usage.usageDate?.toISOString?.(),
      notes: usage.notes,
      supportFileUrl: usage.supportFileUrl,
      supportFileName: usage.supportFileName,
      items: usage.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        quantity: Number(item.quantity),
        unit: item.unit,
        notes: item.notes,
      })) || [],
      createdAt: usage.createdAt?.toISOString?.(),
      updatedAt: usage.updatedAt?.toISOString?.(),
    };
  }

  private formatBagReturn(bagReturn: BagReturnResponse) {
    return {
      id: bagReturn.id,
      returnCode: bagReturn.returnCode,
      bagId: bagReturn.bagId,
      bagCode: bagReturn.bag?.bagCode,
      bagName: bagReturn.bag?.name,
      teamId: bagReturn.teamId,
      teamCode: bagReturn.bag?.team?.teamCode,
      teamName: bagReturn.bag?.team?.name,
      toBranchId: bagReturn.toBranchId,
      returnedBy: bagReturn.returnedBy,
      returnedAt: bagReturn.returnedAt?.toISOString?.(),
      receivedBy: bagReturn.receivedBy,
      receivedAt: bagReturn.receivedAt?.toISOString?.(),
      notes: bagReturn.notes,
      items: bagReturn.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        quantity: Number(item.quantity),
        isReusable: item.isReusable,
        condition: item.condition,
        notes: item.notes,
      })) || [],
      createdAt: bagReturn.createdAt?.toISOString?.(),
      updatedAt: bagReturn.updatedAt?.toISOString?.(),
    };
  }

  private formatBagOpname(opname: BagOpnameResponse) {
    return {
      id: opname.id,
      opnameCode: opname.opnameCode,
      bagId: opname.bagId,
      bagCode: opname.bag?.bagCode,
      bagName: opname.bag?.name,
      teamId: opname.teamId,
      teamCode: opname.bag?.team?.teamCode,
      teamName: opname.bag?.team?.name,
      status: opname.status,
      checkedBy: opname.checkedBy,
      checkedAt: opname.checkedAt?.toISOString?.(),
      notes: opname.notes,
      items: opname.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        systemQty: Number(item.systemQty),
        physicalQty: Number(item.physicalQty),
        difference: Number(item.difference),
        adjustmentCreated: item.adjustmentCreated,
        notes: item.notes,
      })) || [],
      createdAt: opname.createdAt?.toISOString?.(),
      updatedAt: opname.updatedAt?.toISOString?.(),
    };
  }
}
