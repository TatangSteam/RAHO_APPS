import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, PackageStatus, Role, StockMutationType } from '@prisma/client';
import type { UpdateSessionBoosterPackageInput } from '../sessions.schema';

// BoosterType enum values (not exported from Prisma because not used as field type in any model)
type BoosterType = 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3' | 'HHO' | 'NO2';

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
   * Update whether a session uses a member booster package.
   * This adjusts package usage counters so voucher balance stays consistent.
   */
  async updateSessionBoosterPackage(
    sessionId: string,
    input: UpdateSessionBoosterPackageInput,
    userId: string,
    branchId: string,
  ) {
    const nextBoosterPackageId = input.useBooster ? input.boosterPackageId : null;

    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        boosterPackage: true,
        encounter: { select: { memberId: true } },
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    if (session.branchId !== branchId) {
      throw {
        status: 403,
        code: 'SESSION_BRANCH_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses ke sesi pada cabang ini',
      };
    }

    if (session.boosterType && session.boosterPackageId !== nextBoosterPackageId) {
      throw {
        status: 409,
        code: 'BOOSTER_TYPE_ALREADY_USED',
        message: 'Paket booster tidak dapat diganti karena jenis booster/stok sudah digunakan pada sesi ini',
      };
    }

    if (session.boosterPackageId === nextBoosterPackageId) {
      return session;
    }

    let nextPackage = null;
    if (nextBoosterPackageId) {
      nextPackage = await prisma.memberPackage.findUnique({
        where: { id: nextBoosterPackageId },
      });

      if (!nextPackage) {
        throw { status: 404, code: 'BOOSTER_PACKAGE_NOT_FOUND', message: 'Paket booster tidak ditemukan' };
      }

      if (nextPackage.memberId !== session.encounter.memberId) {
        throw {
          status: 422,
          code: 'BOOSTER_MEMBER_MISMATCH',
          message: 'Paket booster tidak terdaftar untuk member sesi ini',
        };
      }

      if (nextPackage.branchId !== session.branchId) {
        throw {
          status: 422,
          code: 'BOOSTER_BRANCH_MISMATCH',
          message: 'Paket booster tidak terdaftar di cabang sesi ini',
        };
      }

      if (nextPackage.packageType !== 'BOOSTER') {
        throw {
          status: 422,
          code: 'INVALID_BOOSTER_PACKAGE',
          message: 'Paket yang dipilih bukan paket booster',
        };
      }

      if (nextPackage.status !== PackageStatus.ACTIVE) {
        throw { status: 422, code: 'BOOSTER_NOT_ACTIVE', message: 'Paket booster tidak aktif' };
      }

      if (nextPackage.totalSessions - nextPackage.usedSessions <= 0) {
        throw { status: 422, code: 'BOOSTER_EXHAUSTED', message: 'Sesi booster sudah habis' };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (session.boosterPackage) {
        const usedSessions = Math.max(0, session.boosterPackage.usedSessions - 1);
        await tx.memberPackage.update({
          where: { id: session.boosterPackage.id },
          data: {
            usedSessions,
            status:
              session.boosterPackage.status === PackageStatus.EXPIRED &&
              usedSessions < session.boosterPackage.totalSessions
                ? PackageStatus.ACTIVE
                : session.boosterPackage.status,
          },
        });
      }

      if (nextPackage) {
        const usedSessions = nextPackage.usedSessions + 1;
        await tx.memberPackage.update({
          where: { id: nextPackage.id },
          data: {
            usedSessions,
            status:
              usedSessions >= nextPackage.totalSessions
                ? PackageStatus.EXPIRED
                : nextPackage.status,
          },
        });
      }

      return tx.treatmentSession.update({
        where: { id: sessionId },
        data: {
          boosterPackageId: nextBoosterPackageId,
          boosterType: nextBoosterPackageId ? session.boosterType : null,
        },
        include: { boosterPackage: true },
      });
    });

    await logAudit({
      userId,
      branchId: session.branchId,
      action: AuditAction.UPDATE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      meta: {
        action: 'UPDATE_SESSION_BOOSTER_PACKAGE',
        previousBoosterPackageId: session.boosterPackageId,
        nextBoosterPackageId,
      },
    });

    return result;
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
