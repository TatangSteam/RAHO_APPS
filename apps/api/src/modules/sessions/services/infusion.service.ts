import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreateInfusionInput } from '../sessions.schema';
import { AuditAction, Role, StockMutationType } from '@prisma/client';

const DEFAULT_NO_IN_IFA250_ML = 2.5;

function toPositiveNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function normalizeSubstanceName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getNoMlPerIfa250Bottle(ifaSubstances: unknown): number {
  if (!Array.isArray(ifaSubstances)) {
    return DEFAULT_NO_IN_IFA250_ML;
  }

  const noSubstance = ifaSubstances.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const raw = item as Record<string, unknown>;
    const unit = String(raw.unit || 'ml').trim().toLowerCase();

    return normalizeSubstanceName(raw.name) === 'no' && unit === 'ml';
  }) as Record<string, unknown> | undefined;

  const noAmount = toPositiveNumber(noSubstance?.amount);
  return noAmount || DEFAULT_NO_IN_IFA250_ML;
}

function getNoStockUsageMl(
  actualNoMl: unknown,
  actualIfa250Bottles: unknown,
  ifaSubstances: unknown
): { stockUsageMl: number; includedInIfaMl: number; actualNoMl: number } {
  const actualNo = toPositiveNumber(actualNoMl);
  if (actualNo <= 0) {
    return { stockUsageMl: 0, includedInIfaMl: 0, actualNoMl: 0 };
  }

  const ifa250Bottles = toPositiveNumber(actualIfa250Bottles);
  const includedInIfa = ifa250Bottles > 0
    ? getNoMlPerIfa250Bottle(ifaSubstances) * ifa250Bottles
    : 0;

  return {
    stockUsageMl: Number(actualNo.toFixed(2)),
    includedInIfaMl: Number(includedInIfa.toFixed(2)),
    actualNoMl: actualNo,
  };
}

function getPlannedActualNoMl(planNoMl: unknown, actualIfa250Bottles: unknown, ifaSubstances: unknown): number {
  const plannedNo = toPositiveNumber(planNoMl);
  const ifa250Bottles = toPositiveNumber(actualIfa250Bottles);
  const includedInIfa = ifa250Bottles > 0
    ? getNoMlPerIfa250Bottle(ifaSubstances) * ifa250Bottles
    : 0;

  return Number(Math.max(plannedNo - includedInIfa, 0).toFixed(2));
}

function hasDoseDeviation(actualValue: unknown, plannedValue: unknown): boolean {
  const actual = toPositiveNumber(actualValue);
  const planned = toPositiveNumber(plannedValue);

  if (actual === 0 && planned === 0) return false;
  return actual !== planned;
}

export class InfusionService {
  async createInfusion(sessionId: string, data: CreateInfusionInput, userId: string, branchId: string) {
    // Check if infusion already exists
    const existing = await prisma.infusionExecution.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    if (existing) {
      throw {
        status: 409,
        code: 'INFUSION_EXISTS',
        message: 'Infus aktual untuk sesi ini sudah ada',
      };
    }

    // Check prerequisites
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        therapyPlan: true,
        vitalSigns: true,
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // Relaxed validation - allow infusion without strict prerequisites for pending sessions
    // if (!session.therapyPlan) {
    //   throw {
    //     status: 422,
    //     code: 'THERAPY_PLAN_REQUIRED',
    //     message: 'Terapi plan harus dibuat terlebih dahulu',
    //   };
    // }

    // const hasVitalBefore = session.vitalSigns.some((v) => v.waktuCatat === 'SEBELUM');
    // if (!hasVitalBefore) {
    //   throw {
    //     status: 422,
    //     code: 'VITAL_BEFORE_REQUIRED',
    //     message: 'Tanda vital SEBELUM harus diisi terlebih dahulu',
    //   };
    // }

    // Validate deviation notes if there's deviation
    const plan = session.therapyPlan;
    if (plan) {
      const plannedActualNo = getPlannedActualNoMl(plan.no, data.ifa250, plan.ifaSubstances);
      const hasDeviation =
        hasDoseDeviation(data.ifa250, plan.ifa250) ||
        hasDoseDeviation(data.ifa500, plan.ifa500) ||
        hasDoseDeviation(data.hho, plan.hho) ||
        hasDoseDeviation(data.h2, plan.h2) ||
        hasDoseDeviation(data.no, plannedActualNo) ||
        hasDoseDeviation(data.gaso, plan.gaso) ||
        hasDoseDeviation(data.o2, plan.o2) ||
        hasDoseDeviation(data.o3, plan.o3) ||
        hasDoseDeviation(data.edta, plan.edta) ||
        hasDoseDeviation(data.mb, plan.mb) ||
        hasDoseDeviation(data.h2s, plan.h2s) ||
        hasDoseDeviation(data.kcl, plan.kcl) ||
        hasDoseDeviation(data.jmlNb, plan.jmlNb);

      if (hasDeviation && !data.deviationNotes) {
        throw {
          status: 422,
          code: 'DEVIATION_NOTES_REQUIRED',
          message: 'Catatan deviasi wajib diisi jika ada perbedaan dengan rencana',
        };
      }
    }

    // Create infusion and deduct stock in transaction
    const result = await prisma.$transaction(async (tx) => {
      const infusion = await tx.infusionExecution.create({
        data: {
          treatmentSessionId: sessionId,
          therapyPlanId: plan?.id,
          ...data,
          tanggalProduksi: data.tanggalProduksi ? new Date(data.tanggalProduksi) : null,
        },
      });

      // ✨ AUTO-USE PRODUCTS with isAutoUsedPerSession flag (e.g., Infus Set + Pelengkap)
      const autoUseProducts = await tx.masterProduct.findMany({
        where: {
          isAutoUsedPerSession: true,
          isActive: true,
        },
      });

      for (const autoProduct of autoUseProducts) {
        console.log(`🔄 Auto-using product: ${autoProduct.name} (${autoProduct.sku})`);
        
        // Find inventory item for this product at this branch
        const autoInventoryItem = await tx.inventoryItem.findFirst({
          where: {
            branchId,
            masterProductId: autoProduct.id,
          },
          include: {
            masterProduct: true,
          },
        });

        if (!autoInventoryItem) {
          console.warn(`⚠️ Auto-use product ${autoProduct.name} not found in branch ${branchId} inventory`);
          continue; // Skip if not in inventory
        }

        const autoQty = 1; // Always use 1 unit per session
        const autoStockBefore = Number(autoInventoryItem.stock);
        const autoStockAfter = autoStockBefore - autoQty;

        if (autoStockAfter < 0) {
          throw {
            status: 409,
            code: 'STOCK_INSUFFICIENT',
            message: `Stok ${autoProduct.name} tidak mencukupi. Tersedia: ${autoStockBefore} ${autoProduct.baseUnit}`,
          };
        }

        // Update stock
        await tx.inventoryItem.update({
          where: { id: autoInventoryItem.id },
          data: { stock: autoStockAfter },
        });

        // Create stock mutation
        await tx.stockMutation.create({
          data: {
            inventoryItemId: autoInventoryItem.id,
            type: StockMutationType.USED,
            quantity: autoQty,
            stockBefore: autoStockBefore,
            stockAfter: autoStockAfter,
            referenceType: 'InfusionExecution',
            referenceId: infusion.id,
            notes: `[AUTO] Digunakan otomatis untuk sesi ${session.sessionCode}: ${autoQty} ${autoProduct.usageUnit}`,
            createdBy: userId,
          },
        });

        // Create material usage record
        await tx.materialUsage.create({
          data: {
            treatmentSessionId: sessionId,
            inventoryItemId: autoInventoryItem.id,
            quantity: autoQty,
            unit: autoProduct.usageUnit,
            recordedBy: userId,
          },
        });

        console.log(`✅ Auto-used ${autoProduct.name}: ${autoQty} ${autoProduct.usageUnit}`);

        // Check if stock is critical
        if (autoStockAfter < Number(autoInventoryItem.minThreshold)) {
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
                body: `Stok ${autoProduct.name} hampir habis 🔴`,
                status: 'UNREAD',
              },
            });
          }
        }
      }

      // Deduct stock for each material used AND create material usage records
      // Map field names to product SKU/name patterns for searching
      // Sesuai List Barang RAHO Official
      const noStockUsage = getNoStockUsageMl(data.no, data.ifa250, plan?.ifaSubstances);
      const materials = [
        // IFA - Satuan BOTOL
        { field: 'IFA500', sku: 'PRD-INF-IFA-001', namePattern: 'IFA 500ml', qty: data.ifa500, unit: 'Botol' },
        { field: 'IFA250', sku: 'PRD-INF-IFA-002', namePattern: 'IFA + NO 2,5ml', qty: data.ifa250, unit: 'Botol' },
        // Cairan Terapi - Satuan ML
        { field: 'HHO', sku: 'PRD-NBT-HHO-001', namePattern: 'NB-HHO', qty: data.hho, unit: 'ml' },
        { field: 'H2', sku: 'PRD-NBT-CH2-001', namePattern: 'H2', qty: data.h2, unit: 'ml' },
        {
          field: 'NO',
          sku: 'PRD-NBT-CNO-001',
          namePattern: 'NB NO',
          qty: noStockUsage.stockUsageMl,
          unit: 'ml',
          actualQty: noStockUsage.actualNoMl,
          includedQty: noStockUsage.includedInIfaMl,
        },
        { field: 'GASO', sku: 'PRD-NBT-CGT-001', namePattern: 'NB Gasotransmitter', qty: data.gaso, unit: 'ml' },
        { field: 'O3', sku: 'PRD-NBT-CO3-001', namePattern: 'Ozone', qty: data.o3, unit: 'ml' },
        { field: 'O2', sku: 'PRD-NBT-CO2-001', namePattern: 'O2', qty: data.o2, unit: 'ml' },
        { field: 'EDTA', sku: 'PRD-NBT-EDT-001', namePattern: 'EDTA', qty: data.edta, unit: 'ml' },
        { field: 'MB', sku: 'PRD-NBT-CMB-001', namePattern: 'NB Methyln Blue', qty: data.mb, unit: 'ml' },
        { field: 'H2S', sku: 'PRD-NBT-H2S-001', namePattern: 'Cairan H2S', qty: data.h2s, unit: 'ml' },
        { field: 'KCL', sku: 'PRD-NBT-KCL-001', namePattern: 'KCL', qty: data.kcl, unit: 'ml' },
      ];

      for (const material of materials) {
        if (material.qty && material.qty > 0) {
          console.log(`🔍 Processing material: ${material.field} (${material.sku}) - Qty: ${material.qty}`);
          
          // Find inventory item by SKU first, then fallback to name pattern
          let inventoryItem = await tx.inventoryItem.findFirst({
            where: {
              branchId,
              masterProduct: {
                sku: material.sku,
                isActive: true,
              }
            },
            include: {
              masterProduct: true,
            },
          });

          // Fallback to name pattern if SKU not found
          if (!inventoryItem) {
            inventoryItem = await tx.inventoryItem.findFirst({
              where: {
                branchId,
                masterProduct: {
                  name: { 
                    contains: material.namePattern,
                    mode: 'insensitive'
                  },
                  isActive: true,
                }
              },
              include: {
                masterProduct: true,
              },
            });
          }

          if (!inventoryItem) {
            console.warn(`⚠️ Inventory item not found for: ${material.namePattern} at branch ${branchId}`);
            console.warn(`   Skipping material ${material.field} - ${material.qty} (no inventory item)`);
            continue; // Skip this material
          }

          console.log(`✓ Found inventory item: ${inventoryItem.masterProduct.name}`);
          console.log(`  ID: ${inventoryItem.id} - Stock: ${inventoryItem.stock} ${inventoryItem.masterProduct.baseUnit}`);

          // Get conversion factor for unit conversion
          const conversionFactor = Number(inventoryItem.masterProduct.conversionFactor);
          const usageQuantity = material.qty; // Quantity in usage unit (ml)
          const materialDetails = material as typeof material & { actualQty?: number; includedQty?: number };
          const noStockNote =
            material.field === 'NO' && materialDetails.includedQty && materialDetails.includedQty > 0
              ? ` (NO tambahan ${materialDetails.actualQty} ml; ${materialDetails.includedQty} ml sudah termasuk IFA 250)`
              : '';
          
          // Convert usage unit to base unit for stock calculation
          // Example: 450 ml → 0.9 botol (if conversionFactor = 500)
          const baseQuantityUsed = usageQuantity / conversionFactor;
          
          const stockBefore = Number(inventoryItem.stock);
          const stockAfter = stockBefore - baseQuantityUsed;

          if (stockAfter < 0) {
            const availableUsageUnit = stockBefore * conversionFactor;
            throw {
              status: 409,
              code: 'STOCK_INSUFFICIENT',
              message: `Stok ${inventoryItem.masterProduct.name} tidak mencukupi. Tersedia: ${stockBefore.toFixed(2)} ${inventoryItem.masterProduct.baseUnit} (${availableUsageUnit.toFixed(0)} ${inventoryItem.masterProduct.usageUnit})`,
            };
          }

          // Update stock (in base unit)
          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: stockAfter },
          });

          // Create stock mutation (in base unit for consistency)
          await tx.stockMutation.create({
            data: {
              inventoryItemId: inventoryItem.id,
              type: StockMutationType.USED,
              quantity: baseQuantityUsed,
              stockBefore,
              stockAfter,
              referenceType: 'InfusionExecution',
              referenceId: infusion.id,
              notes: `Digunakan untuk sesi ${session.sessionCode}: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit}${noStockNote} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`,
              createdBy: userId,
            },
          });

          // ✨ AUTO-CREATE MATERIAL USAGE RECORD (stored in usage unit)
          await tx.materialUsage.create({
            data: {
              treatmentSessionId: sessionId,
              inventoryItemId: inventoryItem.id,
              quantity: usageQuantity, // Store in usage unit (ml)
              unit: inventoryItem.masterProduct.usageUnit,
              recordedBy: userId,
            },
          });

          console.log(`✅ Auto-created material usage for ${inventoryItem.masterProduct.name}: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit}${noStockNote} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`);

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
        }
      }

      return infusion;
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'InfusionExecution',
      resourceId: result.id,
      meta: { sessionId },
    });

    return result;
  }

  async getInfusion(sessionId: string) {
    const infusion = await prisma.infusionExecution.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    return infusion;
  }
}
