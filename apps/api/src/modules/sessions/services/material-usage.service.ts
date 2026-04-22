import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreateMaterialUsageInput } from '../sessions.schema';
import { AuditAction, Role, StockMutationType } from '@prisma/client';

export class MaterialUsageService {
  async createMaterialUsage(sessionId: string, data: CreateMaterialUsageInput, userId: string, branchId: string) {
    // Check if session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: { infusion: true },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // Relaxed validation - allow material usage without infusion for pending sessions
    // if (!session.infusion) {
    //   throw {
    //     status: 422,
    //     code: 'INFUSION_REQUIRED',
    //     message: 'Infus aktual harus dibuat terlebih dahulu',
    //   };
    // }

    // Validate inventory item
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: data.inventoryItemId },
      include: { masterProduct: true },
    });

    if (!inventoryItem) {
      throw { status: 404, code: 'INVENTORY_ITEM_NOT_FOUND', message: 'Item inventory tidak ditemukan' };
    }

    if (inventoryItem.branchId !== branchId) {
      throw {
        status: 403,
        code: 'INVENTORY_BRANCH_MISMATCH',
        message: 'Item inventory tidak terdaftar di cabang ini',
      };
    }

    // Check stock availability
    const stockBefore = Number(inventoryItem.stock);
    const stockAfter = stockBefore - data.quantity;

    if (stockAfter < 0) {
      throw {
        status: 409,
        code: 'STOCK_INSUFFICIENT',
        message: `Stok ${inventoryItem.masterProduct.name} tidak mencukupi`,
      };
    }

    // Create material usage and update stock in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create material usage record
      const materialUsage = await tx.materialUsage.create({
        data: {
          treatmentSessionId: sessionId,
          inventoryItemId: data.inventoryItemId,
          quantity: data.quantity,
          unit: data.unit,
          recordedBy: data.recordedBy,
        },
      });

      // Update inventory stock
      await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { stock: stockAfter },
      });

      // Create stock mutation
      await tx.stockMutation.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: StockMutationType.USED,
          quantity: data.quantity,
          stockBefore,
          stockAfter,
          referenceType: 'MaterialUsage',
          referenceId: materialUsage.id,
          notes: `Digunakan untuk sesi ${session.sessionCode}`,
          createdBy: userId,
        },
      });

      // Check if stock is critical
      if (stockAfter < Number(inventoryItem.minThreshold)) {
        // Create notification for ADMIN_CABANG
        const adminCabang = await tx.user.findMany({
          where: {
            branchId,
            role: Role.ADMIN_CABANG,
            isActive: true,
          },
        });

        for (const admin of adminCabang) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              type: 'INFO',
              title: 'Stok Kritis',
              body: `Stok ${inventoryItem.masterProduct.name} hampir habis 🔴`,
              status: 'UNREAD',
            },
          });
        }
      }

      return materialUsage;
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'MaterialUsage',
      resourceId: result.id,
      meta: { sessionId, inventoryItemId: data.inventoryItemId, quantity: data.quantity },
    });

    return result;
  }

  async getMaterialUsages(sessionId: string) {
    const materials = await prisma.materialUsage.findMany({
      where: { treatmentSessionId: sessionId },
      include: {
        inventoryItem: {
          include: { masterProduct: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return materials;
  }
}
