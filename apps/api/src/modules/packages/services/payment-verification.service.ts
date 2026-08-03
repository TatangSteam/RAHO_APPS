import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { VerifyPaymentInput } from '../packages.schema';
import { PackageStatus, Prisma } from '@prisma/client';
import { InvoiceGenerationService } from './invoice-generation.service';
import { assertBranchAccess, assertPermission } from '../../iam/authorization.service';
import { PERMISSIONS } from '../../iam/permission-catalog';
import { consumeAddOnStockInTransaction } from './add-on-inventory.service';

type PackageWithMember = Prisma.MemberPackageGetPayload<{
  include: {
    member: {
      include: {
        user: true;
        registrationBranch: true;
      };
    };
  };
}>;

interface PaymentPlanInvoice {
  paymentPlanType: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
}

/**
 * Service for handling payment verification
 */
export class PaymentVerificationService {
  private invoiceService: InvoiceGenerationService;

  constructor() {
    this.invoiceService = new InvoiceGenerationService();
  }

  private getPaymentPlanStatus(invoice: PaymentPlanInvoice | null | undefined) {
    if (invoice?.paymentPlanType !== 'INSTALLMENT') {
      return 'PAID';
    }

    return Number(invoice.installmentNumber || 0) >= Number(invoice.installmentTotal || 0)
      ? 'PAID'
      : 'ACTIVE_INSTALLMENT';
  }

  /**
   * Verify payment for package or add-on
   */
  async verifyPayment(packageId: string, data: VerifyPaymentInput, branchId: string | undefined, userId: string) {
    // Try to find as package first
    const pkg = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: { 
        member: { 
          include: { 
            user: true,
            registrationBranch: true 
          } 
        } 
      },
    });

    // If not found as package, try as add-on
    if (!pkg) {
      return await this.verifyAddOnPayment(packageId, data, branchId, userId);
    }
    await assertBranchAccess(userId, pkg.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_PAYMENT, pkg.branchId);

    const pendingInvoice = await prisma.invoice.findFirst({
      where: {
        status: 'PENDING_PAYMENT',
        items: { some: { itemId: packageId } },
      },
      select: { totalAmount: true, paymentPlanType: true },
    });
    const isComplimentary = Boolean(
      pendingInvoice &&
      pendingInvoice.paymentPlanType !== 'INSTALLMENT' &&
      Number(pendingInvoice.totalAmount) === 0
    );

    if (!isComplimentary && !data.proofFileUrl) {
      throw {
        status: 400,
        code: 'PAYMENT_PROOF_REQUIRED',
        message: 'Bukti pembayaran wajib diupload',
      };
    }

    // Allow verification from PENDING_PAYMENT if staff provides payment proof
    if (pkg.status === PackageStatus.PENDING_PAYMENT && (data.proofFileUrl || isComplimentary)) {
      // Staff is uploading proof and verifying in one step
      // This is valid - proceed with verification
    } else if (
      pkg.status === PackageStatus.ACTIVE &&
      pkg.paymentPlanType === 'INSTALLMENT' &&
      pkg.paymentPlanStatus === 'ACTIVE_INSTALLMENT'
    ) {
      // Active installment package can still verify the next unpaid invoice.
    } else if (pkg.status !== PackageStatus.WAITING_VERIFICATION) {
      throw {
        status: 422,
        code: 'PACKAGE_NOT_WAITING_VERIFICATION',
        message: 'Paket tidak dalam status menunggu verifikasi',
      };
    }

    const now = new Date();

    // If this package is part of a group, verify all packages AND add-ons in the group
    if (pkg.purchaseGroupId) {
      return await this.verifyGroupPayment(pkg, data, userId, now);
    }

    // Single package verification
    return await this.verifySinglePackagePayment(pkg, data, userId, now);
  }

  /**
   * Reject payment for package or add-on
   */
  async rejectPayment(packageId: string, rejectionReason: string, branchId: string | undefined, userId: string) {
    // Try to find as package first
    const pkg = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: { 
        member: { 
          include: { 
            user: true,
            registrationBranch: true 
          } 
        } 
      },
    });

    // If not found as package, try as add-on
    if (!pkg) {
      return await this.rejectAddOnPayment(packageId, rejectionReason, branchId, userId);
    }
    await assertBranchAccess(userId, pkg.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_PAYMENT, pkg.branchId);

    if (pkg.status !== PackageStatus.WAITING_VERIFICATION) {
      throw {
        status: 422,
        code: 'PACKAGE_NOT_WAITING_VERIFICATION',
        message: 'Paket tidak dalam status menunggu verifikasi',
      };
    }

    const now = new Date();

    // If this package is part of a group, reject all packages AND add-ons in the group
    if (pkg.purchaseGroupId) {
      return await this.rejectGroupPayment(pkg, rejectionReason, userId, now);
    }

    // Single package rejection
    return await this.rejectSinglePackagePayment(pkg, rejectionReason, userId, now);
  }

  /**
   * Verify add-on payment
   */
  private async verifyAddOnPayment(addOnId: string, data: VerifyPaymentInput, branchId: string | undefined, userId: string) {
    const addon = await prisma.memberAddOn.findUnique({
      where: { id: addOnId },
      include: {
        member: {
          include: {
            user: true,
            registrationBranch: true
          }
        }
      },
    });

    if (!addon) {
      throw { status: 404, code: 'ITEM_NOT_FOUND', message: 'Paket atau add-on tidak ditemukan' };
    }
    await assertBranchAccess(userId, addon.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_PAYMENT, addon.branchId);

    if (addon.status === PackageStatus.PENDING_PAYMENT && data.proofFileUrl) {
      // Staff is uploading proof and verifying in one step.
    } else if (
      addon.status === PackageStatus.ACTIVE &&
      addon.paymentPlanType === 'INSTALLMENT' &&
      addon.paymentPlanStatus === 'ACTIVE_INSTALLMENT'
    ) {
      // Active installment add-on can still verify the next unpaid invoice.
    } else if (addon.status !== PackageStatus.WAITING_VERIFICATION) {
      throw {
        status: 422,
        code: 'ITEM_NOT_WAITING_VERIFICATION',
        message: 'Add-on tidak dalam status menunggu verifikasi',
      };
    }

    const now = new Date();

    const paidInvoice = await this.invoiceService.verifyActiveInvoiceForPurchase(
      [],
      [addon],
      addon.member,
      userId,
      data
    );

    const updatedAddOn = await prisma.$transaction(async (tx) => {
      await consumeAddOnStockInTransaction(addOnId, userId, now, tx);
      return tx.memberAddOn.update({
        where: { id: addOnId },
        data: {
          status: PackageStatus.ACTIVE,
          paidAt: now,
          verifiedBy: userId,
          verifiedAt: now,
          totalVerifiedPaid: { increment: data.paidAmount || Number(paidInvoice?.totalAmount || addon.totalPrice || 0) },
          paymentPlanStatus: this.getPaymentPlanStatus(paidInvoice),
          paymentProofUrl: data.proofFileUrl,
          paymentProofFileName: data.proofFileName,
          paymentProofFileSize: data.proofFileSize,
          paymentProofMimeType: data.proofMimeType,
        },
      });
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: addon.member.userId,
        type: 'INFO',
        title: 'Add-On Aktif',
        body: `Add-on Anda telah aktif ✅`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: 'VERIFY_PAYMENT',
      resource: 'MemberAddOn',
      resourceId: addOnId,
      entityType: 'MemberAddOn',
      entityId: addOnId,
      description: 'Pembayaran add-on berhasil diverifikasi.',
      meta: { action: 'VERIFY_PAYMENT', status: 'ACTIVE', proofFile: data.proofFileName },
    });

    return { addOn: updatedAddOn, message: 'Pembayaran add-on berhasil diverifikasi' };
  }

  /**
   * Verify group payment (multiple packages and add-ons)
   */
  private async verifyGroupPayment(pkg: PackageWithMember, data: VerifyPaymentInput, userId: string, now: Date) {
    // Get all packages in the group
    const groupPackages = await prisma.memberPackage.findMany({
      where: { purchaseGroupId: pkg.purchaseGroupId },
    });

    const packageIds = groupPackages.map(p => p.id);

    // Get all add-ons linked to any package in the group
    const groupAddOns = await prisma.memberAddOn.findMany({
      where: { 
        packageId: { in: packageIds }
      },
    });

    const paidInvoice = await this.invoiceService.verifyActiveInvoiceForPurchase(
      groupPackages,
      groupAddOns,
      pkg.member,
      userId,
      data
    );
    const verifiedAmount = data.paidAmount || Number(paidInvoice?.totalAmount || 0);
    const paymentPlanStatus = this.getPaymentPlanStatus(paidInvoice);

    await prisma.$transaction(async (tx) => {
      for (const groupAddOn of groupAddOns) {
        await consumeAddOnStockInTransaction(groupAddOn.id, userId, now, tx);
      }
      await tx.memberPackage.updateMany({
        where: { purchaseGroupId: pkg.purchaseGroupId },
        data: {
          status: PackageStatus.ACTIVE,
          paidAt: now,
          verifiedBy: userId,
          verifiedAt: now,
          activatedAt: now,
          totalVerifiedPaid: { increment: verifiedAmount },
          paymentPlanStatus,
          paymentProofUrl: data.proofFileUrl,
          paymentProofFileName: data.proofFileName,
          paymentProofFileSize: data.proofFileSize,
          paymentProofMimeType: data.proofMimeType,
        },
      });
      if (groupAddOns.length > 0) {
        await tx.memberAddOn.updateMany({
          where: { packageId: { in: packageIds } },
          data: {
            status: PackageStatus.ACTIVE,
            paidAt: now,
            verifiedBy: userId,
            verifiedAt: now,
            totalVerifiedPaid: { increment: verifiedAmount },
            paymentPlanStatus,
            paymentProofUrl: data.proofFileUrl,
            paymentProofFileName: data.proofFileName,
            paymentProofFileSize: data.proofFileSize,
            paymentProofMimeType: data.proofMimeType,
          },
        });
      }
    });

    // NOTE: Payment record is already created inside the invoice service.
    // No need to create another one here

    const totalItems = groupPackages.length + groupAddOns.length;

    // Send notification to member
    await prisma.notification.create({
      data: {
        userId: pkg.member.userId,
        type: 'INFO',
        title: 'Paket Aktif',
        body: `${totalItems} item Anda telah aktif dan siap digunakan ✅`,
        status: 'UNREAD',
      },
    });

    // Audit log for each package
    for (const groupPkg of groupPackages) {
      await logAudit({
        userId,
        action: 'VERIFY_PAYMENT',
        resource: 'MemberPackage',
        resourceId: groupPkg.id,
        entityType: 'MemberPackage',
        entityId: groupPkg.id,
        description: 'Pembayaran paket dalam grup berhasil diverifikasi.',
        meta: { 
          action: 'VERIFY_PAYMENT_GROUP', 
          status: 'ACTIVE', 
          purchaseGroupId: pkg.purchaseGroupId, 
          proofFile: data.proofFileName 
        },
      });
    }

    // Audit log for each add-on
    for (const groupAddOn of groupAddOns) {
      await logAudit({
        userId,
        action: 'VERIFY_PAYMENT',
        resource: 'MemberAddOn',
        resourceId: groupAddOn.id,
        entityType: 'MemberAddOn',
        entityId: groupAddOn.id,
        description: 'Pembayaran add-on dalam grup berhasil diverifikasi.',
        meta: { 
          action: 'VERIFY_PAYMENT_GROUP', 
          status: 'ACTIVE', 
          purchaseGroupId: pkg.purchaseGroupId, 
          proofFile: data.proofFileName 
        },
      });
    }

    return { 
      packages: groupPackages.length,
      addOns: groupAddOns.length,
      message: `${totalItems} item berhasil diverifikasi` 
    };
  }

  /**
   * Verify single package payment
   */
  private async verifySinglePackagePayment(pkg: PackageWithMember, data: VerifyPaymentInput, userId: string, now: Date) {
    const paidInvoice = await this.invoiceService.verifyActiveInvoiceForPurchase(
      [pkg],
      undefined,
      pkg.member,
      userId,
      data
    );

    const updatedPackage = await prisma.memberPackage.update({
      where: { id: pkg.id },
      data: {
        status: PackageStatus.ACTIVE,
        paidAt: now,
        verifiedBy: userId,
        verifiedAt: now,
        totalVerifiedPaid: { increment: data.paidAmount || Number(paidInvoice?.totalAmount || pkg.finalPrice || 0) },
        paymentPlanStatus: this.getPaymentPlanStatus(paidInvoice),
        paymentProofUrl: data.proofFileUrl,
        paymentProofFileName: data.proofFileName,
        paymentProofFileSize: data.proofFileSize,
        paymentProofMimeType: data.proofMimeType,
        activatedAt: now,
        notes: data.notes || pkg.notes,
      },
    });

    // NOTE: Payment record is already created inside the invoice service.
    // No need to create another one here

    // Send notification to member
    await prisma.notification.create({
      data: {
        userId: pkg.member.userId,
        type: 'INFO',
        title: 'Paket Aktif',
        body: `Paket ${pkg.packageType} Anda telah aktif dan siap digunakan ✅`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: 'VERIFY_PAYMENT',
      resource: 'MemberPackage',
      resourceId: pkg.id,
      entityType: 'MemberPackage',
      entityId: pkg.id,
      description: 'Pembayaran paket berhasil diverifikasi.',
      meta: { action: 'VERIFY_PAYMENT', status: 'ACTIVE', proofFile: data.proofFileName },
    });

    return { package: updatedPackage, message: 'Pembayaran berhasil diverifikasi' };
  }

  /**
   * Reject add-on payment
   */
  private async rejectAddOnPayment(addOnId: string, rejectionReason: string, branchId: string | undefined, userId: string) {
    const addon = await prisma.memberAddOn.findUnique({
      where: { id: addOnId },
      include: {
        member: {
          include: {
            user: true,
            registrationBranch: true
          }
        }
      },
    });

    if (!addon) {
      throw { status: 404, code: 'ITEM_NOT_FOUND', message: 'Paket atau add-on tidak ditemukan' };
    }
    await assertBranchAccess(userId, addon.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_PAYMENT, addon.branchId);

    if (addon.status !== PackageStatus.WAITING_VERIFICATION) {
      throw {
        status: 422,
        code: 'ITEM_NOT_WAITING_VERIFICATION',
        message: 'Add-on tidak dalam status menunggu verifikasi',
      };
    }

    const now = new Date();

    const updatedAddOn = await prisma.memberAddOn.update({
      where: { id: addOnId },
      data: {
        status: PackageStatus.PENDING_PAYMENT,
        rejectedBy: userId,
        rejectedAt: now,
        rejectionReason: rejectionReason,
        // Clear payment proof data since it was rejected
        paymentProofUrl: null,
        paymentProofFileName: null,
        paymentProofFileSize: null,
        paymentProofMimeType: null,
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: addon.member.userId,
        type: 'INFO',
        title: 'Pembayaran Add-On Ditolak',
        body: `Pembayaran add-on Anda ditolak. Alasan: ${rejectionReason}`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: 'REJECT_PAYMENT',
      resource: 'MemberAddOn',
      resourceId: addOnId,
      entityType: 'MemberAddOn',
      entityId: addOnId,
      description: 'Pembayaran add-on ditolak.',
      meta: { action: 'REJECT_PAYMENT', status: 'PENDING_PAYMENT', rejectionReason },
    });

    return { addOn: updatedAddOn, message: 'Pembayaran add-on berhasil ditolak' };
  }

  /**
   * Reject group payment (multiple packages and add-ons)
   */
  private async rejectGroupPayment(pkg: PackageWithMember, rejectionReason: string, userId: string, now: Date) {
    // Get all packages in the group
    const groupPackages = await prisma.memberPackage.findMany({
      where: { purchaseGroupId: pkg.purchaseGroupId },
    });

    const packageIds = groupPackages.map(p => p.id);

    // Get all add-ons linked to any package in the group
    const groupAddOns = await prisma.memberAddOn.findMany({
      where: { 
        packageId: { in: packageIds }
      },
    });

    // Update all packages in the group
    await prisma.memberPackage.updateMany({
      where: { purchaseGroupId: pkg.purchaseGroupId },
      data: {
        status: PackageStatus.PENDING_PAYMENT,
        rejectedBy: userId,
        rejectedAt: now,
        rejectionReason: rejectionReason,
        // Clear payment proof data since it was rejected
        paymentProofUrl: null,
        paymentProofFileName: null,
        paymentProofFileSize: null,
        paymentProofMimeType: null,
      },
    });

    // Update all add-ons in the group
    if (groupAddOns.length > 0) {
      await prisma.memberAddOn.updateMany({
        where: { 
          packageId: { in: packageIds }
        },
        data: {
          status: PackageStatus.PENDING_PAYMENT,
          rejectedBy: userId,
          rejectedAt: now,
          rejectionReason: rejectionReason,
          // Clear payment proof data since it was rejected
          paymentProofUrl: null,
          paymentProofFileName: null,
          paymentProofFileSize: null,
          paymentProofMimeType: null,
        },
      });
    }

    const totalItems = groupPackages.length + groupAddOns.length;

    // Send notification to member
    await prisma.notification.create({
      data: {
        userId: pkg.member.userId,
        type: 'INFO',
        title: 'Pembayaran Paket Ditolak',
        body: `Pembayaran ${totalItems} item ditolak. Alasan: ${rejectionReason}`,
        status: 'UNREAD',
      },
    });

    // Audit log for each package
    for (const groupPkg of groupPackages) {
      await logAudit({
        userId,
        action: 'REJECT_PAYMENT',
        resource: 'MemberPackage',
        resourceId: groupPkg.id,
        entityType: 'MemberPackage',
        entityId: groupPkg.id,
        description: 'Pembayaran paket dalam grup ditolak.',
        meta: { 
          action: 'REJECT_PAYMENT_GROUP', 
          status: 'PENDING_PAYMENT', 
          purchaseGroupId: pkg.purchaseGroupId, 
          rejectionReason
        },
      });
    }

    // Audit log for each add-on
    for (const groupAddOn of groupAddOns) {
      await logAudit({
        userId,
        action: 'REJECT_PAYMENT',
        resource: 'MemberAddOn',
        resourceId: groupAddOn.id,
        entityType: 'MemberAddOn',
        entityId: groupAddOn.id,
        description: 'Pembayaran add-on dalam grup ditolak.',
        meta: { 
          action: 'REJECT_PAYMENT_GROUP', 
          status: 'PENDING_PAYMENT', 
          purchaseGroupId: pkg.purchaseGroupId, 
          rejectionReason
        },
      });
    }

    return { 
      packages: groupPackages.length,
      addOns: groupAddOns.length,
      message: `${totalItems} item berhasil ditolak` 
    };
  }

  /**
   * Reject single package payment
   */
  private async rejectSinglePackagePayment(pkg: PackageWithMember, rejectionReason: string, userId: string, now: Date) {
    const updatedPackage = await prisma.memberPackage.update({
      where: { id: pkg.id },
      data: {
        status: PackageStatus.PENDING_PAYMENT,
        rejectedBy: userId,
        rejectedAt: now,
        rejectionReason: rejectionReason,
        // Clear payment proof data since it was rejected
        paymentProofUrl: null,
        paymentProofFileName: null,
        paymentProofFileSize: null,
        paymentProofMimeType: null,
      },
    });

    // Send notification to member
    await prisma.notification.create({
      data: {
        userId: pkg.member.userId,
        type: 'INFO',
        title: 'Pembayaran Paket Ditolak',
        body: `Pembayaran paket ${pkg.packageType} ditolak. Alasan: ${rejectionReason}`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: 'REJECT_PAYMENT',
      resource: 'MemberPackage',
      resourceId: pkg.id,
      entityType: 'MemberPackage',
      entityId: pkg.id,
      description: 'Pembayaran paket ditolak.',
      meta: { action: 'REJECT_PAYMENT', status: 'PENDING_PAYMENT', rejectionReason },
    });

    return { package: updatedPackage, message: 'Pembayaran berhasil ditolak' };
  }
}
