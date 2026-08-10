import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import {
  AddOnType,
  Invoice,
  InvoiceStatus,
  MemberAddOn,
  MemberPackage,
  PackageStatus,
  Prisma,
} from '@prisma/client';
import type { EditPackageInput } from '../packages.schema';
import {
  normalizeAddOnAssignments,
  type NormalizedAddOnAssignment,
} from './package-assignment.helpers';
import {
  releaseAddOnStockInTransaction,
  reserveAddOnStockInTransaction,
} from './add-on-inventory.service';

type EditableMemberPackage = Prisma.MemberPackageGetPayload<{
  include: {
    member: { include: { user: { include: { profile: true } } } };
    branch: true;
  };
}>;
type PackageSelection = EditPackageInput['packages'][number];

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
    const normalizedAddOns = normalizeAddOnAssignments(data.addOns ?? []);
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

    if (
      !hasPrivilegedEditAccess &&
      (!branchId || memberPackage.branchId !== branchId)
    ) {
      throw {
        status: 403,
        code: 'PACKAGE_BRANCH_FORBIDDEN',
        message: 'Anda hanya dapat mengubah paket member dari cabang aktif Anda.',
      };
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
    if (
      usedPackages.length > 0 &&
      !(hasPrivilegedEditAccess && replacementStatus === PackageStatus.ACTIVE)
    ) {
      throw {
        status: 422,
        code: 'PACKAGE_ALREADY_USED',
        message: `Paket ${usedPackages.map(pkg => pkg.packageCode).join(', ')} sudah memiliki sesi terpakai. Paket terpakai hanya bisa diedit oleh Super Admin/Admin Manager setelah status paket ACTIVE.`,
      };
    }

    // Always reconcile packages in place. Older package records can already be
    // referenced by invoices, scheduled encounters, or finance records even
    // when usedSessions is still zero. Deleting and recreating those rows
    // breaks their foreign keys and surfaced as "Referensi data tidak valid".
    let result;
    try {
      result = await prisma.$transaction(transaction =>
        this.editPackageInPlace({
          db: transaction,
          data,
          normalizedAddOns,
          userId,
          memberPackage,
          purchaseGroupId,
          memberId,
          replacementStatus,
          editableStatuses,
          allowRemovingUsedPackages: hasPrivilegedEditAccess && replacementStatus === PackageStatus.ACTIVE,
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw {
          status: 409,
          code: 'PACKAGE_HAS_REFERENCES',
          message: 'Paket lama sudah terhubung dengan data sesi atau keuangan. Perubahan dibatalkan agar data lama tetap aman.',
        };
      }
      throw error;
    }

    await logAudit({
      userId,
      action: 'UPDATE',
      resource: 'MemberPackage',
      resourceId: packageIdOrGroupId,
      meta: {
        action: replacementStatus === PackageStatus.ACTIVE ? 'EDIT_ACTIVE_IN_PLACE' : 'EDIT_IN_PLACE',
        packagesCount: result.packages.length,
        addOnsCount: result.addOnsCount,
        memberNo: memberPackage.member.memberNo,
        memberName: memberPackage.member.user.profile?.fullName,
      },
    });

    return {
      packages: result.packages,
      invoice: result.invoice,
    };
  }

  private async editPackageInPlace(params: {
    db: Prisma.TransactionClient;
    data: EditPackageInput;
    normalizedAddOns: NormalizedAddOnAssignment[];
    userId: string;
    memberPackage: EditableMemberPackage;
    purchaseGroupId: string | null;
    memberId: string;
    replacementStatus: PackageStatus;
    editableStatuses: PackageStatus[];
    allowRemovingUsedPackages: boolean;
  }) {
    const {
      db,
      data,
      normalizedAddOns,
      userId,
      memberPackage,
      purchaseGroupId,
      memberId,
      replacementStatus,
      editableStatuses,
      allowRemovingUsedPackages,
    } = params;

    // Serialize edits for the same purchase. The UI already guards against a
    // double click, but retries can still reach different API workers.
    const editScopeKey = purchaseGroupId || memberPackage.id;
    await db.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`PACKAGE_EDIT:${editScopeKey}`}))::text AS "lockResult"
    `;

    // Re-read after acquiring the lock so a waiting request sees rows that a
    // previous edit consolidated or soft-cancelled.
    const currentPackages = (await db.memberPackage.findMany({
      where: purchaseGroupId
        ? { purchaseGroupId, status: { in: editableStatuses } }
        : { id: memberPackage.id, status: { in: editableStatuses } },
      orderBy: { createdAt: 'asc' },
    })).sort((left, right) => right.usedSessions - left.usedSessions);

    if (currentPackages.length === 0) {
      throw {
        status: 409,
        code: 'PACKAGE_EDIT_STALE',
        message: 'Data paket telah berubah. Muat ulang halaman sebelum menyimpan kembali.',
      };
    }

    const packageIdsToKeepOrReplace = currentPackages.map(pkg => pkg.id);

    const pricingIds = Array.from(new Set(data.packages.map(pkg => pkg.pricingId).filter(Boolean)));
    const pricings = pricingIds.length > 0
      ? await db.packagePricing.findMany({
          where: {
            id: { in: pricingIds },
            branchId: memberPackage.branchId,
          },
        })
      : [];
    const pricingById = new Map(pricings.map(pricing => [pricing.id, pricing]));
    const missingPricingIds = pricingIds.filter(pricingId => !pricingById.has(pricingId));

    if (missingPricingIds.length > 0) {
      throw {
        status: 409,
        code: 'PACKAGE_PRICING_NOT_FOUND',
        message: 'Pilihan paket sudah tidak tersedia pada master harga. Muat ulang halaman lalu pilih paket kembali.',
      };
    }

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

    const willHaveGroup = selectedPackages.length > 1 || normalizedAddOns.length > 0;
    const targetPurchaseGroupId = purchaseGroupId || (willHaveGroup
      ? `GRP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
      : null);
    const remainingSelections = [...selectedPackages];
    const updatedPackages: MemberPackage[] = [];
    const packageIdsToCancel: string[] = [];

    for (const currentPackage of currentPackages) {
      const matchIndex = remainingSelections.findIndex(({ selection, pricing }) => {
        if (currentPackage.packagePricingId) {
          return selection.pricingId === currentPackage.packagePricingId;
        }

        // Only packages imported without a pricing relation may use catalog
        // attributes as a fallback. Two BASIC prices can share service/type
        // while representing very different session quantities (for example
        // FREE 1X versus 15X).
        return (
          pricing.packageType === currentPackage.packageType &&
          (pricing.boosterType || null) === (currentPackage.boosterType || null) &&
          (pricing.serviceType || null) === (currentPackage.serviceType || null)
        );
      });

      // Legacy packages may have no packagePricingId/productCode or an old
      // service type. Pair an unused row with the closest current pricing so
      // its stable ID and all existing references are preserved.
      const isUnmappedLegacyPackage = !currentPackage.packagePricingId;
      const legacyMatchIndex = matchIndex === -1 && currentPackage.usedSessions === 0 && isUnmappedLegacyPackage
        ? remainingSelections.findIndex(({ pricing }) => pricing.packageType === currentPackage.packageType)
        : matchIndex;

      // A single package of a given type can be replaced in place so its
      // stable ID remains attached to sessions/finance. Do not use this rule
      // when multiple BASIC rows exist: that is the case where FREE 1X was
      // previously confused with 15X because both share the same service.
      const sameTypeCurrentCount = currentPackages.filter(
        (pkg) => pkg.packageType === currentPackage.packageType,
      ).length;
      const uniqueTypeReplacementIndex = legacyMatchIndex === -1 && sameTypeCurrentCount === 1
        ? remainingSelections.findIndex(({ pricing }) => pricing.packageType === currentPackage.packageType)
        : legacyMatchIndex;
      const resolvedMatchIndex =
        uniqueTypeReplacementIndex === -1 &&
        currentPackage.usedSessions === 0 &&
        isUnmappedLegacyPackage &&
        currentPackages.length === selectedPackages.length
          ? 0
          : uniqueTypeReplacementIndex;

      if (resolvedMatchIndex === -1) {
        if (currentPackage.usedSessions > 0 && !allowRemovingUsedPackages) {
          throw {
            status: 422,
            code: 'USED_PACKAGE_CANNOT_BE_REMOVED',
            message: `Paket ${currentPackage.packageCode} sudah memiliki ${currentPackage.usedSessions} sesi terpakai, sehingga tidak bisa dihapus atau diganti tipe paketnya. Tambah jumlah sesi atau edit harga/catatan saja.`,
          };
        }

        packageIdsToCancel.push(currentPackage.id);
        continue;
      }

      const [{ selection, pricing }] = remainingSelections.splice(resolvedMatchIndex, 1);
      const newTotalSessions = pricing.totalSessions * selection.quantity;

      if (newTotalSessions < currentPackage.usedSessions) {
        throw {
          status: 422,
          code: 'TOTAL_SESSIONS_BELOW_USED',
          message: `Jumlah sesi paket ${currentPackage.packageCode} tidak boleh lebih kecil dari ${currentPackage.usedSessions} sesi yang sudah terpakai.`,
        };
      }

      const updatedPackage = await db.memberPackage.update({
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
          boosterType: pricing.boosterType,
          serviceType: pricing.serviceType,
          revenueFlowVersion: memberPackage.revenueFlowVersion,
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
    const installmentSchedule = memberPackage.installmentSchedule ?? Prisma.JsonNull;

    for (const { selection, pricing } of remainingSelections) {
      const newPackage = await db.memberPackage.create({
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
          status: replacementStatus,
          paymentPlanType: memberPackage.paymentPlanType,
          installmentTotal: memberPackage.installmentTotal,
          installmentSchedule,
          totalVerifiedPaid: sourcePaymentData.totalVerifiedPaid || 0,
          paymentPlanStatus: sourcePaymentData.paymentPlanStatus || null,
          boosterType: pricing.boosterType,
          serviceType: pricing.serviceType,
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

    const oldAddOns = await db.memberAddOn.findMany({
      where: { packageId: { in: packageIdsToKeepOrReplace } },
    });

    if (replacementStatus === PackageStatus.ACTIVE && (oldAddOns.length > 0 || normalizedAddOns.length > 0)) {
      throw {
        status: 409,
        code: 'ACTIVE_ADD_ON_EDIT_FORBIDDEN',
        message: 'Add-on pada transaksi ACTIVE tidak dapat diubah dari menu edit paket. Gunakan proses refund/retur agar stok dan HPP tetap tercatat benar.',
      };
    }
    const oldInvoiceItemIds = [
      ...packageIdsToKeepOrReplace,
      ...oldAddOns.map(addOn => addOn.id),
    ];

    // Preserve historical IDs. A package/add-on may already be referenced by
    // sessions or finance rows even while its usage counter is still zero.
    if (packageIdsToCancel.length > 0) {
      await db.memberPackage.updateMany({
        where: { id: { in: packageIdsToCancel } },
        data: { status: PackageStatus.CANCELLED },
      });
    }

    for (const oldAddOn of oldAddOns) {
      await releaseAddOnStockInTransaction(
        oldAddOn.id,
        userId,
        'Reservasi dilepas karena transaksi paket diedit',
        db,
      );
    }
    if (oldAddOns.length > 0) {
      await db.memberAddOn.updateMany({
        where: { id: { in: oldAddOns.map((addOn) => addOn.id) } },
        data: { status: PackageStatus.CANCELLED },
      });
    }

    let packageRecords = [...updatedPackages];
    const createdAddOns: MemberAddOn[] = [];

    if (normalizedAddOns.length > 0) {
      const date = new Date();
      const addOnDate = `${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const addOnPattern = `ADO-${memberPackage.branch.branchCode}-${addOnDate}-%`;
      await db.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`MEMBER_ADD_ON:${memberPackage.branchId}:${addOnDate}`}))::text AS "lockResult"
      `;
      const lastAddOn = await db.$queryRaw<Array<{ addOnCode: string }>>`
        SELECT "addOnCode" FROM "member_add_ons"
        WHERE "branchId" = ${memberPackage.branchId}
          AND "addOnCode" LIKE ${addOnPattern}
        ORDER BY "addOnCode" DESC
        LIMIT 1
      `;
      const lastSequence = lastAddOn[0]
        ? Number.parseInt(lastAddOn[0].addOnCode.split('-').at(-1) || '0', 10)
        : 0;
      let nextSequence = Number.isNaN(lastSequence) ? 1 : lastSequence + 1;

      for (const addon of normalizedAddOns) {
        const createdAddOn = await db.memberAddOn.create({
          data: {
            addOnCode: `ADO-${memberPackage.branch.branchCode}-${addOnDate}-${(nextSequence++).toString().padStart(4, '0')}`,
            memberId,
            branchId: memberPackage.branchId,
            packageId: packageRecords[0]?.id,
            addOnType: addon.type as AddOnType,
            quantity: addon.quantity,
            pricePerUnit: addon.price,
            totalPrice: addon.price * addon.quantity,
            status: replacementStatus,
            paymentPlanType: memberPackage.paymentPlanType,
            installmentTotal: memberPackage.installmentTotal,
            installmentSchedule,
            totalVerifiedPaid: sourcePaymentData.totalVerifiedPaid || 0,
            paymentPlanStatus: sourcePaymentData.paymentPlanStatus || null,
            paidAt: sourcePaymentData.paidAt || null,
            verifiedBy: sourcePaymentData.verifiedBy || null,
            verifiedAt: sourcePaymentData.verifiedAt || null,
            paymentProofUrl: sourcePaymentData.paymentProofUrl || null,
            paymentProofFileName: sourcePaymentData.paymentProofFileName || null,
            paymentProofFileSize: sourcePaymentData.paymentProofFileSize || null,
            paymentProofMimeType: sourcePaymentData.paymentProofMimeType || null,
            notes: `${addon.name} (${addon.code})${data.notes ? ` - ${data.notes}` : ''}`,
            productCode: addon.code,
            inventorySku: addon.inventorySku || null,
            stockQuantity: addon.inventoryQuantityPerUnit
              ? addon.inventoryQuantityPerUnit * addon.quantity
              : null,
            assignedBy: userId,
          },
        });

        await reserveAddOnStockInTransaction(createdAddOn, userId, db);
        createdAddOns.push(createdAddOn);
      }
    }

    if (packageRecords.length > 0) {
      await db.memberPackage.updateMany({
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

        const updatedFirstPackage = await db.memberPackage.update({
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
      ? await db.invoice.findFirst({
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
      await this.rebuildInvoiceItems(db, invoice, packageRecords, createdAddOns);
    }

    return {
      packages: packageRecords,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      addOnsCount: createdAddOns.length,
    };
  }

  private async rebuildInvoiceItems(
    db: Prisma.TransactionClient,
    invoice: Invoice,
    packages: MemberPackage[],
    addOns: MemberAddOn[],
  ) {
    await db.invoiceItem.deleteMany({
      where: { invoiceId: invoice.id },
    });

    let invoiceSubtotal = 0;
    let invoiceDiscountAmount = 0;
    let invoiceDiscountPercent = 0;
    let invoiceDiscountNote: string | null = null;
    let invoiceTotal = 0;

    for (const pkg of packages) {
      const packageDiscount = Number(pkg.discountAmount || 0);
      const packageSubtotal = Number(pkg.finalPrice) + packageDiscount;
      await db.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          itemType: 'PACKAGE',
          itemId: pkg.id,
          code: pkg.packageCode,
          description: `${pkg.packageType} Package - ${pkg.totalSessions} sessions`,
          quantity: 1,
          pricePerUnit: packageSubtotal,
          subtotal: packageSubtotal,
          discountAmount: packageDiscount,
          totalAmount: pkg.finalPrice,
        },
      });
      invoiceSubtotal += packageSubtotal;
      invoiceDiscountAmount += packageDiscount;
      invoiceDiscountPercent = Math.max(invoiceDiscountPercent, Number(pkg.discountPercent || 0));
      invoiceDiscountNote ||= pkg.discountNote || null;
      invoiceTotal += Number(pkg.finalPrice);
    }

    for (const addOn of addOns) {
      await db.invoiceItem.create({
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
      invoiceSubtotal += Number(addOn.totalPrice);
      invoiceTotal += Number(addOn.totalPrice);
    }

    const invoiceTotalWithTax = invoiceTotal + Number(invoice.taxAmount || 0);

    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal: invoiceSubtotal,
        discountPercent: invoiceDiscountAmount > 0 ? invoiceDiscountPercent : null,
        discountAmount: invoiceDiscountAmount,
        discountNote: invoiceDiscountAmount > 0 ? invoiceDiscountNote : null,
        totalAmount: invoiceTotalWithTax,
        actualPaidAmount: invoice.status === InvoiceStatus.PAID ? invoiceTotalWithTax : invoice.actualPaidAmount,
      },
    });
  }
}
