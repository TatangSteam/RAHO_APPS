import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { InvoiceStatus, PackageStatus } from '@prisma/client';

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

const PRIVILEGED_PACKAGE_EDIT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_MANAGER']);

/**
 * Package Edit Service
 * Handles editing package purchases and privileged active voucher adjustments
 * Similar to assign package but for existing packages
 */
export class PackageEditService {
  /**
   * Edit a package or bundle before payment is finalized
   * - Branch roles can edit PENDING_PAYMENT packages
   * - SUPER_ADMIN and ADMIN_MANAGER can also edit WAITING_VERIFICATION and ACTIVE packages
   * - Can update packages, add-ons, discount, notes
   * - Invoice amount also updated
   * - Audit log created
   */
  async editPackage(
    packageIdOrGroupId: string,
    data: EditPackageInput,
    userId: string,
    branchId: string | null,
    userRole?: string
  ) {
    console.log('=== EDIT PACKAGE SERVICE DEBUG ===');
    console.log('packageIdOrGroupId:', packageIdOrGroupId);
    console.log('data:', JSON.stringify(data, null, 2));
    console.log('userId:', userId);
    console.log('branchId:', branchId);
    console.log('userRole:', userRole);

    const hasPrivilegedEditAccess = PRIVILEGED_PACKAGE_EDIT_ROLES.has(userRole || '');
    const editableStatuses: PackageStatus[] = hasPrivilegedEditAccess
      ? [PackageStatus.PENDING_PAYMENT, PackageStatus.WAITING_VERIFICATION, PackageStatus.ACTIVE]
      : [PackageStatus.PENDING_PAYMENT];
    
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
          status: { in: editableStatuses }
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

      memberPackage = packages[0]!;
    }

    // 2. Validate status
    if (!editableStatuses.includes(memberPackage.status)) {
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: hasPrivilegedEditAccess
          ? 'Hanya paket dengan status PENDING_PAYMENT, WAITING_VERIFICATION, atau ACTIVE yang bisa diedit'
          : 'Hanya paket dengan status PENDING_PAYMENT yang bisa diedit'
      };
    }

    const purchaseGroupId = memberPackage.purchaseGroupId;
    const memberId = memberPackage.memberId;
    const replacementStatus = memberPackage.status;
    const shouldPreservePaymentData = replacementStatus !== PackageStatus.PENDING_PAYMENT;
    const sourcePaymentData = shouldPreservePaymentData
      ? {
          paidAt: memberPackage.paidAt,
          verifiedBy: memberPackage.verifiedBy,
          verifiedAt: memberPackage.verifiedAt,
          activatedAt: memberPackage.activatedAt,
          paymentProofUrl: memberPackage.paymentProofUrl,
          paymentProofFileName: memberPackage.paymentProofFileName,
          paymentProofFileSize: memberPackage.paymentProofFileSize,
          paymentProofMimeType: memberPackage.paymentProofMimeType,
          paymentPlanStatus: memberPackage.paymentPlanStatus,
          totalVerifiedPaid: memberPackage.totalVerifiedPaid,
        }
      : null;

    const packagesInEditScope = await prisma.memberPackage.findMany({
      where: purchaseGroupId
        ? { purchaseGroupId, status: { in: editableStatuses } }
        : { id: memberPackage.id },
      select: {
        id: true,
        packageCode: true,
        usedSessions: true,
      },
    });

    const usedPackages = packagesInEditScope.filter(pkg => pkg.usedSessions > 0);
    if (usedPackages.length > 0) {
      if (hasPrivilegedEditAccess && replacementStatus === PackageStatus.ACTIVE) {
        return await this.editUsedActivePackage({
          packageIdOrGroupId,
          data,
          userId,
          memberPackage,
          packagesInEditScope,
          purchaseGroupId,
          memberId,
        });
      }

      throw {
        status: 422,
        code: 'PACKAGE_ALREADY_USED',
        message: `Paket ${usedPackages.map(pkg => pkg.packageCode).join(', ')} sudah memiliki sesi terpakai. Paket terpakai hanya bisa diedit oleh Super Admin/Admin Manager setelah status paket ACTIVE.`,
      };
    }

    const packageIdsToReplace = packagesInEditScope.map(pkg => pkg.id);
    const addOnsToReplace = packageIdsToReplace.length > 0
      ? await prisma.memberAddOn.findMany({
          where: { packageId: { in: packageIdsToReplace } },
          select: { id: true },
        })
      : [];
    const oldInvoiceItemIds = [
      ...packageIdsToReplace,
      ...addOnsToReplace.map(addOn => addOn.id),
    ];

    // 3. Delete existing packages and add-ons in the editable scope
    await prisma.referralIncentiveRecord.deleteMany({
      where: {
        memberPackageId: { in: packageIdsToReplace }
      }
    });

    await prisma.memberAddOn.deleteMany({
      where: {
        packageId: { in: packageIdsToReplace }
      }
    });

    await prisma.memberPackage.deleteMany({
      where: {
        id: { in: packageIdsToReplace }
      }
    });

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
          status: replacementStatus,
          paymentPlanType: memberPackage.paymentPlanType,
          installmentTotal: memberPackage.installmentTotal,
          installmentSchedule: memberPackage.installmentSchedule as any,
          totalVerifiedPaid: sourcePaymentData?.totalVerifiedPaid || 0,
          paymentPlanStatus: sourcePaymentData?.paymentPlanStatus || null,
          boosterType: pkgSelection.boosterType as any,
          serviceType: pkgSelection.serviceType,
          purchaseGroupId: data.packages.length > 1 || (data.addOns && data.addOns.length > 0) ? newPurchaseGroupId : null,
          assignedBy: userId,
          paidAt: sourcePaymentData?.paidAt || null,
          verifiedBy: sourcePaymentData?.verifiedBy || null,
          verifiedAt: sourcePaymentData?.verifiedAt || null,
          activatedAt: sourcePaymentData?.activatedAt || null,
          paymentProofUrl: sourcePaymentData?.paymentProofUrl || null,
          paymentProofFileName: sourcePaymentData?.paymentProofFileName || null,
          paymentProofFileSize: sourcePaymentData?.paymentProofFileSize || null,
          paymentProofMimeType: sourcePaymentData?.paymentProofMimeType || null,
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

      const updatedPackage = await prisma.memberPackage.update({
        where: { id: firstPackage.id },
        data: {
          discountAmount: totalDiscount, // Store total discount (percent + amount)
          discountPercent: data.discountPercent,
          discountNote: data.discountNote,
          finalPrice: newFinalPrice
        }
      });

      createdPackages[0] = updatedPackage;
    }

    // 6. Create add-ons if any
    const createdAddOns: any[] = [];
    if (data.addOns && data.addOns.length > 0) {
      for (const addon of data.addOns) {
        const addOnCode = `ADO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const createdAddOn = await prisma.memberAddOn.create({
          data: {
            addOnCode,
            memberId,
            branchId: memberPackage.branchId,
            packageId: createdPackages[0]?.id,
            addOnType: addon.type as any,
            quantity: addon.quantity,
            pricePerUnit: addon.price,
            totalPrice: addon.price * addon.quantity,
            status: replacementStatus,
            paymentPlanType: memberPackage.paymentPlanType,
            installmentTotal: memberPackage.installmentTotal,
            installmentSchedule: memberPackage.installmentSchedule as any,
            totalVerifiedPaid: sourcePaymentData?.totalVerifiedPaid || 0,
            paymentPlanStatus: sourcePaymentData?.paymentPlanStatus || null,
            paidAt: sourcePaymentData?.paidAt || null,
            verifiedBy: sourcePaymentData?.verifiedBy || null,
            verifiedAt: sourcePaymentData?.verifiedAt || null,
            paymentProofUrl: sourcePaymentData?.paymentProofUrl || null,
            paymentProofFileName: sourcePaymentData?.paymentProofFileName || null,
            paymentProofFileSize: sourcePaymentData?.paymentProofFileSize || null,
            paymentProofMimeType: sourcePaymentData?.paymentProofMimeType || null,
            notes: addon.name,
            assignedBy: userId
          }
        });
        createdAddOns.push(createdAddOn);
      }
    }

    // 7. Update existing invoice
    const invoice = oldInvoiceItemIds.length > 0
      ? await prisma.invoice.findFirst({
          where: {
            memberId,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.PENDING_PAYMENT, InvoiceStatus.PAID] },
            items: {
              some: {
                itemId: { in: oldInvoiceItemIds }
              }
            }
          }
        })
      : null;

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

      for (const addOn of createdAddOns) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            itemType: 'ADDON',
            itemId: addOn.id,
            code: addOn.addOnCode,
            description: addOn.notes || addOn.addOnType,
            quantity: addOn.quantity,
            pricePerUnit: addOn.pricePerUnit,
            subtotal: addOn.totalPrice,
            totalAmount: addOn.totalPrice
          }
        });
        invoiceTotal += Number(addOn.totalPrice);
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

  private async editUsedActivePackage(params: {
    packageIdOrGroupId: string;
    data: EditPackageInput;
    userId: string;
    memberPackage: any;
    packagesInEditScope: Array<{ id: string; packageCode: string; usedSessions: number }>;
    purchaseGroupId: string | null;
    memberId: string;
  }) {
    const {
      packageIdOrGroupId,
      data,
      userId,
      memberPackage,
      packagesInEditScope,
      purchaseGroupId,
      memberId,
    } = params;

    const packageIdsToKeepOrReplace = packagesInEditScope.map(pkg => pkg.id);
    const currentPackages = await prisma.memberPackage.findMany({
      where: { id: { in: packageIdsToKeepOrReplace } },
      orderBy: { createdAt: 'asc' },
    });

    const pricingIds = Array.from(new Set(data.packages.map(pkg => pkg.pricingId).filter(Boolean)));
    const pricings = pricingIds.length > 0
      ? await prisma.packagePricing.findMany({ where: { id: { in: pricingIds } } })
      : [];
    const pricingById = new Map(pricings.map(pricing => [pricing.id, pricing]));

    const selectedPackages = data.packages.map(selection => ({
      selection,
      pricing: pricingById.get(selection.pricingId),
    })).filter((item): item is { selection: PackageSelection; pricing: NonNullable<typeof item.pricing> } => Boolean(item.pricing));

    if (selectedPackages.length === 0) {
      throw {
        status: 400,
        code: 'PACKAGE_SELECTION_REQUIRED',
        message: 'Pilih minimal 1 paket untuk edit paket aktif',
      };
    }

    const willHaveGroup = selectedPackages.length > 1 || (data.addOns && data.addOns.length > 0);
    const targetPurchaseGroupId = willHaveGroup
      ? purchaseGroupId || `GRP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
      : null;
    const remainingSelections = [...selectedPackages];
    const updatedPackages: any[] = [];
    const packageIdsToDelete: string[] = [];

    for (const currentPackage of currentPackages) {
      const matchIndex = remainingSelections.findIndex(({ selection, pricing }) => {
        if (currentPackage.packagePricingId && selection.pricingId === currentPackage.packagePricingId) {
          return true;
        }

        return (
          pricing.packageType === currentPackage.packageType &&
          (selection.boosterType || pricing.boosterType || null) === (currentPackage.boosterType || null) &&
          (selection.serviceType || pricing.serviceType || null) === (currentPackage.serviceType || null)
        );
      });

      if (matchIndex === -1) {
        if (currentPackage.usedSessions > 0) {
          throw {
            status: 422,
            code: 'USED_PACKAGE_CANNOT_BE_REMOVED',
            message: `Paket ${currentPackage.packageCode} sudah memiliki ${currentPackage.usedSessions} sesi terpakai, sehingga tidak bisa dihapus atau diganti tipe paketnya. Tambah jumlah sesi atau edit harga/catatan saja.`,
          };
        }

        packageIdsToDelete.push(currentPackage.id);
        continue;
      }

      const [{ selection, pricing }] = remainingSelections.splice(matchIndex, 1);
      const newTotalSessions = pricing.totalSessions * selection.quantity;

      if (newTotalSessions < currentPackage.usedSessions) {
        throw {
          status: 422,
          code: 'TOTAL_SESSIONS_BELOW_USED',
          message: `Jumlah sesi paket ${currentPackage.packageCode} tidak boleh lebih kecil dari ${currentPackage.usedSessions} sesi yang sudah terpakai.`,
        };
      }

      const updatedPackage = await prisma.memberPackage.update({
        where: { id: currentPackage.id },
        data: {
          packagePricingId: pricing.id,
          packageType: pricing.packageType,
          productCode: pricing.productCode,
          totalSessions: newTotalSessions,
          finalPrice: Number(pricing.price) * selection.quantity,
          discountPercent: null,
          discountAmount: null,
          discountNote: null,
          boosterType: selection.boosterType || pricing.boosterType,
          serviceType: selection.serviceType || pricing.serviceType,
          purchaseGroupId: targetPurchaseGroupId,
          notes: data.notes,
        },
      });

      updatedPackages.push(updatedPackage);
    }

    const sourcePaymentData = {
      paidAt: memberPackage.paidAt,
      verifiedBy: memberPackage.verifiedBy,
      verifiedAt: memberPackage.verifiedAt,
      activatedAt: memberPackage.activatedAt,
      paymentProofUrl: memberPackage.paymentProofUrl,
      paymentProofFileName: memberPackage.paymentProofFileName,
      paymentProofFileSize: memberPackage.paymentProofFileSize,
      paymentProofMimeType: memberPackage.paymentProofMimeType,
      paymentPlanStatus: memberPackage.paymentPlanStatus,
      totalVerifiedPaid: memberPackage.totalVerifiedPaid,
    };

    for (const { selection, pricing } of remainingSelections) {
      const newPackage = await prisma.memberPackage.create({
        data: {
          packageCode: `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          memberId,
          branchId: memberPackage.branchId,
          packagePricingId: pricing.id,
          packageType: pricing.packageType,
          productCode: pricing.productCode,
          totalSessions: pricing.totalSessions * selection.quantity,
          usedSessions: 0,
          finalPrice: Number(pricing.price) * selection.quantity,
          status: PackageStatus.ACTIVE,
          paymentPlanType: memberPackage.paymentPlanType,
          installmentTotal: memberPackage.installmentTotal,
          installmentSchedule: memberPackage.installmentSchedule as any,
          totalVerifiedPaid: sourcePaymentData.totalVerifiedPaid || 0,
          paymentPlanStatus: sourcePaymentData.paymentPlanStatus || null,
          boosterType: selection.boosterType || pricing.boosterType,
          serviceType: selection.serviceType || pricing.serviceType,
          purchaseGroupId: targetPurchaseGroupId,
          assignedBy: userId,
          paidAt: sourcePaymentData.paidAt || null,
          verifiedBy: sourcePaymentData.verifiedBy || null,
          verifiedAt: sourcePaymentData.verifiedAt || null,
          activatedAt: sourcePaymentData.activatedAt || null,
          paymentProofUrl: sourcePaymentData.paymentProofUrl || null,
          paymentProofFileName: sourcePaymentData.paymentProofFileName || null,
          paymentProofFileSize: sourcePaymentData.paymentProofFileSize || null,
          paymentProofMimeType: sourcePaymentData.paymentProofMimeType || null,
          notes: data.notes,
        },
      });

      updatedPackages.push(newPackage);
    }

    const oldAddOns = await prisma.memberAddOn.findMany({
      where: { packageId: { in: packageIdsToKeepOrReplace } },
      select: { id: true },
    });
    const oldInvoiceItemIds = [
      ...packageIdsToKeepOrReplace,
      ...oldAddOns.map(addOn => addOn.id),
    ];

    if (packageIdsToDelete.length > 0) {
      await prisma.referralIncentiveRecord.deleteMany({
        where: { memberPackageId: { in: packageIdsToDelete } },
      });
      await prisma.memberAddOn.deleteMany({
        where: { packageId: { in: packageIdsToDelete } },
      });
      await prisma.memberPackage.deleteMany({
        where: { id: { in: packageIdsToDelete } },
      });
    }

    await prisma.memberAddOn.deleteMany({
      where: { packageId: { in: packageIdsToKeepOrReplace } },
    });

    let packageRecords = [...updatedPackages];
    let createdAddOns: any[] = [];

    if (data.addOns && data.addOns.length > 0) {
      for (const addon of data.addOns) {
        const createdAddOn = await prisma.memberAddOn.create({
          data: {
            addOnCode: `ADO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            memberId,
            branchId: memberPackage.branchId,
            packageId: packageRecords[0]?.id,
            addOnType: addon.type as any,
            quantity: addon.quantity,
            pricePerUnit: addon.price,
            totalPrice: addon.price * addon.quantity,
            status: PackageStatus.ACTIVE,
            paymentPlanType: memberPackage.paymentPlanType,
            installmentTotal: memberPackage.installmentTotal,
            installmentSchedule: memberPackage.installmentSchedule as any,
            totalVerifiedPaid: sourcePaymentData.totalVerifiedPaid || 0,
            paymentPlanStatus: sourcePaymentData.paymentPlanStatus || null,
            paidAt: sourcePaymentData.paidAt || null,
            verifiedBy: sourcePaymentData.verifiedBy || null,
            verifiedAt: sourcePaymentData.verifiedAt || null,
            paymentProofUrl: sourcePaymentData.paymentProofUrl || null,
            paymentProofFileName: sourcePaymentData.paymentProofFileName || null,
            paymentProofFileSize: sourcePaymentData.paymentProofFileSize || null,
            paymentProofMimeType: sourcePaymentData.paymentProofMimeType || null,
            notes: addon.name,
            assignedBy: userId,
          },
        });

        createdAddOns.push(createdAddOn);
      }
    }

    if (packageRecords.length > 0) {
      await prisma.memberPackage.updateMany({
        where: { id: { in: packageRecords.map(pkg => pkg.id) } },
        data: {
          discountAmount: null,
          discountPercent: null,
          discountNote: null,
        },
      });

      if (data.discountAmount || data.discountPercent) {
        const addOnsTotal = createdAddOns.reduce((sum, addon) => sum + Number(addon.totalPrice || 0), 0);
        const totalOriginalPrice = packageRecords.reduce((sum, pkg) => sum + Number(pkg.finalPrice || 0), 0) + addOnsTotal;
        const percentDiscountValue = data.discountPercent && data.discountPercent > 0
          ? (totalOriginalPrice * data.discountPercent) / 100
          : 0;
        const totalDiscount = percentDiscountValue + (data.discountAmount || 0);
        const firstPackage = packageRecords[0];

        const updatedFirstPackage = await prisma.memberPackage.update({
          where: { id: firstPackage.id },
          data: {
            discountAmount: totalDiscount,
            discountPercent: data.discountPercent,
            discountNote: data.discountNote,
            finalPrice: Math.max(0, Number(firstPackage.finalPrice) - totalDiscount),
          },
        });

        packageRecords = [updatedFirstPackage, ...packageRecords.slice(1)];
      }
    }

    const invoice = oldInvoiceItemIds.length > 0
      ? await prisma.invoice.findFirst({
          where: {
            memberId,
            status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.PENDING_PAYMENT, InvoiceStatus.PAID] },
            items: {
              some: {
                itemId: { in: oldInvoiceItemIds },
              },
            },
          },
        })
      : null;

    if (invoice) {
      await this.rebuildInvoiceItems(invoice, packageRecords, createdAddOns);
    }

    await logAudit({
      userId,
      action: 'UPDATE',
      resource: 'MemberPackage',
      resourceId: packageIdOrGroupId,
      meta: {
        action: 'EDIT_ACTIVE_USED',
        packagesCount: packageRecords.length,
        addOnsCount: createdAddOns.length,
        memberNo: memberPackage.member.memberNo,
        memberName: memberPackage.member.user.profile?.fullName,
      },
    });

    return {
      packages: packageRecords,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
    };
  }

  private async rebuildInvoiceItems(invoice: any, packages: any[], addOns: any[]) {
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: invoice.id },
    });

    let invoiceTotal = 0;

    for (const pkg of packages) {
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
          totalAmount: pkg.finalPrice,
        },
      });
      invoiceTotal += Number(pkg.finalPrice);
    }

    for (const addOn of addOns) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          itemType: 'ADDON',
          itemId: addOn.id,
          code: addOn.addOnCode,
          description: addOn.notes || addOn.addOnType,
          quantity: addOn.quantity,
          pricePerUnit: addOn.pricePerUnit,
          subtotal: addOn.totalPrice,
          totalAmount: addOn.totalPrice,
        },
      });
      invoiceTotal += Number(addOn.totalPrice);
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal: invoiceTotal,
        totalAmount: invoiceTotal,
        actualPaidAmount: invoice.status === InvoiceStatus.PAID ? invoiceTotal : invoice.actualPaidAmount,
      },
    });
  }
}
