// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role, StockMutationType, DiscrepancyType } from '@prisma/client';
import { uploadFile } from '../../../config/minio';
import { env } from '../../../config/env';
import { v4 as uuidv4 } from 'uuid';

interface DiscrepancyItem {
  masterProductId: string;
  expectedQty: number;
  receivedQty: number;
  discrepancyType: DiscrepancyType;
  notes?: string;
  photoUrl?: string;
  photoFileName?: string;
}

interface ReceiveShipmentInput {
  receivedItems?: Array<{
    masterProductId: string;
    receivedQty: number;
  }>;
  discrepancies?: DiscrepancyItem[];
  notes?: string;
  receiptFile?: Express.Multer.File;
}

interface ReviewShipmentIssueInput {
  decision: 'SEND_SHORTAGE' | 'CLOSE_CASE' | 'COMPLETE_CASE';
  notes?: string;
  shortageItems?: Array<{
    masterProductId: string;
    quantity: number;
  }>;
}

/**
 * Service for processing shipments (ship, receive with discrepancy support, overstock handling)
 */
export class ShipmentProcessingService {
  /**
   * Ship shipment with overstock support (mark as shipped by Admin Manager)
   * Allows sending more items than requested with mandatory reason
   */
  async shipShipment(
    shipmentId: string, 
    userId: string, 
    data?: { 
      notes?: string;
      shipmentPhotoUrl?: string;
      shipmentPhotoName?: string;
      items?: Array<{
        masterProductId: string;
        sentQty: number;
        overstockReason?: string;
      }>;
    }
  ) {
    // Validate user can ship stock
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_LOGISTIK].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat mengirim barang',
      };
    }

    // Get shipment with stock request items
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        fromBranch: true,
        toBranch: true,
        stockRequest: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'PREPARING') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Pengiriman sudah diproses atau belum siap',
      };
    }

    // For ADMIN_MANAGER, validate they manage the destination branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: shipment.toBranchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda tidak memiliki akses untuk mengirim ke cabang ini',
        };
      }
    }

    // Validate overstock items have reasons
    if (data?.items) {
      for (const item of data.items) {
        const requestItem = shipment.stockRequest?.items.find(
          ri => ri.masterProductId === item.masterProductId
        );
        const originalRequestedQty = requestItem ? Number(requestItem.requestedQty) : 0;
        const overstockDeducted = requestItem?.overstockDeducted ? Number(requestItem.overstockDeducted) : 0;
        const expectedSentQty = originalRequestedQty - overstockDeducted;
        
        if (item.sentQty > expectedSentQty && !item.overstockReason) {
          const product = shipment.items.find(i => i.masterProductId === item.masterProductId);
          throw {
            status: 400,
            code: 'OVERSTOCK_REASON_REQUIRED',
            message: `Alasan overstock wajib diisi untuk ${product?.masterProduct.name || 'item'} (kirim ${item.sentQty} > perlu dikirim ${expectedSentQty})`,
          };
        }
      }
    }

    // Update shipment and stock request status
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment items with new quantities and overstock info
      if (data?.items) {
        for (const itemData of data.items) {
          const shipmentItem = shipment.items.find(
            i => i.masterProductId === itemData.masterProductId
          );
          if (shipmentItem) {
            const requestItem = shipment.stockRequest?.items.find(
              ri => ri.masterProductId === itemData.masterProductId
            );
            // Get original requested qty
            const originalRequestedQty = requestItem ? Number(requestItem.requestedQty) : Number(shipmentItem.sentQty);
            // Get overstock that was already deducted
            const overstockDeducted = requestItem?.overstockDeducted ? Number(requestItem.overstockDeducted) : 0;
            // Expected sent qty is original minus what was already deducted from overstock
            const expectedSentQty = originalRequestedQty - overstockDeducted;
            // Calculate new overstock (if sending more than expected)
            const overstockQty = Math.max(0, itemData.sentQty - expectedSentQty);

            console.log(`[ShipmentProcessing] Item ${itemData.masterProductId}: originalReq=${originalRequestedQty}, overstockDeducted=${overstockDeducted}, expectedSent=${expectedSentQty}, actualSent=${itemData.sentQty}, newOverstock=${overstockQty}`);
            console.log(`[ShipmentProcessing] overstockReason: ${itemData.overstockReason}`);

            await tx.shipmentItem.update({
              where: { id: shipmentItem.id },
              data: {
                sentQty: itemData.sentQty,
                requestedQty: originalRequestedQty, // Store original for reference
                overstockQty: overstockQty > 0 ? overstockQty : null,
                overstockReason: overstockQty > 0 ? itemData.overstockReason : null,
              },
            });
          }
        }
      }

      // Update shipment
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: 'SHIPPED',
          shippedAt: new Date(),
          shippedBy: userId,
          shipmentPhotoUrl: data?.shipmentPhotoUrl,
          shipmentPhotoName: data?.shipmentPhotoName,
          notes: data?.notes || shipment.notes,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          fromBranch: true,
          toBranch: true,
        },
      });

      // Update stock request status
      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: 'SHIPPED',
            shippedBy: userId,
            shippedAt: new Date(),
          },
        });
      }

      return updatedShipment;
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: { 
        action: 'SHIP', 
        shipmentCode: shipment.shipmentCode,
        toBranchId: shipment.toBranchId,
        hasOverstock: data?.items?.some(i => {
          const requestItem = shipment.stockRequest?.items.find(ri => ri.masterProductId === i.masterProductId);
          return i.sentQty > (requestItem ? Number(requestItem.requestedQty) : 0);
        }),
      },
    });

    return this.formatShipment(result);
  }

  /**
   * Receive shipment (by Admin Cabang)
   * Supports receiving with discrepancy reporting and overstock creation
   */
  async receiveShipment(
    shipmentId: string, 
    userId: string, 
    input: ReceiveShipmentInput = {}
  ) {
    // Validate user role - only ADMIN_CABANG can receive
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || user.role !== Role.ADMIN_CABANG) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Admin Cabang yang dapat menerima barang',
      };
    }

    // Get shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        fromBranch: true,
        toBranch: true,
        stockRequest: true,
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'SHIPPED') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Pengiriman belum dikirim atau sudah diproses',
      };
    }

    // Validate user is from the destination branch
    if (user.branchId !== shipment.toBranchId) {
      throw {
        status: 403,
        code: 'BRANCH_MISMATCH',
        message: 'Anda hanya dapat menerima barang untuk cabang Anda sendiri',
      };
    }

    if (!input.receiptFile) {
      throw {
        status: 400,
        code: 'RECEIPT_FILE_REQUIRED',
        message: 'File tanda terima wajib diupload',
      };
    }

    const receiptExtension = input.receiptFile.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
    const receiptKey = `uploads/shipments/${shipmentId}/receipt-${uuidv4()}.${receiptExtension}`;
    const receiptUpload = await uploadFile(input.receiptFile.buffer, receiptKey, input.receiptFile.mimetype);
    const receiptFileUrl = `${env.API_PREFIX}/files/${receiptUpload.key}`;

    const hasDiscrepancies = input.discrepancies && input.discrepancies.length > 0;
    const newStatus = hasDiscrepancies ? 'RECEIVED_WITH_ISSUE' : 'RECEIVED';
    const requestStatus = hasDiscrepancies ? 'SHIPPED' : 'COMPLETED';

    // Track created overstocks for response
    const createdOverstocks: Array<{
      masterProductId: string;
      productName: string;
      quantity: number;
      reason: string;
    }> = [];

    // Process receiving
    const result = await prisma.$transaction(async (tx) => {
      // Update shipment items with received quantities
      if (input.receivedItems) {
        for (const receivedItem of input.receivedItems) {
          const shipmentItem = shipment.items.find(
            i => i.masterProductId === receivedItem.masterProductId
          );
          if (shipmentItem) {
            await tx.shipmentItem.update({
              where: { id: shipmentItem.id },
              data: { receivedQty: receivedItem.receivedQty },
            });
          }
        }
      }

      // Create discrepancy records if any
      if (hasDiscrepancies) {
        for (const discrepancy of input.discrepancies!) {
          const product = await tx.masterProduct.findUnique({
            where: { id: discrepancy.masterProductId },
            select: { name: true },
          });

          await tx.shipmentDiscrepancy.create({
            data: {
              shipmentId,
              masterProductId: discrepancy.masterProductId,
              productName: product?.name || 'Unknown',
              expectedQty: discrepancy.expectedQty,
              receivedQty: discrepancy.receivedQty,
              discrepancyType: discrepancy.discrepancyType,
              notes: discrepancy.notes,
              photoUrl: discrepancy.photoUrl,
              photoFileName: discrepancy.photoFileName,
              reportedBy: userId,
            },
          });
        }
      }

      // Update shipment status
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: newStatus,
          receivedAt: new Date(),
          receivedBy: userId,
          receiptFileUrl,
          receiptFileName: input.receiptFile.originalname,
          receiptFileSize: input.receiptFile.size,
          receiptMimeType: input.receiptFile.mimetype,
          notes: input.notes || shipment.notes,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          fromBranch: true,
          toBranch: true,
          discrepancies: {
            include: {
              masterProduct: true,
            },
          },
        },
      });

      // Update stock request status
      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: requestStatus,
            receivedBy: userId,
            receivedAt: new Date(),
            receivingNotes: hasDiscrepancies
              ? `${input.notes || ''}${input.notes ? '\n' : ''}Menunggu review Admin Manager untuk ketidaksesuaian pengiriman.`
              : input.notes,
          },
        });
      }

      // Add stock to destination branch and create overstock records
      for (const item of shipment.items) {
        // Determine actual received quantity
        let actualReceivedQty = Number(item.sentQty);
        
        if (input.receivedItems) {
          const receivedItem = input.receivedItems.find(
            ri => ri.masterProductId === item.masterProductId
          );
          if (receivedItem) {
            actualReceivedQty = receivedItem.receivedQty;
          }
        }

        // Find or create inventory item at destination branch
        let destInventoryItem = await tx.inventoryItem.findFirst({
          where: {
            branchId: shipment.toBranchId,
            masterProductId: item.masterProductId,
          },
        });

        if (!destInventoryItem) {
          // Create inventory item if doesn't exist
          destInventoryItem = await tx.inventoryItem.create({
            data: {
              branchId: shipment.toBranchId,
              masterProductId: item.masterProductId,
              stock: 0,
              minThreshold: 10,
            },
          });
        }

        const stockBefore = Number(destInventoryItem.stock);
        const stockAfter = stockBefore + actualReceivedQty;

        // Update stock
        await tx.inventoryItem.update({
          where: { id: destInventoryItem.id },
          data: {
            stock: stockAfter,
          },
        });

        // Create stock mutation record
        await tx.stockMutation.create({
          data: {
            inventoryItemId: destInventoryItem.id,
            type: StockMutationType.RECEIVED,
            quantity: actualReceivedQty,
            stockBefore,
            stockAfter,
            referenceType: 'SHIPMENT',
            referenceId: shipmentId,
            notes: `Penerimaan ${shipment.shipmentCode} dari ${shipment.fromBranch.name}${hasDiscrepancies ? ' (dengan ketidaksesuaian)' : ''}`,
            createdBy: userId,
          },
        });

        // Create overstock record if there's excess
        const overstockQty = item.overstockQty ? Number(item.overstockQty) : 0;
        if (overstockQty > 0 && item.overstockReason) {
          await tx.branchOverstock.create({
            data: {
              branchId: shipment.toBranchId,
              masterProductId: item.masterProductId,
              quantity: overstockQty,
              originalQty: overstockQty,
              reason: item.overstockReason,
              sourceShipmentId: shipmentId,
              status: 'AVAILABLE',
            },
          });

          createdOverstocks.push({
            masterProductId: item.masterProductId,
            productName: item.masterProduct.name,
            quantity: overstockQty,
            reason: item.overstockReason,
          });
        }
      }

      return updatedShipment;
    });

    // Audit log
    await logAudit({
      userId,
      branchId: shipment.toBranchId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: { 
        action: hasDiscrepancies ? 'RECEIVE_WITH_ISSUE' : 'RECEIVE',
        shipmentCode: shipment.shipmentCode,
        hasDiscrepancies,
        discrepancyCount: input.discrepancies?.length || 0,
        overstocksCreated: createdOverstocks.length,
        receiptFileName: input.receiptFile.originalname,
      },
    });

    const formattedResult = this.formatShipment(result);
    
    // Add overstock info to response
    if (createdOverstocks.length > 0) {
      (formattedResult as any).overstocksCreated = createdOverstocks;
    }

    return formattedResult;
  }

  /**
   * Review a shipment that was received with issue.
   */
  async reviewShipmentIssue(
    shipmentId: string,
    userId: string,
    input: ReviewShipmentIssueInput
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_LOGISTIK].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat mereview masalah pengiriman',
      };
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        discrepancies: true,
        fromBranch: true,
        toBranch: true,
        stockRequest: true,
      },
    });

    if (!shipment) {
      throw {
        status: 404,
        code: 'SHIPMENT_NOT_FOUND',
        message: 'Pengiriman tidak ditemukan',
      };
    }

    if (shipment.status !== 'RECEIVED_WITH_ISSUE') {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: 'Hanya pengiriman yang diterima dengan masalah yang dapat direview',
      };
    }

    if (shipment.approvedAt) {
      throw {
        status: 422,
        code: 'ISSUE_ALREADY_REVIEWED',
        message: 'Masalah pengiriman ini sudah direview',
      };
    }

    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: shipment.toBranchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda tidak memiliki akses untuk mereview pengiriman cabang ini',
        };
      }
    }

    const decision = input.decision;
    const reviewNotes = input.notes?.trim();
    const reviewLine = `[Review Admin Manager] ${
      decision === 'SEND_SHORTAGE'
        ? 'Kirim kekurangan barang'
        : decision === 'CLOSE_CASE'
          ? 'Kasus ditutup dengan catatan'
          : 'Kasus diselesaikan'
    }${reviewNotes ? ` - ${reviewNotes}` : ''}`;
    const mergedNotes = [shipment.notes, reviewLine].filter(Boolean).join('\n');

    const result = await prisma.$transaction(async (tx) => {
      if (decision === 'SEND_SHORTAGE') {
        const shortageMap = new Map<string, number>();

        if (input.shortageItems?.length) {
          input.shortageItems.forEach(item => {
            if (item.quantity > 0) {
              shortageMap.set(item.masterProductId, item.quantity);
            }
          });
        } else {
          shipment.items.forEach(item => {
            if (item.receivedQty === null || item.receivedQty === undefined) {
              return;
            }

            const shortageQty = Number(item.sentQty) - Number(item.receivedQty);
            if (shortageQty > 0) {
              shortageMap.set(item.masterProductId, shortageQty);
            }
          });

          if (shortageMap.size === 0) {
            const latestShortageByProduct = new Map<string, any>();

            shipment.discrepancies.forEach(discrepancy => {
              if (discrepancy.discrepancyType !== 'SHORTAGE') {
                return;
              }

              const existing = latestShortageByProduct.get(discrepancy.masterProductId);
              const existingTime = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
              const currentTime = discrepancy.createdAt ? new Date(discrepancy.createdAt).getTime() : 0;

              if (!existing || currentTime >= existingTime) {
                latestShortageByProduct.set(discrepancy.masterProductId, discrepancy);
              }
            });

            latestShortageByProduct.forEach(discrepancy => {
              const shortageQty = Number(discrepancy.expectedQty) - Number(discrepancy.receivedQty);
              if (shortageQty > 0) {
                shortageMap.set(discrepancy.masterProductId, shortageQty);
              }
            });
          }
        }

        if (shortageMap.size === 0) {
          throw {
            status: 422,
            code: 'NO_SHORTAGE_TO_SEND',
            message: 'Tidak ada kekurangan barang yang bisa dikirim ulang',
          };
        }

        for (const item of shipment.items) {
          const shortageQty = shortageMap.get(item.masterProductId) || 0;
          await tx.shipmentItem.update({
            where: { id: item.id },
            data: {
              sentQty: shortageQty,
              requestedQty: shortageQty,
              receivedQty: null,
              overstockQty: null,
              overstockReason: null,
            },
          });
        }

        if (shipment.stockRequestId) {
          await tx.stockRequest.update({
            where: { id: shipment.stockRequestId },
            data: {
              status: 'APPROVED',
              receivingNotes: mergedNotes,
            },
          });
        }

        return await tx.shipment.update({
          where: { id: shipmentId },
          data: {
            status: 'PREPARING',
            shippedAt: null,
            shippedBy: null,
            shipmentPhotoUrl: null,
            shipmentPhotoName: null,
            receivedAt: null,
            receivedBy: null,
            notes: mergedNotes,
          },
          include: {
            items: {
              include: {
                masterProduct: true,
              },
            },
            fromBranch: true,
            toBranch: true,
            discrepancies: true,
          },
        });
      }

      const requestStatus = decision === 'COMPLETE_CASE' ? 'COMPLETED' : 'COMPLETED_WITH_ISSUE';
      const shipmentStatus = decision === 'COMPLETE_CASE' ? 'RECEIVED' : 'RECEIVED_WITH_ISSUE';

      if (shipment.stockRequestId) {
        await tx.stockRequest.update({
          where: { id: shipment.stockRequestId },
          data: {
            status: requestStatus,
            receivingNotes: mergedNotes,
          },
        });
      }

      return await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: shipmentStatus,
          approvedAt: new Date(),
          approvedBy: userId,
          notes: mergedNotes,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          fromBranch: true,
          toBranch: true,
          discrepancies: true,
        },
      });
    });

    await logAudit({
      userId,
      branchId: shipment.toBranchId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        action: 'REVIEW_SHIPMENT_ISSUE',
        shipmentCode: shipment.shipmentCode,
        decision,
        notes: reviewNotes,
      },
    });

    return {
      shipment: this.formatShipment(result),
      message: decision === 'SEND_SHORTAGE'
        ? 'Masalah pengiriman direview. Pengiriman kekurangan barang siap disiapkan ulang.'
        : decision === 'CLOSE_CASE'
          ? 'Kasus pengiriman ditutup dengan catatan.'
          : 'Kasus pengiriman diselesaikan.',
    };
  }

  /**
   * Format shipment for response
   */
  private formatShipment(shipment: any) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      status: shipment.status,
      notes: shipment.notes,
      shipmentPhotoUrl: shipment.shipmentPhotoUrl,
      shipmentPhotoName: shipment.shipmentPhotoName,
      items: shipment.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        sentQty: Number(item.sentQty),
        requestedQty: item.requestedQty ? Number(item.requestedQty) : null,
        receivedQty: item.receivedQty ? Number(item.receivedQty) : null,
        overstockQty: item.overstockQty ? Number(item.overstockQty) : null,
        overstockReason: item.overstockReason,
        unit: item.masterProduct.baseUnit,
      })),
      discrepancies: shipment.discrepancies?.map((d: any) => ({
        id: d.id,
        masterProductId: d.masterProductId,
        productName: d.productName,
        expectedQty: Number(d.expectedQty),
        receivedQty: Number(d.receivedQty),
        discrepancyType: d.discrepancyType,
        notes: d.notes,
        photoUrl: d.photoUrl,
        photoFileName: d.photoFileName,
        createdAt: d.createdAt?.toISOString(),
      })) || [],
      shippedBy: shipment.shippedBy,
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedBy: shipment.receivedBy,
      receivedAt: shipment.receivedAt?.toISOString(),
      approvedBy: shipment.approvedBy,
      approvedAt: shipment.approvedAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
