import { prisma } from '../../../lib/prisma';
import { Prisma, ShipmentStatus, StockMutationType } from '@prisma/client';
import {
  formatStockRequestQuantity,
  getStockRequestUnit,
} from './stock-request-units';

const shipmentListInclude = {
  items: { include: { masterProduct: true } },
  fromBranch: true,
  toBranch: true,
  discrepancies: { include: { masterProduct: true } },
  receipts: {
    select: {
      id: true,
      receiptNumber: true,
      isFinal: true,
      totalQuantity: true,
      quarantinedQuantity: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: 'asc' as const },
  },
  stockRequest: {
    select: {
      id: true,
      requestCode: true,
      status: true,
      branch: { select: { id: true, name: true, type: true } },
      items: {
        select: {
          masterProductId: true,
          requestedQty: true,
          overstockDeducted: true,
          finalQty: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          paymentVerificationStatus: true,
          paymentProofUrl: true,
          paymentProofFileName: true,
          paidAt: true,
        },
      },
    },
  },
  internalTransfer: {
    include: {
      dispatchInventoryPosting: { select: { postingNumber: true } },
      receiptInventoryPosting: { select: { postingNumber: true } },
      dispatchJournalEntry: { select: { journalNumber: true } },
      receiptJournalEntry: { select: { journalNumber: true } },
    },
  },
} satisfies Prisma.ShipmentInclude;

const shipmentDetailInclude = {
  items: { include: { masterProduct: true } },
  fromBranch: true,
  toBranch: true,
  discrepancies: { include: { masterProduct: true } },
  receipts: {
    include: {
      items: { include: { shipmentItem: { include: { masterProduct: true } } } },
      discrepancies: true,
    },
    orderBy: { receivedAt: 'asc' as const },
  },
  stockRequest: {
    include: {
      branch: true,
      items: { include: { masterProduct: true } },
      invoice: { include: { items: { include: { masterProduct: true } } } },
    },
  },
  internalTransfer: shipmentListInclude.internalTransfer,
} satisfies Prisma.ShipmentInclude;

type ShipmentForList = Prisma.ShipmentGetPayload<{ include: typeof shipmentListInclude }>;
type ShipmentForDetail = Prisma.ShipmentGetPayload<{ include: typeof shipmentDetailInclude }>;
type ShipmentStockMutation = Prisma.StockMutationGetPayload<{
  select: {
    id: true;
    referenceId: true;
    stockBefore: true;
    stockAfter: true;
    quantity: true;
    inventoryItem: { select: { masterProductId: true } };
  };
}>;

/**
 * Service for retrieving shipments
 */
export class ShipmentRetrievalService {
  /**
   * Get shipments with filtering
   */
  async getShipments(
    branchIds?: string[],
    status?: ShipmentStatus,
    dateRange?: { startDate?: string; endDate?: string }
  ) {
    if (branchIds && branchIds.length === 0) {
      return [];
    }

    const where: Prisma.ShipmentWhereInput = {};

    if (branchIds && branchIds.length > 0) {
      where.OR = [
        { fromBranchId: { in: branchIds } },
        { toBranchId: { in: branchIds } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (dateRange?.startDate || dateRange?.endDate) {
      let start: Date | undefined;
      let end: Date | undefined;
      if (dateRange.startDate) {
        start = new Date(dateRange.startDate);
        start.setHours(0, 0, 0, 0);
      }
      if (dateRange.endDate) {
        end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999);
      }
      where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    }

    const shipments = await prisma.shipment.findMany({
      where,
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
        receipts: {
          select: {
            id: true,
            receiptNumber: true,
            isFinal: true,
            totalQuantity: true,
            quarantinedQuantity: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: 'asc' },
        },
        stockRequest: {
          select: {
            id: true,
            requestCode: true,
            status: true,
            branch: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            items: {
              select: {
                masterProductId: true,
                requestedQty: true,
                overstockDeducted: true,
                finalQty: true,
              },
            },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                status: true,
                paymentVerificationStatus: true,
                paymentProofUrl: true,
                paymentProofFileName: true,
                paidAt: true,
              },
            },
          },
        },
        internalTransfer: {
          include: {
            dispatchInventoryPosting: { select: { postingNumber: true } },
            receiptInventoryPosting: { select: { postingNumber: true } },
            dispatchJournalEntry: { select: { journalNumber: true } },
            receiptJournalEntry: { select: { journalNumber: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Query stock mutations separately for all shipments
    const shipmentIds = shipments.map(s => s.id);
    const stockMutationsMap = new Map<string, ShipmentStockMutation>();

    if (shipmentIds.length > 0) {
      const stockMutations = await prisma.stockMutation.findMany({
        where: {
          referenceType: { in: ['SHIPMENT', 'Shipment'] },
          referenceId: { in: shipmentIds },
          type: { in: [StockMutationType.RECEIVED, StockMutationType.TRANSFER_IN] },
        },
        select: {
          id: true,
          referenceId: true,
          stockBefore: true,
          stockAfter: true,
          quantity: true,
          inventoryItem: {
            select: {
              masterProductId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      // Create a map: shipmentId-masterProductId -> mutation
      stockMutations.forEach(mutation => {
        const key = `${mutation.referenceId}-${mutation.inventoryItem.masterProductId}`;
        stockMutationsMap.set(key, mutation);
      });
    }

    return shipments.map(shipment => this.formatShipment(shipment, stockMutationsMap));
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string) {
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
        discrepancies: {
          include: {
            masterProduct: true,
          },
        },
        receipts: {
          include: {
            items: {
              include: {
                shipmentItem: { include: { masterProduct: true } },
              },
            },
            discrepancies: true,
          },
          orderBy: { receivedAt: 'asc' },
        },
        stockRequest: {
          include: {
            branch: true,
            items: {
              include: {
                masterProduct: true,
              },
            },
            invoice: {
              include: {
                items: {
                  include: {
                    masterProduct: true,
                  },
                },
              },
            },
          },
        },
        internalTransfer: {
          include: {
            dispatchInventoryPosting: { select: { postingNumber: true } },
            receiptInventoryPosting: { select: { postingNumber: true } },
            dispatchJournalEntry: { select: { journalNumber: true } },
            receiptJournalEntry: { select: { journalNumber: true } },
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

    return this.formatShipmentDetail(shipment);
  }

  /**
   * Format shipment for list response
   */
  private formatShipment(
    shipment: ShipmentForList | ShipmentForDetail,
    stockMutationsMap?: Map<string, ShipmentStockMutation>,
  ) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      fromBranchCode: shipment.fromBranch.branchCode,
      fromBranchCity: shipment.fromBranch.city,
      fromBranchAddress: shipment.fromBranch.address,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      toBranchCode: shipment.toBranch.branchCode,
      toBranchCity: shipment.toBranch.city,
      toBranchAddress: shipment.toBranch.address,
      toBranchType: shipment.stockRequest?.branch?.type,
      status: shipment.status,
      isLedgerManaged: Boolean(shipment.shipIdempotencyKey || shipment.receipts?.length),
      notes: shipment.notes,
      shipmentPhotoUrl: shipment.shipmentPhotoUrl,
      receiptFileUrl: shipment.receiptFileUrl,
      receiptFileName: shipment.receiptFileName,
      receiptFileSize: shipment.receiptFileSize,
      receiptMimeType: shipment.receiptMimeType,
      itemCount: shipment.items.length,
      totalItems: shipment.items.reduce((sum, item) => (
        sum + formatStockRequestQuantity(item.masterProduct, item.sentQty)
      ), 0),
      hasDiscrepancies: shipment.discrepancies?.length > 0,
      discrepancyCount: shipment.discrepancies?.length || 0,
      receiptCount: shipment.receipts?.length || 0,
      items: shipment.items.map((item) => {
        // Get original requestedQty and overstock info from StockRequestItem
        let originalRequestedQty = Number(item.sentQty); // Default to sentQty
        let overstockDeducted = 0;
        
        // Try to get from StockRequestItem for accurate original request info
        if (shipment.stockRequest?.items) {
          const stockRequestItem = shipment.stockRequest.items.find(
            (sri) => sri.masterProductId === item.masterProductId
          );
          if (stockRequestItem) {
            originalRequestedQty = Number(stockRequestItem.requestedQty);
            overstockDeducted = stockRequestItem.overstockDeducted === null || stockRequestItem.overstockDeducted === undefined
              ? 0
              : Number(stockRequestItem.overstockDeducted);
          }
        }
        
        // requestedQty in ShipmentItem is the original request amount (stored for reference)
        // sentQty is the amount to send (after overstock deduction = finalQty)
        const requestedQty = item.requestedQty === null || item.requestedQty === undefined
          ? originalRequestedQty
          : Number(item.requestedQty);

        // Get stock before/after from stock mutations (RECEIVED records)
        let stockBefore: number | null = null;
        let stockAfter: number | null = null;

        if (stockMutationsMap) {
          const key = `${shipment.id}-${item.masterProductId}`;
          const mutation = stockMutationsMap.get(key);
          if (mutation) {
            stockBefore = mutation.stockBefore ? Number(mutation.stockBefore) : null;
            stockAfter = mutation.stockAfter ? Number(mutation.stockAfter) : null;
          }
        }

        return {
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.masterProduct.name,
          productCategory: item.masterProduct.category,
          sentQty: formatStockRequestQuantity(item.masterProduct, item.sentQty),
          requestedQty: formatStockRequestQuantity(item.masterProduct, requestedQty), // Original requested amount
          originalRequestedQty: formatStockRequestQuantity(item.masterProduct, originalRequestedQty), // Same as requestedQty, for clarity
          overstockDeducted: formatStockRequestQuantity(item.masterProduct, overstockDeducted), // Amount already deducted from overstock
          overstockQty: item.overstockQty === null || item.overstockQty === undefined
            ? null
            : formatStockRequestQuantity(item.masterProduct, item.overstockQty), // New overstock from this shipment
          overstockReason: item.overstockReason || null, // Reason for overstock
          receivedQty: item.receivedQty === null || item.receivedQty === undefined
            ? null
            : formatStockRequestQuantity(item.masterProduct, item.receivedQty),
          quarantineQty: formatStockRequestQuantity(item.masterProduct, item.quarantineQty || 0),
          stockBefore: stockBefore === null ? null : formatStockRequestQuantity(item.masterProduct, stockBefore), // Stock quantity at destination branch before receiving
          stockAfter: stockAfter === null ? null : formatStockRequestQuantity(item.masterProduct, stockAfter), // Stock quantity at destination branch after receiving
          unit: getStockRequestUnit(item.masterProduct),
        };
      }),
      // Stock request summary
      stockRequest: shipment.stockRequest ? {
        id: shipment.stockRequest.id,
        requestCode: shipment.stockRequest.requestCode,
        status: shipment.stockRequest.status,
        branchName: shipment.stockRequest.branch?.name,
        branchType: shipment.stockRequest.branch?.type,
        invoice: shipment.stockRequest.invoice ? {
          id: shipment.stockRequest.invoice.id,
          invoiceNumber: shipment.stockRequest.invoice.invoiceNumber,
          totalAmount: Number(shipment.stockRequest.invoice.totalAmount),
          status: shipment.stockRequest.invoice.status,
          paymentVerificationStatus: shipment.stockRequest.invoice.paymentVerificationStatus,
          paymentProofUrl: shipment.stockRequest.invoice.paymentProofUrl,
          paymentProofFileName: shipment.stockRequest.invoice.paymentProofFileName,
          paidAt: shipment.stockRequest.invoice.paidAt?.toISOString(),
        } : null,
      } : null,
      // Timestamps
      shippedBy: shipment.shippedBy,
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedBy: shipment.receivedBy,
      receivedAt: shipment.receivedAt?.toISOString(),
      approvedBy: shipment.approvedBy,
      approvedAt: shipment.approvedAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      internalTransfer: shipment.internalTransfer ? {
        status: shipment.internalTransfer.status,
        totalValue: shipment.internalTransfer.totalValue.toFixed(4),
        receivedValue: shipment.internalTransfer.receivedValue.toFixed(4),
        dispatchInventoryPosting: shipment.internalTransfer.dispatchInventoryPosting?.postingNumber,
        receiptInventoryPosting: shipment.internalTransfer.receiptInventoryPosting?.postingNumber,
        dispatchJournal: shipment.internalTransfer.dispatchJournalEntry?.journalNumber,
        receiptJournal: shipment.internalTransfer.receiptJournalEntry?.journalNumber,
      } : null,
    };
  }

  /**
   * Format shipment for detail response
   */
  private formatShipmentDetail(shipment: ShipmentForDetail) {
    const base = this.formatShipment(shipment);

    return {
      ...base,
      shipmentPhotoName: shipment.shipmentPhotoName,
      // Full discrepancies
      discrepancies: shipment.discrepancies?.map((d) => ({
        id: d.id,
        masterProductId: d.masterProductId,
        productName: d.productName,
        expectedQty: formatStockRequestQuantity(d.masterProduct, d.expectedQty),
        receivedQty: formatStockRequestQuantity(d.masterProduct, d.receivedQty),
        discrepancyType: d.discrepancyType,
        quarantinedQty: formatStockRequestQuantity(d.masterProduct, d.quarantinedQty || 0),
        status: d.status,
        notes: d.notes,
        photoUrl: d.photoUrl,
        photoFileName: d.photoFileName,
        reportedBy: d.reportedBy,
        createdAt: d.createdAt?.toISOString(),
      })) || [],
      receipts: shipment.receipts?.map((receipt) => ({
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        isFinal: receipt.isFinal,
        totalQuantity: Number(receipt.totalQuantity),
        quarantinedQuantity: Number(receipt.quarantinedQuantity),
        totalCost: receipt.totalCost === undefined ? undefined : Number(receipt.totalCost),
        evidenceFileUrl: receipt.evidenceFileUrl,
        evidenceFileName: receipt.evidenceFileName,
        receivedBy: receipt.receivedBy,
        receivedAt: receipt.receivedAt?.toISOString(),
        items: receipt.items?.map((item) => ({
          masterProductId: item.shipmentItem.masterProductId,
          productName: item.shipmentItem.masterProduct.name,
          receivedQty: Number(item.receivedQty),
          quarantineQty: Number(item.quarantineQty),
          unitCost: Number(item.unitCost),
          totalCost: Number(item.totalCost),
        })),
      })) || [],
      // Full stock request
      stockRequest: shipment.stockRequest ? {
        id: shipment.stockRequest.id,
        requestCode: shipment.stockRequest.requestCode,
        status: shipment.stockRequest.status,
        branchId: shipment.stockRequest.branch?.id,
        branchName: shipment.stockRequest.branch?.name,
        branchType: shipment.stockRequest.branch?.type,
        items: shipment.stockRequest.items?.map((item) => ({
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.masterProduct.name,
          requestedQty: formatStockRequestQuantity(item.masterProduct, item.requestedQty),
          approvedQty: item.approvedQty ? formatStockRequestQuantity(item.masterProduct, item.approvedQty) : null,
          unit: getStockRequestUnit(item.masterProduct),
        })),
        invoice: shipment.stockRequest.invoice ? {
          id: shipment.stockRequest.invoice.id,
          invoiceNumber: shipment.stockRequest.invoice.invoiceNumber,
          subtotal: Number(shipment.stockRequest.invoice.subtotal),
          totalAmount: Number(shipment.stockRequest.invoice.totalAmount),
          status: shipment.stockRequest.invoice.status,
          paymentVerificationStatus: shipment.stockRequest.invoice.paymentVerificationStatus,
          paymentProofUrl: shipment.stockRequest.invoice.paymentProofUrl,
          paymentProofFileName: shipment.stockRequest.invoice.paymentProofFileName,
          paidAt: shipment.stockRequest.invoice.paidAt?.toISOString(),
          items: shipment.stockRequest.invoice.items?.map((item) => ({
            id: item.id,
            masterProductId: item.masterProductId,
            sku: item.sku,
            productName: item.productName,
            description: item.description,
            quantity: formatStockRequestQuantity(item.masterProduct, item.quantity),
            pricePerUnit: Number(item.pricePerUnit),
            subtotal: Number(item.subtotal),
          })),
        } : null,
      } : null,
    };
  }
}
