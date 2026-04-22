import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, BoosterType, Role, StockMutationType } from '@prisma/client';

export class BoosterService {
  /**
   * Get stock availability for booster types (HHO and NO2)
   */
  async getBoosterStockAvailability(branchId: string) {
    const hhoItem = await prisma.inventoryItem.findFirst({
      where: {
        branchId,
        masterProduct: { name: 'Infus Gassotraus HHO (5ml)' },
      },
      include: { masterProduct: true },
    });

    const no2Item = await prisma.inventoryItem.findFirst({
      where: {
        branchId,
        masterProduct: { name: 'Infus NO2 (5ml)' },
      },
      include: { masterProduct: true },
    });

    return {
      HHO: {
        available: hhoItem ? Number(hhoItem.stock) >= 1 : false,
        stock: hhoItem ? Number(hhoItem.stock) : 0,
        minThreshold: hhoItem ? Number(hhoItem.minThreshold) : 0,
        isLowStock: hhoItem ? Number(hhoItem.stock) < Number(hhoItem.minThreshold) : false,
        unit: hhoItem?.masterProduct.unit || 'ml',
      },
      NO2: {
        available: no2Item ? Number(no2Item.stock) >= 1 : false,
        stock: no2Item ? Number(no2Item.stock) : 0,
        minThreshold: no2Item ? Number(no2Item.minThreshold) : 0,
        isLowStock: no2Item ? Number(no2Item.stock) < Number(no2Item.minThreshold) : false,
        unit: no2Item?.masterProduct.unit || 'ml',
      },
    };
  }

  /**
   * Update booster type and deduct stock from inventory
   */
  async updateBoosterType(sessionId: string, boosterType: string, userId: string, branchId: string) {
    // 1. Validate session
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: { boosterPackage: true },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    if (!session.boosterPackageId) {
      throw {
        status: 422,
        code: 'NO_BOOSTER_PACKAGE',
        message: 'Sesi ini tidak memiliki paket booster',
      };
    }

    if (session.boosterType) {
      throw {
        status: 409,
        code: 'BOOSTER_TYPE_ALREADY_SET',
        message: 'Jenis booster sudah dipilih dan tidak bisa diubah',
      };
    }

    // 2. Map booster type to inventory item name
    const inventoryItemName = boosterType === 'HHO' ? 'Infus Gassotraus HHO (5ml)' : 'Infus NO2 (5ml)';

    // 3. Find master product
    const masterProduct = await prisma.masterProduct.findFirst({
      where: { name: inventoryItemName },
    });

    if (!masterProduct) {
      throw {
        status: 404,
        code: 'MASTER_PRODUCT_NOT_FOUND',
        message: `Produk ${inventoryItemName} tidak ditemukan di master data`,
      };
    }

    // 4. Find inventory item for this branch
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        masterProductId: masterProduct.id,
        branchId,
      },
      include: { masterProduct: true },
    });

    if (!inventoryItem) {
      throw {
        status: 404,
        code: 'INVENTORY_ITEM_NOT_FOUND',
        message: `Produk ${inventoryItemName} tidak tersedia di cabang ini`,
      };
    }

    // 5. Validate stock availability
    const quantityNeeded = 1; // 1 unit per booster
    const stockBefore = Number(inventoryItem.stock);
    const stockAfter = stockBefore - quantityNeeded;

    if (stockAfter < 0) {
      throw {
        status: 409,
        code: 'INSUFFICIENT_STOCK',
        message: `Stok ${inventoryItemName} tidak mencukupi. Tersedia: ${stockBefore} ${inventoryItem.masterProduct.unit}`,
      };
    }

    // 6. Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 6a. Update session with booster type
      const updatedSession = await tx.treatmentSession.update({
        where: { id: sessionId },
        data: { boosterType: boosterType as BoosterType },
      });

      // 6b. Deduct stock
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: stockAfter },
      });

      // 6c. Create stock mutation record
      await tx.stockMutation.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: StockMutationType.USED,
          quantity: quantityNeeded,
          stockBefore,
          stockAfter,
          referenceType: 'TreatmentSession',
          referenceId: sessionId,
          notes: `Booster ${boosterType} digunakan untuk sesi ${session.sessionCode}`,
          createdBy: userId,
        },
      });

      // 6d. Check low stock and notify ADMIN_CABANG
      if (stockAfter < Number(inventoryItem.minThreshold)) {
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
              title: 'Stok Booster Kritis',
              body: `Stok ${inventoryItemName} hampir habis 🔴 (Sisa: ${stockAfter} ${inventoryItem.masterProduct.unit})`,
              status: 'UNREAD',
            },
          });
        }
      }

      return updatedSession;
    });

    // 7. Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      meta: {
        action: 'SET_BOOSTER_TYPE',
        boosterType,
        inventoryItemId: inventoryItem.id,
        quantityUsed: quantityNeeded,
        stockBefore,
        stockAfter,
      },
    });

    return result;
  }
}
