import { randomUUID } from 'crypto';
import { Prisma, TreatmentBomStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { logAudit } from '@utils/auditLog';
import type {
  CreateTreatmentBomInput,
  TreatmentBomListQuery,
  UpdateTreatmentBomInput,
} from '../treatment-bom.schema';

type DbClient = Prisma.TransactionClient | typeof prisma;

const bomInclude = Prisma.validator<Prisma.TreatmentBomInclude>()({
  branch: { select: { id: true, branchCode: true, name: true } },
  packagePricing: {
    select: {
      id: true,
      productCode: true,
      name: true,
      packageType: true,
      boosterType: true,
      serviceType: true,
      totalSessions: true,
    },
  },
  items: {
    include: {
      masterProduct: {
        include: {
          baseUom: true,
          usageUom: true,
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
});

function bomCode(productCode: string | null, version: number): string {
  const prefix = (productCode || 'TREATMENT').replace(/[^A-Z0-9-]/gi, '-').toUpperCase();
  return `BOM-${prefix}-V${version}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function validateBomProducts(client: DbClient, items: CreateTreatmentBomInput['items']) {
  const productIds = items.map((item) => item.masterProductId);
  const products = await client.masterProduct.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, usageUnit: true },
  });
  if (products.length !== productIds.length) {
    throw errors.badRequest('BOM_PRODUCT_INVALID', 'Satu atau lebih product BOM tidak aktif atau tidak ditemukan.');
  }
  return new Map(products.map((product) => [product.id, product]));
}

export async function listTreatmentBoms(actorUserId: string, query: TreatmentBomListQuery) {
  await assertPermission(actorUserId, PERMISSIONS.TREATMENT_BOM_READ, query.branchId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const accessibleBranchIds = await getAccessibleBranchIds(actorUserId);
  const branchWhere: Prisma.TreatmentBomWhereInput = query.branchId
    ? { OR: [{ branchId: query.branchId }, { branchId: null }] }
    : accessibleBranchIds === null
      ? {}
      : { OR: [{ branchId: { in: accessibleBranchIds } }, { branchId: null }] };
  const searchWhere: Prisma.TreatmentBomWhereInput = query.search
    ? {
        OR: [
          { bomCode: { contains: query.search, mode: 'insensitive' } },
          { packagePricing: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      }
    : {};
  const where: Prisma.TreatmentBomWhereInput = {
    AND: [branchWhere, searchWhere],
    ...(query.packagePricingId ? { packagePricingId: query.packagePricingId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.treatmentBom.findMany({
      where,
      include: bomInclude,
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.treatmentBom.count({ where }),
  ]);
  return {
    data: rows,
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getTreatmentBom(actorUserId: string, bomId: string) {
  const bom = await prisma.treatmentBom.findUnique({ where: { id: bomId }, include: bomInclude });
  if (!bom) throw errors.notFound('Treatment BOM tidak ditemukan.');
  await assertPermission(actorUserId, PERMISSIONS.TREATMENT_BOM_READ, bom.branchId);
  if (bom.branchId) await assertBranchAccess(actorUserId, bom.branchId);
  return bom;
}

export async function createTreatmentBom(actorUserId: string, input: CreateTreatmentBomInput) {
  const pricing = await prisma.packagePricing.findUnique({ where: { id: input.packagePricingId } });
  if (!pricing?.isActive) throw errors.badRequest('BOM_PACKAGE_INVALID', 'Package pricing tidak aktif atau tidak ditemukan.');
  const effectiveBranchId = input.branchId ?? pricing.branchId ?? null;
  if (pricing.branchId && effectiveBranchId !== pricing.branchId) {
    throw errors.badRequest('BOM_BRANCH_MISMATCH', 'BOM harus mengikuti cabang package pricing.');
  }
  await assertPermission(actorUserId, PERMISSIONS.TREATMENT_BOM_MANAGE, effectiveBranchId);
  if (effectiveBranchId) await assertBranchAccess(actorUserId, effectiveBranchId);

  const result = await prisma.$transaction(async (tx) => {
    const products = await validateBomProducts(tx, input.items);
    const branchScopeKey = effectiveBranchId ?? 'GLOBAL';
    const latest = await tx.treatmentBom.findFirst({
      where: { packagePricingId: pricing.id, branchScopeKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    return tx.treatmentBom.create({
      data: {
        bomCode: bomCode(pricing.productCode, version),
        packagePricingId: pricing.id,
        branchId: effectiveBranchId,
        branchScopeKey,
        version,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        notes: input.notes,
        createdBy: actorUserId,
        items: {
          create: input.items.map((item) => ({
            masterProductId: item.masterProductId,
            recommendedQuantity: item.recommendedQuantity,
            tolerancePercent: item.tolerancePercent ?? 0,
            isRequired: item.isRequired ?? true,
            sortOrder: item.sortOrder ?? 0,
            notes: item.notes,
            unitSnapshot: products.get(item.masterProductId)!.usageUnit,
          })),
        },
      },
      include: bomInclude,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await logAudit({
    userId: actorUserId,
    branchId: effectiveBranchId,
    action: 'CREATE',
    resource: 'TreatmentBom',
    resourceId: result.id,
    afterData: { bomCode: result.bomCode, version: result.version, itemCount: result.items.length, status: result.status },
  });
  return result;
}

export async function updateTreatmentBom(actorUserId: string, bomId: string, input: UpdateTreatmentBomInput) {
  const existing = await prisma.treatmentBom.findUnique({ where: { id: bomId } });
  if (!existing) throw errors.notFound('Treatment BOM tidak ditemukan.');
  await assertPermission(actorUserId, PERMISSIONS.TREATMENT_BOM_MANAGE, existing.branchId);
  if (existing.branchId) await assertBranchAccess(actorUserId, existing.branchId);
  if (existing.status !== TreatmentBomStatus.DRAFT) {
    throw errors.conflict('BOM_IMMUTABLE', 'Hanya Treatment BOM berstatus DRAFT yang dapat diubah. Buat versi baru untuk koreksi.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const products = input.items ? await validateBomProducts(tx, input.items) : null;
    if (input.items) {
      await tx.treatmentBomItem.deleteMany({ where: { treatmentBomId: bomId } });
    }
    return tx.treatmentBom.update({
      where: { id: bomId },
      data: {
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        notes: input.notes,
        ...(input.items
          ? {
              items: {
                create: input.items.map((item) => ({
                  masterProductId: item.masterProductId,
                  recommendedQuantity: item.recommendedQuantity,
                  tolerancePercent: item.tolerancePercent ?? 0,
                  isRequired: item.isRequired ?? true,
                  sortOrder: item.sortOrder ?? 0,
                  notes: item.notes,
                  unitSnapshot: products!.get(item.masterProductId)!.usageUnit,
                })),
              },
            }
          : {}),
      },
      include: bomInclude,
    });
  });

  await logAudit({
    userId: actorUserId,
    branchId: existing.branchId,
    action: 'UPDATE',
    resource: 'TreatmentBom',
    resourceId: bomId,
    beforeData: { status: existing.status, effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo },
    afterData: { status: result.status, effectiveFrom: result.effectiveFrom, effectiveTo: result.effectiveTo, itemCount: result.items.length },
  });
  return result;
}

export async function activateTreatmentBom(actorUserId: string, bomId: string) {
  const existing = await prisma.treatmentBom.findUnique({ where: { id: bomId } });
  if (!existing) throw errors.notFound('Treatment BOM tidak ditemukan.');
  await assertPermission(actorUserId, PERMISSIONS.TREATMENT_BOM_MANAGE, existing.branchId);
  if (existing.branchId) await assertBranchAccess(actorUserId, existing.branchId);
  if (existing.status !== TreatmentBomStatus.DRAFT) {
    throw errors.conflict('BOM_ACTIVATION_INVALID', 'Hanya Treatment BOM DRAFT yang dapat diaktifkan.');
  }

  const activatedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "treatment_boms"
      WHERE "packagePricingId" = ${existing.packagePricingId}
        AND "branchScopeKey" = ${existing.branchScopeKey}
      ORDER BY "id"
      FOR UPDATE
    `);
    const itemCount = await tx.treatmentBomItem.count({ where: { treatmentBomId: bomId } });
    if (itemCount === 0) throw errors.unprocessable('BOM_ITEMS_REQUIRED', 'Treatment BOM harus memiliki minimal satu material.');
    await tx.treatmentBom.updateMany({
      where: {
        packagePricingId: existing.packagePricingId,
        branchScopeKey: existing.branchScopeKey,
        status: TreatmentBomStatus.ACTIVE,
        id: { not: bomId },
      },
      data: { status: TreatmentBomStatus.SUPERSEDED, effectiveTo: activatedAt, supersededById: bomId },
    });
    return tx.treatmentBom.update({
      where: { id: bomId },
      data: {
        status: TreatmentBomStatus.ACTIVE,
        activatedBy: actorUserId,
        activatedAt,
        effectiveFrom: existing.effectiveFrom ?? activatedAt,
      },
      include: bomInclude,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await logAudit({
    userId: actorUserId,
    branchId: existing.branchId,
    action: 'APPROVE',
    resource: 'TreatmentBom',
    resourceId: bomId,
    beforeData: { status: existing.status },
    afterData: { status: result.status, activatedAt },
  });
  return result;
}

export async function resolveSessionMaterialRecommendations(sessionId: string, client: DbClient = prisma) {
  const session = await client.treatmentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      branchId: true,
      treatmentDate: true,
      encounter: {
        select: {
          memberPackage: { select: { packagePricingId: true } },
        },
      },
      boosterPackage: { select: { packagePricingId: true } },
    },
  });
  if (!session) throw errors.notFound('Sesi tidak ditemukan.');
  const packagePricingIds = Array.from(new Set([
    session.encounter.memberPackage.packagePricingId,
    session.boosterPackage?.packagePricingId,
  ].filter((value): value is string => Boolean(value))));
  if (packagePricingIds.length === 0) {
    return { sessionId, branchId: session.branchId, hasActiveBom: false, boms: [], items: [] };
  }

  const occurredAt = session.treatmentDate;
  const candidates = await client.treatmentBom.findMany({
    where: {
      packagePricingId: { in: packagePricingIds },
      branchScopeKey: { in: [session.branchId, 'GLOBAL'] },
      status: TreatmentBomStatus.ACTIVE,
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: occurredAt } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: occurredAt } }] },
      ],
    },
    include: bomInclude,
    orderBy: [{ version: 'desc' }],
  });

  const selectedBoms = packagePricingIds.flatMap((pricingId) => {
    const matches = candidates.filter((candidate) => candidate.packagePricingId === pricingId);
    const branchBom = matches.find((candidate) => candidate.branchScopeKey === session.branchId);
    const globalBom = matches.find((candidate) => candidate.branchScopeKey === 'GLOBAL');
    return branchBom ? [branchBom] : globalBom ? [globalBom] : [];
  });
  const aggregate = new Map<string, {
    masterProductId: string;
    inventoryItemId: string | null;
    productName: string;
    sku: string | null;
    unit: string;
    recommendedQuantity: Prisma.Decimal;
    tolerancePercent: Prisma.Decimal;
    isRequired: boolean;
    treatmentBomItemId: string;
    sourceBomCodes: string[];
    sourceBomItemIds: string[];
  }>();
  selectedBoms.forEach((bom) => {
    bom.items.forEach((item) => {
      const current = aggregate.get(item.masterProductId);
      if (current) {
        current.recommendedQuantity = current.recommendedQuantity.add(item.recommendedQuantity);
        current.tolerancePercent = Prisma.Decimal.max(current.tolerancePercent, item.tolerancePercent);
        current.isRequired = current.isRequired || item.isRequired;
        current.sourceBomCodes.push(bom.bomCode);
        current.sourceBomItemIds.push(item.id);
      } else {
        aggregate.set(item.masterProductId, {
          masterProductId: item.masterProductId,
          inventoryItemId: null,
          productName: item.masterProduct.name,
          sku: item.masterProduct.sku,
          unit: item.unitSnapshot,
          recommendedQuantity: item.recommendedQuantity,
          tolerancePercent: item.tolerancePercent,
          isRequired: item.isRequired,
          treatmentBomItemId: item.id,
          sourceBomCodes: [bom.bomCode],
          sourceBomItemIds: [item.id],
        });
      }
    });
  });

  const inventoryItems = await client.inventoryItem.findMany({
    where: { branchId: session.branchId, masterProductId: { in: Array.from(aggregate.keys()) } },
    include: { balances: true, masterProduct: true },
  });
  const inventoryByProduct = new Map(inventoryItems.map((item) => [item.masterProductId, item]));
  const items = Array.from(aggregate.values()).map((item) => {
    const inventoryItem = inventoryByProduct.get(item.masterProductId);
    const availableBaseQuantity = inventoryItem
      ? inventoryItem.balances.reduce(
          (sum, balance) => sum.add(balance.onHandQty).sub(balance.reservedQty).sub(balance.quarantineQty),
          new Prisma.Decimal(0),
        )
      : new Prisma.Decimal(0);
    const conversionFactor = inventoryItem?.masterProduct.conversionFactor ?? new Prisma.Decimal(1);
    return {
      ...item,
      inventoryItemId: inventoryItem?.id ?? null,
      recommendedQuantity: item.recommendedQuantity.toFixed(4),
      tolerancePercent: item.tolerancePercent.toFixed(2),
      availableBaseQuantity: availableBaseQuantity.toFixed(4),
      availableUsageQuantity: availableBaseQuantity.mul(conversionFactor).toFixed(4),
      isAvailable: Boolean(inventoryItem) && availableBaseQuantity.greaterThan(0),
    };
  });
  return {
    sessionId,
    branchId: session.branchId,
    hasActiveBom: selectedBoms.length > 0,
    boms: selectedBoms.map((bom) => ({
      id: bom.id,
      bomCode: bom.bomCode,
      version: bom.version,
      packagePricingId: bom.packagePricingId,
      packageName: bom.packagePricing.name,
      branchId: bom.branchId,
    })),
    items,
  };
}

export async function getSessionMaterialRecommendations(actorUserId: string, sessionId: string) {
  const session = await prisma.treatmentSession.findUnique({ where: { id: sessionId }, select: { branchId: true } });
  if (!session) throw errors.notFound('Sesi tidak ditemukan.');
  await assertBranchAccess(actorUserId, session.branchId);
  await assertPermission(actorUserId, PERMISSIONS.TREATMENT_BOM_READ, session.branchId);
  return resolveSessionMaterialRecommendations(sessionId);
}
