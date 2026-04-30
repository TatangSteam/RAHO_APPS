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
        (data.ifa && Number(data.ifa) !== Number(plan.ifa || 0)) ||
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

      // Deduct stock for each material used AND create material usage records
      // Map field names to product name patterns for searching
      const materials = [
        { field: 'IFA', namePattern: 'IFA', qty: data.ifa },
        { field: 'HHO', namePattern: 'HHO', qty: data.hho },
        { field: 'H2', namePattern: 'H2 (Hydrogen)', qty: data.h2 },
        { field: 'NO', namePattern: 'NO (Nitric Oxide)', qty: data.no },
        { field: 'GASO', namePattern: 'GASO', qty: data.gaso },
        { field: 'O2', namePattern: 'O2 (Oxygen)', qty: data.o2 },
        { field: 'O3', namePattern: 'O3 (Ozone)', qty: data.o3 },
        { field: 'EDTA', namePattern: 'EDTA', qty: data.edta },
        { field: 'MB', namePattern: 'MB (Methylene Blue)', qty: data.mb },
        { field: 'H2S', namePattern: 'H2S', qty: data.h2s },
        { field: 'KCL', namePattern: 'KCL', qty: data.kcl },
        { field: 'JML_NB', namePattern: 'JML/NB', qty: data.jmlNb },
      ];

      for (const material of materials) {
        if (material.qty && material.qty > 0) {
          console.log(`🔍 Processing material: ${material.field} (${material.namePattern}) - Qty: ${material.qty}`);
          
          // Find inventory item directly by name pattern and branch
          // This ensures we find the product that actually exists in this branch's inventory
          const inventoryItem = await tx.inventoryItem.findFirst({
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
