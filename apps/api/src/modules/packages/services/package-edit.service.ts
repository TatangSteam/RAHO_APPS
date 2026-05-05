import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';

interface PackageSelection {
  pricingId: string;
  quantity: number;
  boosterType?: string;
  serviceType?: string;
}

interface AddOnSelection {
  type: string;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

interface EditPackageInput {
  packages: PackageSelection[];
  addOns?: AddOnSelection[];
  discountPercent?: number;
  discountAmount?: number;
  discountNote?: string;
  notes?: string;
}

/**
 * Package Edit Service
 * Handles editing PENDING_PAYMENT packages
 * Similar to assign package but for existing packages
 */
export class PackageEditService {
  /**
   * Edit a PENDING_PAYMENT package or bundle
   * - Only PENDING_PAYMENT packages can be edited
   * - Can update packages, add-ons, discount, notes
   * - Invoice amount also updated
   * - Audit log created
   */
  async editPackage(
    packageIdOrGroupId: string,
    data: EditPackageInput,
    userId: string,
    branchId: string | null
  ) {
    console.log('=== EDIT PACKAGE SERVICE DEBUG ===');
    console.log('packageIdOrGroupId:', packageIdOrGroupId);
    console.log('data:', JSON.stringify(data, null, 2));
    console.log('userId:', userId);
    console.log('branchId:', branchId);
    
    // 1. Find the package or bundle
    let memberPackage = await prisma.memberPackage.findUnique({
      where: { id: packageIdOrGroupId },
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

    // If not found by ID, try to find by purchaseGroupId
    if (!memberPackage) {
      const packages = await prisma.memberPackage.findMany({
        where: {
          purchaseGroupId: packageIdOrGroupId,
          status: 'PENDING_PAYMENT'
        },
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

      if (packages.length === 0) {
        throw {
          status: 404,
          code: 'PACKAGE_NOT_FOUND',
          message: 'Paket tidak ditemukan'
        };
      }

      memberPackage = packages[0];
    }

    // 2. Validate status
    if (memberPackage.status !== 'PENDING_PAYMENT') {
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: 'Hanya paket dengan status PENDING_PAYMENT yang bisa diedit'
      };
    }

    const purchaseGroupId = memberPackage.purchaseGroupId;
    const memberId = memberPackage.memberId;

    // 3. Delete existing packages and add-ons in the group
    if (purchaseGroupId) {
      // Get all package IDs in the group
      const packagesInGroup = await prisma.memberPackage.findMany({
        where: {
          purchaseGroupId: purchaseGroupId,
          status: 'PENDING_PAYMENT'
        },
        select: { id: true }
      });
      const packageIds = packagesInGroup.map(p => p.id);

      // Delete incentive records first (foreign key constraint)
      await prisma.referralIncentiveRecord.deleteMany({
        where: {
          memberPackageId: { in: packageIds }
        }
      });

      // Delete existing add-ons
      await prisma.memberAddOn.deleteMany({
        where: {
          packageId: { in: packageIds }
        }
      });

      // Delete existing packages
      await prisma.memberPackage.deleteMany({
        where: {
          purchaseGroupId: purchaseGroupId,
          status: 'PENDING_PAYMENT'
        }
      });
    } else {
      // Delete incentive records first (foreign key constraint)
      await prisma.referralIncentiveRecord.deleteMany({
        where: {
          memberPackageId: packageIdOrGroupId
        }
      });

      // Delete single package
      await prisma.memberPackage.delete({
        where: { id: packageIdOrGroupId }
      });
    }

    // 4. Create new packages (similar to assign package logic)
    const newPurchaseGroupId = purchaseGroupId || `GRP-${Date.now()}`;
    const createdPackages: any[] = [];

    for (const pkgSelection of data.packages) {
      const pricing = await prisma.packagePricing.findUnique({
        where: { id: pkgSelection.pricingId }
      });

      if (!pricing) continue;

      const packageCode = `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const originalPrice = Number(pricing.price) * pkgSelection.quantity;
      const finalPrice = originalPrice;

      const newPackage = await prisma.memberPackage.create({
        data: {
          packageCode,
          memberId,
          branchId: memberPackage.branchId,
          packagePricingId: pricing.id,
          packageType: pricing.packageType,
          productCode: pricing.productCode,
          totalSessions: pricing.totalSessions * pkgSelection.quantity,
          usedSessions: 0,
          finalPrice,
          status: 'PENDING_PAYMENT',
          boosterType: pkgSelection.boosterType as any,
          serviceType: pkgSelection.serviceType,
          purchaseGroupId: data.packages.length > 1 || (data.addOns && data.addOns.length > 0) ? newPurchaseGroupId : null,
          assignedBy: userId,
          notes: data.notes
        }
      });

      createdPackages.push(newPackage);
    }

    // 5. Apply discount to first package
    if (createdPackages.length > 0 && (data.discountAmount || data.discountPercent)) {
      const firstPackage = createdPackages[0];
      
      // Calculate total original price for all packages
      let totalOriginalPrice = createdPackages.reduce((sum, pkg) => sum + Number(pkg.finalPrice), 0);
      
      // Add add-ons price to total if any
      if (data.addOns && data.addOns.length > 0) {
        const addOnsTotal = data.addOns.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
        totalOriginalPrice += addOnsTotal;
      }
      
      // Calculate percent discount from total price (packages + add-ons)
      let percentDiscountValue = 0;
      if (data.discountPercent && data.discountPercent > 0) {
        percentDiscountValue = (totalOriginalPrice * data.discountPercent) / 100;
      }
      
      // Total discount = percent discount + amount discount
      const totalDiscount = percentDiscountValue + (data.discountAmount || 0);
      
      const newFinalPrice = Number(firstPackage.finalPrice) - totalDiscount;

      await prisma.memberPackage.update({
        where: { id: firstPackage.id },
        data: {
          discountAmount: totalDiscount, // Store total discount (percent + amount)
          discountPercent: data.discountPercent,
          discountNote: data.discountNote,
          finalPrice: newFinalPrice
        }
      });
    }

    // 6. Create add-ons if any
    if (data.addOns && data.addOns.length > 0) {
      for (const addon of data.addOns) {
        const addOnCode = `ADO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await prisma.memberAddOn.create({
          data: {
            addOnCode,
            memberId,
            branchId: memberPackage.branchId,
            packageId: createdPackages[0]?.id,
            addOnType: addon.type as any,
            quantity: addon.quantity,
            pricePerUnit: addon.price,
            totalPrice: addon.price * addon.quantity,
            status: 'PENDING_PAYMENT',
            notes: addon.name,
            assignedBy: userId
          }
        });
      }
    }

    // 7. Update or create invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        memberId,
        status: { in: ['DRAFT', 'PENDING_PAYMENT'] },
        items: {
          some: {
            itemId: packageIdOrGroupId
          }
        }
      }
    });

    if (invoice) {
      // Delete old invoice items
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id }
      });

      // Create new invoice items
      let invoiceTotal = 0;
      for (const pkg of createdPackages) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            itemType: 'PACKAGE',
            itemId: pkg.id,
            code: pkg.packageCode,
            description: `${pkg.packageType} Package - ${pkg.totalSessions} sessions`,
            quantity: 1,
            pricePerUnit: pkg.finalPrice,
            subtotal: pkg.finalPrice,
            totalAmount: pkg.finalPrice
          }
        });
        invoiceTotal += Number(pkg.finalPrice);
      }

      // Update invoice total
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: invoiceTotal,
          totalAmount: invoiceTotal
        }
      });
    }

    // 8. Create audit log
    await logAudit({
      userId,
      action: 'UPDATE',
      resource: 'MemberPackage',
      resourceId: packageIdOrGroupId,
      meta: {
        action: 'EDIT',
        packagesCount: createdPackages.length,
        addOnsCount: data.addOns?.length || 0,
        memberNo: memberPackage.member.memberNo,
        memberName: memberPackage.member.user.profile?.fullName
      }
    });

    return {
      packages: createdPackages,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null
    };
  }
}
