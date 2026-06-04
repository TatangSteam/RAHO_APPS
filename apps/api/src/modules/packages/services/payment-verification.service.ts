// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { VerifyPaymentInput } from '../packages.schema';
import { PackageStatus, AuditAction } from '@prisma/client';
import { InvoiceGenerationService } from './invoice-generation.service';

/**
 * Service for handling payment verification
 */
export class PaymentVerificationService {
  private invoiceService: InvoiceGenerationService;

  constructor() {
    this.invoiceService = new InvoiceGenerationService();
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

    // Allow verification from PENDING_PAYMENT if staff provides payment proof
    if (pkg.status === PackageStatus.PENDING_PAYMENT && data.proofFileUrl) {
      // Staff is uploading proof and verifying in one step
      // This is valid - proceed with verification
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
        status: PackageStatus.ACTIVE,
        paidAt: now,
        verifiedBy: userId,
        verifiedAt: now,
        paymentProofUrl: data.proofFileUrl,
        paymentProofFileName: data.proofFileName,
        paymentProofFileSize: data.proofFileSize,
        paymentProofMimeType: data.proofMimeType,
      },
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
      action: AuditAction.UPDATE,
      resource: 'MemberAddOn',
      resourceId: addOnId,
      meta: { action: 'VERIFY_PAYMENT', status: 'ACTIVE', proofFile: data.proofFileName },
    });

    return { addOn: updatedAddOn, message: 'Pembayaran add-on berhasil diverifikasi' };
  }

  /**
   * Verify group payment (multiple packages and add-ons)
   */
  private async verifyGroupPayment(pkg: any, data: VerifyPaymentInput, userId: string, now: Date) {
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
        status: PackageStatus.ACTIVE,
        paidAt: now,
        verifiedBy: userId,
        verifiedAt: now,
        activatedAt: now,
        paymentProofUrl: data.proofFileUrl,
        paymentProofFileName: data.proofFileName,
        paymentProofFileSize: data.proofFileSize,
        paymentProofMimeType: data.proofMimeType,
      },
    });

    // Update all add-ons in the group
    if (groupAddOns.length > 0) {
      await prisma.memberAddOn.updateMany({
        where: { 
          packageId: { in: packageIds }
        },
        data: {
          status: PackageStatus.ACTIVE,
          paidAt: now,
          verifiedBy: userId,
          verifiedAt: now,
          paymentProofUrl: data.proofFileUrl,
          paymentProofFileName: data.proofFileName,
          paymentProofFileSize: data.proofFileSize,
          paymentProofMimeType: data.proofMimeType,
        },
      });
    }

    // Refetch packages with updated payment proof data for invoice generation
    const updatedPackages = await prisma.memberPackage.findMany({
      where: { purchaseGroupId: pkg.purchaseGroupId },
    });

    // Auto-generate invoice for the group (this also creates payment record with proof)
    await this.invoiceService.generateInvoiceForPackages(updatedPackages, pkg.member, userId);

    // NOTE: Payment record is already created inside generateInvoiceForPackages
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
        action: AuditAction.UPDATE,
        resource: 'MemberPackage',
        resourceId: groupPkg.id,
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
        action: AuditAction.UPDATE,
        resource: 'MemberAddOn',
        resourceId: groupAddOn.id,
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
  private async verifySinglePackagePayment(pkg: any, data: VerifyPaymentInput, userId: string, now: Date) {
    const updatedPackage = await prisma.memberPackage.update({
      where: { id: pkg.id },
      data: {
        status: PackageStatus.ACTIVE,
        paidAt: now,
        verifiedBy: userId,
        verifiedAt: now,
        paymentProofUrl: data.proofFileUrl,
        paymentProofFileName: data.proofFileName,
        paymentProofFileSize: data.proofFileSize,
        paymentProofMimeType: data.proofMimeType,
        activatedAt: now,
        notes: data.notes || pkg.notes,
      },
    });

    // Auto-generate invoice for single package (this also creates payment record with proof)
    await this.invoiceService.generateInvoiceForPackages([updatedPackage], pkg.member, userId);

    // NOTE: Payment record is already created inside generateInvoiceForPackages
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
      action: AuditAction.UPDATE,
      resource: 'MemberPackage',
      resourceId: pkg.id,
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
        type: 'WARNING',
        title: 'Pembayaran Add-On Ditolak',
        body: `Pembayaran add-on Anda ditolak. Alasan: ${rejectionReason}`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'MemberAddOn',
      resourceId: addOnId,
      meta: { action: 'REJECT_PAYMENT', status: 'PENDING_PAYMENT', rejectionReason },
    });

    return { addOn: updatedAddOn, message: 'Pembayaran add-on berhasil ditolak' };
  }

  /**
   * Reject group payment (multiple packages and add-ons)
   */
  private async rejectGroupPayment(pkg: any, rejectionReason: string, userId: string, now: Date) {
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
        type: 'WARNING',
        title: 'Pembayaran Paket Ditolak',
        body: `Pembayaran ${totalItems} item ditolak. Alasan: ${rejectionReason}`,
        status: 'UNREAD',
      },
    });

    // Audit log for each package
    for (const groupPkg of groupPackages) {
      await logAudit({
        userId,
        action: AuditAction.UPDATE,
        resource: 'MemberPackage',
        resourceId: groupPkg.id,
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
        action: AuditAction.UPDATE,
        resource: 'MemberAddOn',
        resourceId: groupAddOn.id,
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
  private async rejectSinglePackagePayment(pkg: any, rejectionReason: string, userId: string, now: Date) {
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
        type: 'WARNING',
        title: 'Pembayaran Paket Ditolak',
        body: `Pembayaran paket ${pkg.packageType} ditolak. Alasan: ${rejectionReason}`,
        status: 'UNREAD',
      },
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'MemberPackage',
      resourceId: pkg.id,
      meta: { action: 'REJECT_PAYMENT', status: 'PENDING_PAYMENT', rejectionReason },
    });

    return { package: updatedPackage, message: 'Pembayaran berhasil ditolak' };
  }
}
