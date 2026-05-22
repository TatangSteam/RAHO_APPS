import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import type { CreateInfusionInput } from '../sessions.schema';
import { AuditAction, Role, StockMutationType } from '@prisma/client';

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
      const hasDeviation =
        (data.ifa250 && Number(data.ifa250) !== Number(plan.ifa250 || 0)) ||
        (data.ifa500 && Number(data.ifa500) !== Number(plan.ifa500 || 0)) ||
        (data.hho && Number(data.hho) !== Number(plan.hho || 0)) ||
        (data.h2 && Number(data.h2) !== Number(plan.h2 || 0)) ||
        (data.no && Number(data.no) !== Number(plan.no || 0)) ||
        (data.gaso && Number(data.gaso) !== Number(plan.gaso || 0)) ||
        (data.o2 && Number(data.o2) !== Number(plan.o2 || 0)) ||
        (data.o3 && Number(data.o3) !== Number(plan.o3 || 0)) ||
        (data.edta && Number(data.edta) !== Number(plan.edta || 0)) ||
        (data.mb && Number(data.mb) !== Number(plan.mb || 0)) ||
        (data.h2s && Number(data.h2s) !== Number(plan.h2s || 0)) ||
        (data.kcl && Number(data.kcl) !== Number(plan.kcl || 0)) ||
        (data.jmlNb && Number(data.jmlNb) !== Number(plan.jmlNb || 0));

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
      const materials = [
        // IFA - Satuan BOTOL
        { field: 'IFA500', sku: 'PRD-INF-IFA-001', namePattern: 'IFA 500ml', qty: data.ifa500, unit: 'Botol' },
        { field: 'IFA250', sku: 'PRD-INF-IFA-002', namePattern: 'IFA + NO 2,5ml', qty: data.ifa250, unit: 'Botol' },
        // Cairan Terapi - Satuan ML
        { field: 'HHO', sku: 'PRD-NBT-HHO-001', namePattern: 'NB-HHO', qty: data.hho, unit: 'ml' },
        { field: 'H2', sku: 'PRD-NBT-CH2-001', namePattern: 'H2', qty: data.h2, unit: 'ml' },
        { field: 'NO', sku: 'PRD-NBT-CNO-001', namePattern: 'NB NO', qty: data.no, unit: 'ml' },
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
              notes: `Digunakan untuk sesi ${session.sessionCode}: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`,
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

          console.log(`✅ Auto-created material usage for ${inventoryItem.masterProduct.name}: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit} (${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit})`);

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
