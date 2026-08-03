import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { uploadFile } from '../../../config/minio';
import type { RefundPackageInput } from '../packages.schema';
import { returnAddOnStockInTransaction } from './add-on-inventory.service';

interface RefundProof {
  url?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

async function uploadRefundProof(
  entityId: string,
  file?: Express.Multer.File,
): Promise<RefundProof> {
  if (!file) return {};
  const fileExt = file.mimetype.split('/')[1];
  const key = `refund-proofs/${entityId}/${Date.now()}.${fileExt}`;
  const uploaded = await uploadFile(file.buffer, key, file.mimetype);
  return {
    url: uploaded.url,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}

/** Coordinates package/add-on cancellation and optional physical stock return. */
export class PackageRefundService {
  async refundPackage(
    packageId: string,
    data: RefundPackageInput,
    userId: string,
    _branchId: string | null,
    refundProofFile?: Express.Multer.File,
  ) {
    const memberPackage = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: {
        member: { include: { user: { include: { profile: true } } } },
        branch: true,
      },
    });
    if (!memberPackage) {
      return this.refundStandaloneAddOn(packageId, data, userId, refundProofFile);
    }
    if (memberPackage.status !== 'ACTIVE') {
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: `Hanya paket ACTIVE yang bisa di-refund. Status saat ini: ${memberPackage.status}`,
      };
    }

    const packages = memberPackage.purchaseGroupId
      ? await prisma.memberPackage.findMany({
          where: { purchaseGroupId: memberPackage.purchaseGroupId, status: 'ACTIVE' },
          select: { id: true, finalPrice: true },
        })
      : [{ id: memberPackage.id, finalPrice: memberPackage.finalPrice }];
    const packageIds = packages.map((pkg) => pkg.id);
    const addOns = await prisma.memberAddOn.findMany({
      where: { packageId: { in: packageIds }, status: 'ACTIVE' },
      select: { id: true, totalPrice: true },
    });
    const maxRefundAmount = [
      ...packages.map((pkg) => Number(pkg.finalPrice)),
      ...addOns.map((addOn) => Number(addOn.totalPrice)),
    ].reduce((sum, amount) => sum + amount, 0);
    const totalRefundAmount = data.refundAmount ?? maxRefundAmount;
    if (totalRefundAmount > maxRefundAmount) {
      throw {
        status: 400,
        code: 'INVALID_REFUND_AMOUNT',
        message: `Jumlah refund tidak boleh melebihi nilai transaksi (max: ${maxRefundAmount})`,
      };
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        memberId: memberPackage.memberId,
        status: 'PAID',
        items: { some: { itemId: { in: packageIds }, itemType: 'PACKAGE' } },
      },
    });
    const proof = await uploadRefundProof(packageId, refundProofFile);
    const refundedAt = new Date();

    await prisma.$transaction(async (tx) => {
      if (data.returnAddOnsToStock) {
        for (const addOn of addOns) {
          await returnAddOnStockInTransaction(addOn.id, userId, data.reason, refundedAt, tx);
        }
      }
      if (addOns.length > 0) {
        await tx.memberAddOn.updateMany({
          where: { id: { in: addOns.map((addOn) => addOn.id) } },
          data: { status: 'CANCELLED', updatedAt: refundedAt },
        });
      }
      await tx.memberPackage.updateMany({
        where: { id: { in: packageIds } },
        data: {
          status: 'CANCELLED',
          refundAmount: 0,
          refundReason: data.reason,
          refundProofUrl: proof.url,
          refundProofFileName: proof.fileName,
          refundProofFileSize: proof.fileSize,
          refundProofMimeType: proof.mimeType,
          refundedBy: userId,
          refundedAt,
          updatedAt: refundedAt,
        },
      });
      await tx.memberPackage.update({
        where: { id: packageId },
        data: {
          refundAmount: totalRefundAmount,
          notes: memberPackage.notes
            ? `${memberPackage.notes}\n\n[REFUND] ${data.reason}`
            : `[REFUND] ${data.reason}`,
        },
      });
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: refundedAt,
            notes: invoice.notes
              ? `${invoice.notes}\n\n[REFUND] ${data.reason}`
              : `[REFUND] ${data.reason}`,
          },
        });
      }
    });

    const updatedPackage = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      include: {
        member: { include: { user: { include: { profile: true } } } },
        branch: true,
        packagePricing: true,
      },
    });
    await logAudit({
      userId,
      branchId: memberPackage.branchId,
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
        bundlePackagesRefunded: packageIds.length,
        addOnsRefunded: addOns.length,
        addOnsReturnedToStock: data.returnAddOnsToStock,
      },
    });
    return {
      package: updatedPackage,
      refundAmount: totalRefundAmount,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      refundedPackagesCount: packageIds.length,
      refundedAddOnsCount: addOns.length,
      addOnsReturnedToStock: data.returnAddOnsToStock,
    };
  }

  private async refundStandaloneAddOn(
    addOnId: string,
    data: RefundPackageInput,
    userId: string,
    refundProofFile?: Express.Multer.File,
  ) {
    const addOn = await prisma.memberAddOn.findUnique({ where: { id: addOnId } });
    if (!addOn) {
      throw { status: 404, code: 'PACKAGE_NOT_FOUND', message: 'Paket atau add-on tidak ditemukan' };
    }
    if (addOn.status !== 'ACTIVE') {
      throw {
        status: 400,
        code: 'INVALID_STATUS',
        message: `Hanya add-on ACTIVE yang bisa di-refund. Status saat ini: ${addOn.status}`,
      };
    }
    const maxRefundAmount = Number(addOn.totalPrice);
    const refundAmount = data.refundAmount ?? maxRefundAmount;
    if (refundAmount > maxRefundAmount) {
      throw {
        status: 400,
        code: 'INVALID_REFUND_AMOUNT',
        message: `Jumlah refund tidak boleh melebihi nilai add-on (max: ${maxRefundAmount})`,
      };
    }
    const invoice = await prisma.invoice.findFirst({
      where: {
        status: 'PAID',
        items: { some: { itemId: addOnId, itemType: 'ADDON' } },
      },
    });
    const proof = await uploadRefundProof(addOnId, refundProofFile);
    const refundedAt = new Date();
    const updatedAddOn = await prisma.$transaction(async (tx) => {
      if (data.returnAddOnsToStock) {
        await returnAddOnStockInTransaction(addOnId, userId, data.reason, refundedAt, tx);
      }
      const updated = await tx.memberAddOn.update({
        where: { id: addOnId },
        data: {
          status: 'CANCELLED',
          notes: addOn.notes
            ? `${addOn.notes}\n\n[REFUND Rp ${refundAmount}] ${data.reason}${proof.url ? ` - ${proof.url}` : ''}`
            : `[REFUND Rp ${refundAmount}] ${data.reason}${proof.url ? ` - ${proof.url}` : ''}`,
        },
      });
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: refundedAt,
            notes: invoice.notes
              ? `${invoice.notes}\n\n[REFUND] ${data.reason}`
              : `[REFUND] ${data.reason}`,
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
        action: 'REFUND',
        reason: data.reason,
        refundAmount,
        previousStatus: 'ACTIVE',
        newStatus: 'CANCELLED',
        invoiceId: invoice?.id,
        returnedToStock: data.returnAddOnsToStock,
      },
    });
    return {
      addOn: updatedAddOn,
      refundAmount,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      refundedPackagesCount: 0,
      refundedAddOnsCount: 1,
      addOnsReturnedToStock: data.returnAddOnsToStock,
    };
  }
}
