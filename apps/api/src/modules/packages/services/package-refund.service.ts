import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { uploadFile } from '../../../config/minio';

interface RefundPackageInput {
  reason: string;
  refundAmount?: number;
}

/**
 * Package Refund Service
 * Handles refunding ACTIVE packages
 */
export class PackageRefundService {
  /**
   * Refund an ACTIVE package
   * - Only ACTIVE packages can be refunded
   * - Package status → CANCELLED
   * - Invoice status → CANCELLED
   * - If package is part of a bundle (has purchaseGroupId), refund ALL packages in the bundle
   * - Audit log created
   * - Refund proof image uploaded to MinIO if provided
   */
  async refundPackage(
    packageId: string,
    data: RefundPackageInput,
    userId: string,
    branchId: string | null,
    refundProofFile?: Express.Multer.File
  ) {
    console.log('=== PackageRefundService.refundPackage called ===');
    console.log('packageId:', packageId);
    console.log('data:', JSON.stringify(data, null, 2));
    console.log('userId:', userId);
    console.log('branchId:', branchId);
    
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
      console.log('ERROR: Package not found');
      throw {
        status: 404,
        code: 'PACKAGE_NOT_FOUND',
        message: 'Paket tidak ditemukan'
      };
    }

    console.log('Package found:', {
      id: memberPackage.id,
      code: memberPackage.packageCode,
      status: memberPackage.status,
      finalPrice: memberPackage.finalPrice
    });

    // 2. Validate status
    if (memberPackage.status !== 'ACTIVE') {
      console.log(`ERROR: Invalid status. Expected ACTIVE, got ${memberPackage.status}`);
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: `Hanya paket dengan status ACTIVE yang bisa di-refund. Status paket saat ini: ${memberPackage.status}`
      };
    }

    // 3. Validate refund amount
    const refundAmount = data.refundAmount || Number(memberPackage.finalPrice);
    console.log('Refund amount:', refundAmount);
    console.log('Package final price:', Number(memberPackage.finalPrice));
    
    // For bundles, we need to calculate total bundle price
    let maxRefundAmount = Number(memberPackage.finalPrice);
    if (memberPackage.purchaseGroupId) {
      // Get all packages in bundle to calculate total
      const bundlePackages = await prisma.memberPackage.findMany({
        where: {
          purchaseGroupId: memberPackage.purchaseGroupId,
          status: 'ACTIVE'
        }
      });
      
      maxRefundAmount = bundlePackages.reduce((sum, p) => sum + Number(p.finalPrice), 0);
      console.log('Bundle detected. Max refund amount (all packages):', maxRefundAmount);
      
      // Also add add-ons to max refund
      const packageIds = bundlePackages.map(p => p.id);
      const bundleAddOns = await prisma.memberAddOn.findMany({
        where: {
          packageId: { in: packageIds },
          status: 'ACTIVE'
        }
      });
      
      if (bundleAddOns.length > 0) {
        const addOnsTotal = bundleAddOns.reduce((sum, a) => sum + Number(a.totalPrice), 0);
        maxRefundAmount += addOnsTotal;
        console.log('Add-ons total:', addOnsTotal);
        console.log('Max refund amount (packages + add-ons):', maxRefundAmount);
      }
    }
    
    if (refundAmount > maxRefundAmount) {
      console.log('ERROR: Refund amount exceeds max refund amount');
      throw {
        status: 400,
        code: 'INVALID_REFUND_AMOUNT',
        message: `Jumlah refund tidak boleh melebihi harga paket (max: ${maxRefundAmount})`
      };
    }

    // 4. Check if this package is part of a bundle
    const purchaseGroupId = memberPackage.purchaseGroupId;
    let packagesToRefund: string[] = [packageId];
    let totalRefundAmount = refundAmount;
    
    if (purchaseGroupId) {
      // Find all packages in the same bundle
      const bundlePackages = await prisma.memberPackage.findMany({
        where: {
          purchaseGroupId: purchaseGroupId,
          status: 'ACTIVE'
        },
        select: { id: true, finalPrice: true }
      });
      
      packagesToRefund = bundlePackages.map(p => p.id);
      
      // Calculate total refund for bundle (if not specified)
      if (!data.refundAmount) {
        totalRefundAmount = bundlePackages.reduce((sum, p) => sum + Number(p.finalPrice), 0);
      }
      
      // Also find add-ons in the same bundle
      const bundleAddOns = await prisma.memberAddOn.findMany({
        where: {
          packageId: { in: packagesToRefund },
          status: 'ACTIVE'
        },
        select: { id: true, totalPrice: true }
      });
      
      // Refund all add-ons in the bundle
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
        
        // Add add-on prices to total refund
        if (!data.refundAmount) {
          totalRefundAmount += bundleAddOns.reduce((sum, a) => sum + Number(a.totalPrice), 0);
        }
      }
    }

    // 5. Find related invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        memberId: memberPackage.memberId,
        status: 'PAID',
        items: {
          some: {
            itemId: { in: packagesToRefund },
            itemType: 'PACKAGE'
          }
        }
      }
    });

    // 6. Update ALL packages in the bundle to CANCELLED
    // Upload refund proof to MinIO if provided
    let refundProofUrl: string | undefined;
    let refundProofFileName: string | undefined;
    let refundProofFileSize: number | undefined;
    let refundProofMimeType: string | undefined;

    if (refundProofFile) {
      console.log('Uploading refund proof to MinIO...');
      
      // Generate unique key for the file
      const timestamp = Date.now();
      const fileExt = refundProofFile.mimetype.split('/')[1];
      const key = `refund-proofs/${packageId}/${timestamp}.${fileExt}`;
      
      // Upload to MinIO with buffer, key, and mimeType
      const uploadResult = await uploadFile(refundProofFile.buffer, key, refundProofFile.mimetype);
      refundProofUrl = uploadResult.url;
      refundProofFileName = refundProofFile.originalname;
      refundProofFileSize = refundProofFile.size;
      refundProofMimeType = refundProofFile.mimetype;
      console.log('Refund proof uploaded:', refundProofUrl);
    }

    await prisma.memberPackage.updateMany({
      where: {
        id: { in: packagesToRefund }
      },
      data: {
        status: 'CANCELLED',
        refundAmount: totalRefundAmount,
        refundReason: data.reason,
        refundProofUrl,
        refundProofFileName,
        refundProofFileSize,
        refundProofMimeType,
        refundedBy: userId,
        refundedAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Add refund note to the main package
    await prisma.memberPackage.update({
      where: { id: packageId },
      data: {
        notes: memberPackage.notes 
          ? `${memberPackage.notes}\n\n[REFUND] ${data.reason}`
          : `[REFUND] ${data.reason}`
      }
    });

    // 7. Get updated package for response
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

    // 8. Update invoice status if exists
    if (invoice) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          notes: invoice.notes
            ? `${invoice.notes}\n\n[REFUND] ${data.reason}`
            : `[REFUND] ${data.reason}`
        }
      });
    }

    // 9. Create audit log
    await logAudit({
      userId,
      action: 'UPDATE',
      resource: 'MemberPackage',
      resourceId: packageId,
      meta: {
        action: 'REFUND',
        reason: data.reason,
        refundAmount: totalRefundAmount,
        previousStatus: 'ACTIVE',
        newStatus: 'CANCELLED',
        memberNo: memberPackage.member.memberNo,
        memberName: memberPackage.member.user.profile?.fullName,
        packageCode: memberPackage.packageCode,
        invoiceId: invoice?.id,
        bundlePackagesRefunded: packagesToRefund.length,
        isBundle: !!purchaseGroupId
      }
    });

    return {
      package: updatedPackage,
      refundAmount: totalRefundAmount,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      refundedPackagesCount: packagesToRefund.length
    };
  }
}
