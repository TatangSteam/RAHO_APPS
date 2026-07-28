// @ts-nocheck
import { ShipmentStatus, DiscrepancyType, Role, AuditAction, BranchType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { errors } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/auditLog';
import { ShipmentProcessingService } from './services/shipment-processing.service';
import { ShipmentRetrievalService } from './services/shipment-retrieval.service';
import { parseStockRequestQuantity } from './services/stock-request-units';
import { dispatchShipmentSchema, receiveShipmentLedgerSchema } from './shipment-ledger.schema';
import {
  dispatchReservedShipment,
  hasReservedShipment,
  receiveReservedShipment,
} from './services/shipment-ledger.service';

interface ReceiveShipmentInput {
  receivedItems?: Array<{
    masterProductId: string;
    receivedQty: number;
    quarantineQty?: number;
    stockLocationId?: string;
    unit?: string;
  }>;
  discrepancies?: Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: DiscrepancyType;
    unit?: string;
    notes?: string;
    photoUrl?: string;
    photoFileName?: string;
  }>;
  notes?: string;
  idempotencyKey?: string;
  isFinal?: boolean | string;
  occurredAt?: string | Date;
  receiptFile?: Express.Multer.File;
}

interface ReviewShipmentIssueInput {
  decision: 'SEND_SHORTAGE' | 'CLOSE_CASE' | 'COMPLETE_CASE';
  notes?: string;
  shortageItems?: Array<{
    masterProductId: string;
    quantity: number;
    unit?: string;
  }>;
}

/**
 * Main Shipment Service - Orchestrates shipment operations
 */
export class ShipmentService {
  private processingService: ShipmentProcessingService;
  private retrievalService: ShipmentRetrievalService;

  constructor() {
    this.processingService = new ShipmentProcessingService();
    this.retrievalService = new ShipmentRetrievalService();
  }

  /**
   * Ship shipment (mark as shipped by Admin Manager)
   * Supports sending more items than requested (overstock)
   */
  async shipShipment(
    shipmentId: string, 
    userId: string, 
    data?: { 
      notes?: string;
      shipmentPhotoUrl?: string;
      shipmentPhotoName?: string;
      idempotencyKey?: string;
      occurredAt?: string | Date;
      items?: Array<{
        masterProductId: string;
        sentQty: number;
        unit?: string;
        overstockReason?: string;
      }>;
    }
  ) {
    if (await hasReservedShipment(shipmentId)) {
      const input = dispatchShipmentSchema.parse({
        ...data,
        idempotencyKey: data?.idempotencyKey,
        occurredAt: data?.occurredAt,
      });
      return dispatchReservedShipment(userId, shipmentId, input);
    }
    const shipmentScope = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { toBranch: { select: { type: true } } },
    });
    if (!shipmentScope) throw errors.notFound('Shipment tidak ditemukan.');
    if (shipmentScope.toBranch.type === BranchType.PARTNERSHIP) {
      throw errors.unprocessable(
        'PARTNERSHIP_LEDGER_DISPATCH_REQUIRED',
        'Shipment Partnership harus melalui approval dan reservation FIFO sebelum dikirim.',
      );
    }
    return await this.processingService.shipShipment(shipmentId, userId, data);
  }

  /**
   * Receive shipment (by Admin Cabang)
   * Supports receiving with discrepancy reporting
   */
  async receiveShipment(shipmentId: string, userId: string, input: ReceiveShipmentInput = {}) {
    if (await hasReservedShipment(shipmentId)) {
      const parsed = receiveShipmentLedgerSchema.parse({
        ...input,
        idempotencyKey: input.idempotencyKey,
        receivedItems: input.receivedItems,
        discrepancies: input.discrepancies,
        receiptFile: undefined,
      });
      return receiveReservedShipment(userId, shipmentId, parsed, { receiptFile: input.receiptFile });
    }
    return await this.processingService.receiveShipment(shipmentId, userId, input);
  }

  /**
   * Review shipment issue (by Admin Manager / Super Admin)
   */
  async reviewShipmentIssue(shipmentId: string, userId: string, input: ReviewShipmentIssueInput) {
    if (await hasReservedShipment(shipmentId)) {
      throw errors.unprocessable(
        'LEDGER_DISCREPANCY_REVIEW_REQUIRED',
        'Discrepancy shipment ledger harus diselesaikan melalui workflow resolution/adjustment agar quarantine dan valuasi tetap konsisten.',
      );
    }
    return await this.processingService.reviewShipmentIssue(shipmentId, userId, input);
  }

  /**
   * Update a preparing shipment before it is shipped (Admin Manager / Super Admin).
   */
  async updateShipment(
    shipmentId: string,
    userId: string,
    data: {
      notes?: string;
      items?: Array<{
        masterProductId: string;
        sentQty: number;
        unit?: string;
        overstockReason?: string;
      }>;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || ![
      Role.SUPER_ADMIN,
      Role.ADMIN_MANAGER,
      Role.ADMIN_LOGISTIK,
      Role.FINANCE_LOGISTICS_CONTROLLER,
    ].includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat mengedit pengiriman',
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

    if (shipment.status !== ShipmentStatus.PREPARING) {
      throw {
        status: 422,
        code: 'SHIPMENT_NOT_EDITABLE',
        message: 'Pengiriman hanya dapat diedit saat status masih disiapkan',
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
          message: 'Anda hanya dapat mengedit pengiriman ke cabang yang Anda kelola',
        };
      }
    }

    let itemUpdates = Array.isArray(data.items) ? data.items : undefined;
    if (itemUpdates) {
      itemUpdates = itemUpdates.map((item) => {
        const shipmentItem = shipment.items.find((shipmentItem) => shipmentItem.masterProductId === item.masterProductId);
        return {
          ...item,
          sentQty: parseStockRequestQuantity(shipmentItem?.masterProduct, item.sentQty, item.unit),
        };
      });
    }

    if (itemUpdates) {
      if (itemUpdates.length === 0) {
        throw {
          status: 400,
          code: 'ITEMS_REQUIRED',
          message: 'Minimal satu item harus dikirim untuk update',
        };
      }

      const existingProductIds = new Set(shipment.items.map(item => item.masterProductId));
      const seenProductIds = new Set<string>();

      for (const item of itemUpdates) {
        if (!item.masterProductId || !existingProductIds.has(item.masterProductId)) {
          throw {
            status: 400,
            code: 'INVALID_ITEM',
            message: 'Item yang diedit harus berasal dari pengiriman ini',
          };
        }

        if (seenProductIds.has(item.masterProductId)) {
          throw {
            status: 400,
            code: 'DUPLICATE_ITEM',
            message: 'Item pengiriman tidak boleh duplikat',
          };
        }

        if (item.sentQty === undefined || item.sentQty === null || Number(item.sentQty) < 0) {
          throw {
            status: 400,
            code: 'INVALID_QUANTITY',
            message: 'Jumlah kirim tidak boleh negatif',
          };
        }

        const requestItem = shipment.stockRequest.items.find(
          requestItem => requestItem.masterProductId === item.masterProductId
        );
        const expectedQty = Math.max(
          0,
          Number(requestItem?.requestedQty || 0) - Number(requestItem?.overstockDeducted || 0)
        );

        if (Number(item.sentQty) > expectedQty && !item.overstockReason?.trim()) {
          throw {
            status: 400,
            code: 'OVERSTOCK_REASON_REQUIRED',
            message: 'Alasan overstock wajib diisi jika jumlah kirim melebihi kebutuhan',
          };
        }

        seenProductIds.add(item.masterProductId);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        },
      });

      if (!itemUpdates) {
        return;
      }

      for (const item of itemUpdates) {
        const shipmentItem = shipment.items.find(i => i.masterProductId === item.masterProductId);
        const requestItem = shipment.stockRequest.items.find(
          requestItem => requestItem.masterProductId === item.masterProductId
        );
        const originalRequestedQty = Number(requestItem?.requestedQty || shipmentItem.requestedQty || shipmentItem.sentQty);
        const overstockDeducted = Number(requestItem?.overstockDeducted || 0);
        const expectedQty = Math.max(0, originalRequestedQty - overstockDeducted);
        const overstockQty = Math.max(0, Number(item.sentQty) - expectedQty);

        await tx.shipmentItem.update({
          where: { id: shipmentItem.id },
          data: {
            sentQty: item.sentQty,
            requestedQty: originalRequestedQty,
            overstockQty: overstockQty > 0 ? overstockQty : null,
            overstockReason: overstockQty > 0 ? item.overstockReason?.trim() : null,
          },
        });
      }
    });

    await logAudit({
      userId,
      branchId: shipment.toBranchId,
      action: AuditAction.UPDATE,
      resource: 'Shipment',
      resourceId: shipmentId,
      meta: {
        action: 'UPDATE_PREPARING_SHIPMENT',
        shipmentCode: shipment.shipmentCode,
        itemCount: itemUpdates?.length,
      },
    });

    return await this.retrievalService.getShipmentById(shipmentId);
  }

  /**
   * Get shipments
   */
  async getShipments(
    branchIds?: string[],
    status?: ShipmentStatus,
    dateRange?: { startDate?: string; endDate?: string }
  ) {
    return await this.retrievalService.getShipments(branchIds, status, dateRange);
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string) {
    return await this.retrievalService.getShipmentById(shipmentId);
  }

  /**
   * @deprecated Use receiveShipment instead
   */
  async approveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    // Legacy method - redirect to receiveShipment
    return await this.processingService.receiveShipment(shipmentId, userId, { notes });
  }
}
