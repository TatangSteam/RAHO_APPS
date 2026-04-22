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

      // Deduct stock for each material used
      const materials = [
        { name: 'IFA', qty: data.ifa },
        { name: 'HHO', qty: data.hho },
        { name: 'H2', qty: data.h2 },
        { name: 'NO', qty: data.no },
        { name: 'GASO', qty: data.gaso },
        { name: 'O2', qty: data.o2 },
        { name: 'O3', qty: data.o3 },
        { name: 'EDTA', qty: data.edta },
        { name: 'MB', qty: data.mb },
        { name: 'H2S', qty: data.h2s },
        { name: 'KCL', qty: data.kcl },
        { name: 'JML_NB', qty: data.jmlNb },
      ];

      for (const material of materials) {
        if (material.qty && material.qty > 0) {
          // Find inventory item
          const masterProduct = await tx.masterProduct.findFirst({
            where: { name: material.name },
          });

          if (masterProduct) {
            const inventoryItem = await tx.inventoryItem.findFirst({
              where: {
                masterProductId: masterProduct.id,
                branchId,
              },
            });

            if (inventoryItem) {
              const stockBefore = Number(inventoryItem.stock);
              const stockAfter = stockBefore - material.qty;

              if (stockAfter < 0) {
                throw {
                  status: 409,
                  code: 'STOCK_INSUFFICIENT',
                  message: `Stok ${material.name} tidak mencukupi`,
                };
              }

              // Update stock
              await tx.inventoryItem.update({
                where: { id: inventoryItem.id },
                data: { stock: stockAfter },
              });

              // Create stock mutation
              await tx.stockMutation.create({
                data: {
                  inventoryItemId: inventoryItem.id,
                  type: StockMutationType.USED,
                  quantity: material.qty,
                  stockBefore,
                  stockAfter,
                  referenceType: 'InfusionExecution',
                  referenceId: infusion.id,
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
                      body: `Stok ${material.name} hampir habis 🔴`,
                      status: 'UNREAD',
                    },
                  });
                }
              }
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
