import {
  AuditAction,
  MaterialDeviationReason,
  MaterialUsageStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { resolveSessionMaterialRecommendations } from '@modules/inventory/services/treatment-bom.service';
import { logAudit } from '@utils/auditLog';
import type { CreateMaterialUsageInput } from '../sessions.schema';
import { requiresMaterialDeviationReason } from './material-usage.helpers';

export class MaterialUsageService {
  async createMaterialUsage(
    sessionId: string,
    data: CreateMaterialUsageInput,
    userId: string,
    authorizedBranchId: string,
  ) {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: { id: true, sessionCode: true, branchId: true, isCompleted: true },
    });
    if (!session) throw errors.notFound('Sesi tidak ditemukan.');
    if (session.branchId !== authorizedBranchId) throw errors.forbidden('Sesi berada di luar cabang yang diizinkan.');
    if (session.isCompleted) throw errors.conflict('SESSION_ALREADY_COMPLETED', 'Material sesi yang sudah selesai tidak dapat diubah.');
    await assertBranchAccess(userId, session.branchId);
    await assertPermission(userId, PERMISSIONS.TREATMENT_MATERIAL_RECORD, session.branchId);

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: data.inventoryItemId },
      include: { masterProduct: true, balances: true },
    });
    if (!inventoryItem || inventoryItem.branchId !== session.branchId || !inventoryItem.masterProduct.isActive) {
      throw errors.notFound('Item inventory aktif tidak ditemukan dalam cabang sesi.');
    }
    const conversionFactor = inventoryItem.masterProduct.conversionFactor;
    if (conversionFactor.lessThanOrEqualTo(0)) {
      throw errors.conflict('INVALID_UNIT_CONVERSION', 'Conversion factor material harus lebih besar dari nol.');
    }
    const quantity = new Prisma.Decimal(data.quantity);
    const baseQuantity = quantity.div(conversionFactor).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    if (baseQuantity.lessThanOrEqualTo(0)) throw errors.badRequest('MATERIAL_QUANTITY_INVALID', 'Quantity material harus lebih besar dari nol.');

    const availableBaseQuantity = inventoryItem.balances.reduce(
      (sum, balance) => sum.add(balance.onHandQty).sub(balance.reservedQty).sub(balance.quarantineQty),
      new Prisma.Decimal(0),
    );
    if (availableBaseQuantity.lessThan(baseQuantity)) {
      throw errors.unprocessable(
        'INSUFFICIENT_AVAILABLE_STOCK',
        `Stok tersedia ${availableBaseQuantity.mul(conversionFactor).toFixed(4)} ${inventoryItem.masterProduct.usageUnit}.`,
      );
    }

    const recommendations = await resolveSessionMaterialRecommendations(sessionId);
    const recommendation = recommendations.items.find(
      (item) => item.inventoryItemId === inventoryItem.id || item.masterProductId === inventoryItem.masterProductId,
    );
    const recommendedQuantity = recommendation
      ? new Prisma.Decimal(recommendation.recommendedQuantity)
      : null;
    const tolerancePercent = recommendation
      ? new Prisma.Decimal(recommendation.tolerancePercent)
      : new Prisma.Decimal(0);
    const isDeviation = requiresMaterialDeviationReason(
      quantity,
      recommendedQuantity,
      tolerancePercent,
      recommendations.hasActiveBom,
    );
    if (isDeviation && !data.deviationReason) {
      throw errors.unprocessable(
        'MATERIAL_DEVIATION_REASON_REQUIRED',
        'Alasan deviasi wajib diisi karena material aktual berbeda dari Treatment BOM aktif.',
      );
    }
    if (data.deviationReason === MaterialDeviationReason.OTHER && !data.deviationNotes?.trim()) {
      throw errors.unprocessable('MATERIAL_DEVIATION_NOTES_REQUIRED', 'Catatan wajib diisi untuk alasan deviasi Lainnya.');
    }

    const usageKey = `${sessionId}:${inventoryItem.id}`;
    const before = await prisma.materialUsage.findUnique({ where: { usageKey } });
    if (before && before.status !== MaterialUsageStatus.DRAFT) {
      throw errors.conflict('MATERIAL_USAGE_IMMUTABLE', 'Material usage yang sudah dikonsumsi tidak dapat diubah.');
    }
    const result = await prisma.materialUsage.upsert({
      where: { usageKey },
      create: {
        usageKey,
        treatmentSessionId: sessionId,
        inventoryItemId: inventoryItem.id,
        treatmentBomItemId: recommendation?.treatmentBomItemId,
        quantity,
        unit: inventoryItem.masterProduct.usageUnit,
        baseQuantity,
        recommendedQuantity,
        deviationReason: data.deviationReason ?? null,
        deviationNotes: data.deviationNotes?.trim() || null,
        status: MaterialUsageStatus.DRAFT,
        recordedBy: userId,
      },
      update: {
        treatmentBomItemId: recommendation?.treatmentBomItemId ?? null,
        quantity,
        unit: inventoryItem.masterProduct.usageUnit,
        baseQuantity,
        recommendedQuantity,
        deviationReason: data.deviationReason ?? null,
        deviationNotes: data.deviationNotes?.trim() || null,
        recordedBy: userId,
      },
      include: {
        inventoryItem: { include: { masterProduct: true } },
        treatmentBomItem: { include: { treatmentBom: true } },
      },
    });

    await logAudit({
      userId,
      branchId: session.branchId,
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      resource: 'MaterialUsage',
      resourceId: result.id,
      beforeData: before,
      afterData: {
        sessionId,
        inventoryItemId: inventoryItem.id,
        quantity: quantity.toFixed(4),
        baseQuantity: baseQuantity.toFixed(4),
        recommendedQuantity: recommendedQuantity?.toFixed(4) ?? null,
        isDeviation,
        deviationReason: result.deviationReason,
        status: result.status,
      },
    });
    return result;
  }

  async deleteMaterialUsage(sessionId: string, usageId: string, userId: string, authorizedBranchId: string) {
    const usage = await prisma.materialUsage.findFirst({
      where: { id: usageId, treatmentSessionId: sessionId },
      include: { session: { select: { branchId: true, isCompleted: true } } },
    });
    if (!usage) throw errors.notFound('Material usage tidak ditemukan.');
    if (usage.session.branchId !== authorizedBranchId) throw errors.forbidden('Sesi berada di luar cabang yang diizinkan.');
    await assertBranchAccess(userId, usage.session.branchId);
    await assertPermission(userId, PERMISSIONS.TREATMENT_MATERIAL_RECORD, usage.session.branchId);
    if (usage.session.isCompleted || usage.status !== MaterialUsageStatus.DRAFT) {
      throw errors.conflict('MATERIAL_USAGE_IMMUTABLE', 'Hanya material usage DRAFT yang dapat dihapus.');
    }
    await prisma.materialUsage.delete({ where: { id: usage.id } });
    await logAudit({
      userId,
      branchId: usage.session.branchId,
      action: AuditAction.DELETE,
      resource: 'MaterialUsage',
      resourceId: usage.id,
      beforeData: usage,
    });
    return { id: usage.id, deleted: true };
  }

  async getMaterialUsages(sessionId: string) {
    const materials = await prisma.materialUsage.findMany({
      where: { treatmentSessionId: sessionId },
      include: {
        inventoryItem: { include: { masterProduct: true } },
        treatmentBomItem: { include: { treatmentBom: true } },
        inventoryPosting: { select: { id: true, postingNumber: true, totalCost: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return materials.map((material) => ({
      ...material,
      conversionInfo: {
        usageQuantity: material.quantity,
        usageUnit: material.unit,
        baseQuantity: material.baseQuantity,
        baseUnit: material.inventoryItem.masterProduct.baseUnit,
        conversionFactor: material.inventoryItem.masterProduct.conversionFactor,
        displayText: `${material.quantity.toFixed(2)} ${material.unit}`,
      },
    }));
  }

  async getAvailableInventoryItems(branchId: string) {
    const items = await prisma.inventoryItem.findMany({
      where: { branchId, masterProduct: { isActive: true } },
      include: { masterProduct: true, balances: true },
      orderBy: [
        { masterProduct: { category: 'asc' } },
        { masterProduct: { name: 'asc' } },
      ],
    });
    return items.map((item) => {
      const availableBase = item.balances.reduce(
        (sum, balance) => sum.add(balance.onHandQty).sub(balance.reservedQty).sub(balance.quarantineQty),
        new Prisma.Decimal(0),
      );
      const conversionFactor = item.masterProduct.conversionFactor;
      const availableUsage = availableBase.mul(conversionFactor);
      const minThresholdUsage = item.minThreshold.mul(conversionFactor);
      return {
        ...item,
        stockInfo: {
          baseStock: availableBase,
          baseUnit: item.masterProduct.baseUnit,
          usageStock: availableUsage,
          usageUnit: item.masterProduct.usageUnit,
          minThresholdBase: item.minThreshold,
          minThresholdUsage,
          isLowStock: availableBase.lessThan(item.minThreshold),
          displayText: `${availableBase.toFixed(2)} ${item.masterProduct.baseUnit} (${availableUsage.toFixed(2)} ${item.masterProduct.usageUnit} tersedia)`,
          displayShort: `${availableBase.toFixed(2)} ${item.masterProduct.baseUnit} (${availableUsage.toFixed(0)} ${item.masterProduct.usageUnit})`,
        },
      };
    });
  }
}
