import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';

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
    branchId: string | null
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
      throw {
        status: 404,
        code: 'PACKAGE_NOT_FOUND',
        message: 'Paket tidak ditemukan'
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
      
      // Also find add-ons in the same bundle
      const bundleAddOns = await prisma.memberAddOn.findMany({
        where: {
          packageId: { in: packagesToCancel },
          status: 'PENDING_PAYMENT'
        },
        select: { id: true }
      });
      
      // Cancel all add-ons in the bundle
      if (bundleAddOns.length > 0) {
        await prisma.memberAddOn.updateMany({
          where: {
            id: { in: bundleAddOns.map(a => a.id) }
          },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date()
          }
        });
      }
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

    // 5. Update ALL packages in the bundle to CANCELLED
    await prisma.memberPackage.updateMany({
      where: {
        id: { in: packagesToCancel }
      },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });
    
    // Add cancellation note to the main package
    await prisma.memberPackage.update({
      where: { id: packageId },
      data: {
        notes: memberPackage.notes 
          ? `${memberPackage.notes}\n\n[CANCELLED] ${data.reason}`
          : `[CANCELLED] ${data.reason}`
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

    // 7. Update invoice status if exists
    if (invoice) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          notes: invoice.notes
            ? `${invoice.notes}\n\n[CANCELLED] ${data.reason}`
            : `[CANCELLED] ${data.reason}`
        }
      });
    }

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
}
