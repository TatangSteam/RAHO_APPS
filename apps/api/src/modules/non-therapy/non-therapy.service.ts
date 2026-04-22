// @ts-nocheck
import { prisma } from '../../lib/prisma';
import { logAudit } from '../../utils/auditLog';
import type {
  CreateNonTherapyProductInput,
  UpdateNonTherapyProductInput,
  AssignNonTherapyToMemberInput,
  VerifyNonTherapyPurchaseInput,
} from './non-therapy.schema';
import { PackageStatus, AuditAction } from '@prisma/client';

export class NonTherapyService {
  // Generate purchase code
  private generatePurchaseCode(branchCode: string, _sequence: number): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();

    return `NTP-${branchCode}-${year}${month}-${random}`;
  }

  // ============================================================
  // PRODUCT MANAGEMENT
  // ============================================================

  async getAllProducts(filters?: { productType?: string; isActive?: boolean }) {
    const where: any = {};

    if (filters?.productType) {
      where.productType = filters.productType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const products = await prisma.nonTherapyProduct.findMany({
      where,
      orderBy: [{ productType: 'asc' }, { productCode: 'asc' }],
    });

    return products.map((p) => ({
      id: p.id,
      productCode: p.productCode,
      productType: p.productType,
      name: p.name,
      description: p.description,
      airNanoColor: p.airNanoColor,
      airNanoVolume: p.airNanoVolume,
      airNanoUnit: p.airNanoUnit,
      pricePerUnit: Number(p.pricePerUnit),
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async getProductById(productId: string) {
    const product = await prisma.nonTherapyProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' };
    }

    return {
      id: product.id,
      productCode: product.productCode,
      productType: product.productType,
      name: product.name,
      description: product.description,
      airNanoColor: product.airNanoColor,
      airNanoVolume: product.airNanoVolume,
      airNanoUnit: product.airNanoUnit,
      pricePerUnit: Number(product.pricePerUnit),
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  async createProduct(data: CreateNonTherapyProductInput, userId: string) {
    // Check for duplicate product code
    const existing = await prisma.nonTherapyProduct.findUnique({
      where: { productCode: data.productCode },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'PRODUCT_CODE_EXISTS',
        message: 'Product code already exists',
      };
    }

    const product = await prisma.nonTherapyProduct.create({
      data: {
        ...data,
        isActive: true,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'NonTherapyProduct',
      resourceId: product.id,
      meta: { productCode: data.productCode, productType: data.productType },
    });

    return {
      ...product,
      pricePerUnit: Number(product.pricePerUnit),
    };
  }

  async updateProduct(productId: string, data: UpdateNonTherapyProductInput, userId: string) {
    const product = await prisma.nonTherapyProduct.update({
      where: { id: productId },
      data,
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'NonTherapyProduct',
      resourceId: productId,
      meta: data,
    });

    return {
      ...product,
      pricePerUnit: Number(product.pricePerUnit),
    };
  }

  async deleteProduct(productId: string, userId: string) {
    // Soft delete by setting isActive to false
    await prisma.nonTherapyProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });

    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'NonTherapyProduct',
      resourceId: productId,
      meta: {},
    });

    return { message: 'Product deleted successfully' };
  }

  // ============================================================
  // MEMBER PURCHASES
  // ============================================================

  async assignToMember(
    memberId: string,
    data: AssignNonTherapyToMemberInput,
    branchId: string,
    userId: string
  ) {
    // Validate member access
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
        branchAccesses: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member not found' };
    }

    // Check if staff has access to this member
    const hasAccess =
      member.registrationBranchId === branchId ||
      member.branchAccesses.some((access) => access.branchId === branchId);

    if (!hasAccess) {
      throw {
        status: 403,
        code: 'MEMBER_ACCESS_DENIED',
        message: 'You do not have access to this member',
      };
    }

    // Get product
    const product = await prisma.nonTherapyProduct.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw { status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' };
    }

    if (!product.isActive) {
      throw { status: 400, code: 'PRODUCT_INACTIVE', message: 'Product is not active' };
    }

    // Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Branch not found' };
    }

    // Generate purchase code
    const lastPurchase = await prisma.memberNonTherapyPurchase.findFirst({
      where: { purchaseCode: { startsWith: `NTP-${branch.branchCode}` } },
      orderBy: { purchaseCode: 'desc' },
    });
    const sequence = lastPurchase ? 1 : 1;
    const purchaseCode = this.generatePurchaseCode(branch.branchCode, sequence);

    // Calculate total price
    const pricePerUnit = Number(product.pricePerUnit);
    const totalPrice = pricePerUnit * data.quantity;

    // Create purchase
    const purchase = await prisma.memberNonTherapyPurchase.create({
      data: {
        purchaseCode,
        memberId,
        branchId,
        productId: data.productId,
        quantity: data.quantity,
        pricePerUnit,
        totalPrice,
        status: PackageStatus.PENDING_PAYMENT,
        notes: data.notes,
        assignedBy: userId,
      },
      include: {
        product: true,
        branch: true,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'MemberNonTherapyPurchase',
      resourceId: purchase.id,
      meta: { memberId, productId: data.productId, quantity: data.quantity },
    });

    return {
      id: purchase.id,
      purchaseCode: purchase.purchaseCode,
      product: {
        id: purchase.product.id,
        name: purchase.product.name,
        productCode: purchase.product.productCode,
      },
      quantity: purchase.quantity,
      pricePerUnit: Number(purchase.pricePerUnit),
      totalPrice: Number(purchase.totalPrice),
      status: purchase.status,
      notes: purchase.notes,
      branchName: purchase.branch.name,
      createdAt: purchase.createdAt.toISOString(),
      message: 'Product assigned successfully',
    };
  }

  async getMemberPurchases(memberId: string, _branchId: string) {
    const purchases = await prisma.memberNonTherapyPurchase.findMany({
      where: { memberId },
      include: {
        product: true,
        branch: true,
        assignedByUser: { include: { profile: true } },
        verifiedByUser: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return purchases.map((p) => ({
      id: p.id,
      purchaseCode: p.purchaseCode,
      product: {
        id: p.product.id,
        name: p.product.name,
        productCode: p.product.productCode,
        productType: p.product.productType,
      },
      quantity: p.quantity,
      pricePerUnit: Number(p.pricePerUnit),
      totalPrice: Number(p.totalPrice),
      status: p.status,
      notes: p.notes,
      branchName: p.branch.name,
      assignedBy: p.assignedByUser.profile?.fullName || 'Unknown',
      verifiedBy: p.verifiedByUser?.profile?.fullName,
      paidAt: p.paidAt?.toISOString(),
      verifiedAt: p.verifiedAt?.toISOString(),
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async verifyPurchase(purchaseId: string, data: VerifyNonTherapyPurchaseInput, userId: string) {
    const purchase = await prisma.memberNonTherapyPurchase.findUnique({
      where: { id: purchaseId },
      include: { member: { include: { user: true } } },
    });

    if (!purchase) {
      throw { status: 404, code: 'PURCHASE_NOT_FOUND', message: 'Purchase not found' };
    }

    if (purchase.status !== PackageStatus.PENDING_PAYMENT) {
      throw {
        status: 422,
        code: 'PURCHASE_NOT_PENDING',
        message: 'Purchase is not pending payment',
      };
    }

    const now = new Date();
    const updatedPurchase = await prisma.memberNonTherapyPurchase.update({
      where: { id: purchaseId },
      data: {
        status: PackageStatus.ACTIVE,
        paidAt: now,
        verifiedBy: userId,
        verifiedAt: now,
        notes: data.notes || purchase.notes,
      },
    });

    // Send notification to member
    await prisma.notification.create({
      data: {
        userId: purchase.member.userId,
        type: 'INFO',
        title: 'Purchase Verified',
        body: `Your purchase has been verified and is now active ✅`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'MemberNonTherapyPurchase',
      resourceId: purchaseId,
      meta: { action: 'VERIFY_PAYMENT', status: 'ACTIVE' },
    });

    return {
      purchase: {
        ...updatedPurchase,
        pricePerUnit: Number(updatedPurchase.pricePerUnit),
        totalPrice: Number(updatedPurchase.totalPrice),
      },
      message: 'Payment verified successfully',
    };
  }
}
