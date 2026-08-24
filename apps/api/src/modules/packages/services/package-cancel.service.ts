import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { releaseAddOnStockInTransaction } from './add-on-inventory.service';

interface CancelPackageInput {
  reason: string;
}

/**
 * Package Cancel Service
 * Handles cancelling PENDING_PAYMENT packages
 */
export class PackageCancelService {
  /**
   * Cancel a PENDING_PAYMENT package
   * - Only PENDING_PAYMENT packages can be cancelled
   * - Package status → CANCELLED
   * - Invoice status → CANCELLED (if exists)
   * - If package is part of a bundle (has purchaseGroupId), cancel ALL packages in the bundle
   * - Audit log created
   */
  async cancelPackage(
    packageId: string,
    data: CancelPackageInput,
    userId: string,
    _branchId: string | null
  ) {
    // 1. Fetch package with relations
    const memberPackage = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: {
        member: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
        branch: true
      }
    });

    if (!memberPackage) {
      return this.cancelStandaloneAddOn(packageId, data, userId);
    }

    if (memberPackage.socialProgramRequestId) {
      throw {
        status: 409,
        code: 'SOCIAL_PROGRAM_PACKAGE_LOCKED',
        message: 'Paket Program Sosial tidak dapat dibatalkan dari alur paket biasa.',
      };
    }

    // 2. Validate status
    if (memberPackage.status !== 'PENDING_PAYMENT') {
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: 'Hanya paket dengan status PENDING_PAYMENT yang bisa dibatalkan'
      };
    }

    // 3. Check if this package is part of a bundle
    const purchaseGroupId = memberPackage.purchaseGroupId;
    let packagesToCancel: string[] = [packageId];
    let addOnsToCancel: string[] = [];
    
    if (purchaseGroupId) {
      // Find all packages in the same bundle
      const bundlePackages = await prisma.memberPackage.findMany({
        where: {
          purchaseGroupId: purchaseGroupId,
          status: 'PENDING_PAYMENT'
        },
        select: { id: true }
      });
      
      packagesToCancel = bundlePackages.map(p => p.id);
    }

    const packagesToCancelData = await prisma.memberPackage.findMany({
      where: {
        id: { in: packagesToCancel }
      },
      select: {
        id: true,
        packageCode: true,
        usedSessions: true
      }
    });

    const usedPackages = packagesToCancelData.filter(pkg => pkg.usedSessions > 0);
    if (usedPackages.length > 0) {
      throw {
        status: 422,
        code: 'PACKAGE_ALREADY_USED',
        message: `Paket ${usedPackages.map(pkg => pkg.packageCode).join(', ')} sudah dipakai untuk sesi utang dan tidak bisa dibatalkan. Verifikasi pembayaran untuk melanjutkan.`
      };
    }

    if (purchaseGroupId) {
      // Also find add-ons in the same bundle
      const bundleAddOns = await prisma.memberAddOn.findMany({
        where: {
          packageId: { in: packagesToCancel },
          status: 'PENDING_PAYMENT'
        },
        select: { id: true }
      });
      
      addOnsToCancel = bundleAddOns.map((addOn) => addOn.id);
    }

    // 4. Find related invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        memberId: memberPackage.memberId,
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
        items: {
          some: {
            itemId: { in: packagesToCancel },
            itemType: 'PACKAGE'
          }
        }
      }
    });

    const cancelledAt = new Date();
    await prisma.$transaction(async (tx) => {
      for (const addOnId of addOnsToCancel) {
        await releaseAddOnStockInTransaction(addOnId, userId, data.reason, tx);
      }
      if (addOnsToCancel.length > 0) {
        await tx.memberAddOn.updateMany({
          where: { id: { in: addOnsToCancel } },
          data: { status: 'CANCELLED', updatedAt: cancelledAt },
        });
      }
      await tx.memberPackage.updateMany({
        where: { id: { in: packagesToCancel } },
        data: { status: 'CANCELLED', updatedAt: cancelledAt },
      });
      await tx.memberPackage.update({
        where: { id: packageId },
        data: {
          notes: memberPackage.notes
            ? `${memberPackage.notes}\n\n[CANCELLED] ${data.reason}`
            : `[CANCELLED] ${data.reason}`,
        },
      });
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'CANCELLED',
            cancelledAt,
            notes: invoice.notes
              ? `${invoice.notes}\n\n[CANCELLED] ${data.reason}`
              : `[CANCELLED] ${data.reason}`,
          },
        });
      }
    });

    // 6. Get updated package for response
    const updatedPackage = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: {
        member: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
        branch: true,
        packagePricing: true
      }
    });

    // 8. Create audit log
    await logAudit({
      userId,
      action: 'UPDATE',
      resource: 'MemberPackage',
      resourceId: packageId,
      meta: {
        action: 'CANCEL',
        reason: data.reason,
        previousStatus: 'PENDING_PAYMENT',
        newStatus: 'CANCELLED',
        memberNo: memberPackage.member.memberNo,
        memberName: memberPackage.member.user.profile?.fullName,
        packageCode: memberPackage.packageCode,
        invoiceId: invoice?.id,
        bundlePackagesCancelled: packagesToCancel.length,
        isBundle: !!purchaseGroupId
      }
    });

    return {
      package: updatedPackage,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      cancelledPackagesCount: packagesToCancel.length
    };
  }

  private async cancelStandaloneAddOn(
    addOnId: string,
    data: CancelPackageInput,
    userId: string,
  ) {
    const addOn = await prisma.memberAddOn.findUnique({
      where: { id: addOnId },
      include: { member: { include: { user: { include: { profile: true } } } } },
    });
    if (!addOn) {
      throw { status: 404, code: 'PACKAGE_NOT_FOUND', message: 'Paket atau add-on tidak ditemukan' };
    }
    if (addOn.status !== 'PENDING_PAYMENT') {
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: 'Hanya add-on dengan status PENDING_PAYMENT yang bisa dibatalkan',
      };
    }
    const invoice = await prisma.invoice.findFirst({
      where: {
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
        items: { some: { itemId: addOnId, itemType: 'ADDON' } },
      },
    });
    const cancelledAt = new Date();
    const cancelledAddOn = await prisma.$transaction(async (tx) => {
      await releaseAddOnStockInTransaction(addOnId, userId, data.reason, tx);
      const updated = await tx.memberAddOn.update({
        where: { id: addOnId },
        data: {
          status: 'CANCELLED',
          notes: addOn.notes
            ? `${addOn.notes}\n\n[CANCELLED] ${data.reason}`
            : `[CANCELLED] ${data.reason}`,
        },
      });
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'CANCELLED',
            cancelledAt,
            notes: invoice.notes
              ? `${invoice.notes}\n\n[CANCELLED] ${data.reason}`
              : `[CANCELLED] ${data.reason}`,
          },
        });
      }
      return updated;
    });
    await logAudit({
      userId,
      branchId: addOn.branchId,
      action: 'UPDATE',
      resource: 'MemberAddOn',
      resourceId: addOnId,
      meta: {
        action: 'CANCEL',
        reason: data.reason,
        previousStatus: 'PENDING_PAYMENT',
        newStatus: 'CANCELLED',
        invoiceId: invoice?.id,
      },
    });
    return {
      addOn: cancelledAddOn,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      cancelledPackagesCount: 0,
      cancelledAddOnsCount: 1,
    };
  }
}
