import {
  AuditAction,
  Prisma,
  TreatmentCompletionStatus,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { resolveInfusionKitAvailability } from '@modules/inventory/services/infusion-kit-availability.service';
import { logAudit } from '@utils/auditLog';
import { buildAutomaticKitMaterialUsageRows } from './session-creation.helpers';

const CURRENT_MATERIAL_POLICY_VERSION = 2;

export class SessionMaterialActivationService {
  async activate(
    sessionId: string,
    userId: string,
    authorizedBranchId: string,
  ) {
    const sessionScope = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: { branchId: true },
    });
    if (!sessionScope) throw errors.notFound('Sesi tidak ditemukan.');
    if (sessionScope.branchId !== authorizedBranchId) {
      throw errors.forbidden('Sesi berada di luar cabang yang diizinkan.');
    }

    await assertBranchAccess(userId, sessionScope.branchId);
    await assertPermission(userId, PERMISSIONS.TREATMENT_MATERIAL_RECORD, sessionScope.branchId);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "treatment_sessions"
        WHERE "id" = ${sessionId}
        FOR UPDATE
      `);

      const session = await tx.treatmentSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          sessionCode: true,
          branchId: true,
          isCompleted: true,
          completionStatus: true,
          skipInventoryConsumption: true,
          materialPolicyVersion: true,
        },
      });
      if (!session) throw errors.notFound('Sesi tidak ditemukan.');
      if (
        session.isCompleted
        || session.completionStatus !== TreatmentCompletionStatus.IN_PROGRESS
      ) {
        throw errors.conflict(
          'SESSION_MATERIAL_ACTIVATION_LOCKED',
          'Material hanya dapat diaktifkan pada sesi yang masih berjalan.',
        );
      }

      if (!session.skipInventoryConsumption) {
        return {
          sessionId: session.id,
          sessionCode: session.sessionCode,
          materialPolicyVersion: session.materialPolicyVersion,
          createdMaterialCount: 0,
          availableSessionCount: null,
          alreadyActive: true,
        };
      }

      const availability = await resolveInfusionKitAvailability(session.branchId, tx);
      if (!availability.configured) {
        throw errors.unprocessable(
          'INFUS_SET_NOT_CONFIGURED',
          'Komponen "Infus Set + Pelengkap" belum dikonfigurasi di inventory. Hubungi administrator.',
        );
      }
      if (!availability.available) {
        const unavailableComponents = availability.components
          .filter((component) => !component.isAvailable)
          .map((component) => {
            const available = component.availableUsageQuantity.toFixed(4);
            const required = component.component.quantity.toFixed(4);
            return `${component.component.componentProduct.name} tersedia ${available}, perlu ${required} ${component.component.componentProduct.usageUnit}`;
          });
        throw errors.unprocessable(
          'INFUS_KIT_STOCK_UNAVAILABLE',
          `Material belum dapat diaktifkan karena stok komponen belum cukup: ${unavailableComponents.join('; ')}.`,
        );
      }

      const rows = buildAutomaticKitMaterialUsageRows(
        session.id,
        userId,
        availability.components.map((component) => ({
          inventoryItemId: component.inventoryItem!.id,
          quantity: component.component.quantity,
          unit: component.component.componentProduct.usageUnit,
          conversionFactor: component.component.componentProduct.conversionFactor,
        })),
      );
      const createdMaterials = await tx.materialUsage.createMany({
        data: rows,
        skipDuplicates: true,
      });

      await tx.treatmentSession.update({
        where: { id: session.id },
        data: {
          skipInventoryConsumption: false,
          materialPolicyVersion: CURRENT_MATERIAL_POLICY_VERSION,
        },
      });

      return {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        materialPolicyVersion: CURRENT_MATERIAL_POLICY_VERSION,
        createdMaterialCount: createdMaterials.count,
        availableSessionCount: availability.availableSessionCount,
        alreadyActive: false,
      };
    });

    if (!result.alreadyActive) {
      await logAudit({
        userId,
        branchId: sessionScope.branchId,
        action: AuditAction.UPDATE,
        resource: 'TreatmentSession',
        resourceId: result.sessionId,
        beforeData: { skipInventoryConsumption: true },
        afterData: {
          skipInventoryConsumption: false,
          materialPolicyVersion: result.materialPolicyVersion,
          createdMaterialCount: result.createdMaterialCount,
          availableSessionCount: result.availableSessionCount,
        },
      });
    }

    return {
      ...result,
      message: result.alreadyActive
        ? 'Material dan pemakaian stok sudah aktif pada sesi ini.'
        : 'Material berhasil diaktifkan. Komponen wajib sudah dibuat sebagai draft dan stok akan diposting saat sesi diselesaikan.',
    };
  }
}
