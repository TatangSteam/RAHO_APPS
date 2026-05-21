// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { StockRequestStatus, Role } from '@prisma/client';

interface GetRequestsOptions {
  branchId?: string;
  branchIds?: string[];
  status?: StockRequestStatus;
  statuses?: StockRequestStatus[];
  userId?: string;
  userRole?: Role;
  page?: number;
  limit?: number;
}

/**
 * Service for retrieving stock requests
 */
export class StockRequestRetrievalService {
  /**
   * Get stock requests with filtering
   * 
   * Access rules:
   * - SUPER_ADMIN: Can see all requests
   * - ADMIN_MANAGER: Can see requests from branches they manage
   * - ADMIN_CABANG: Can see requests from their own branch
   */
  async getRequests(options: GetRequestsOptions = {}) {
    const { 
      branchId, 
      branchIds, 
      status, 
      statuses,
      userId,
      userRole,
      page = 1, 
      limit = 50 
    } = options;

    const where: any = {};

    // Branch filtering
    if (branchId) {
      where.branchId = branchId;
    } else if (branchIds && branchIds.length > 0) {
      where.branchId = { in: branchIds };
    }

    // Status filtering
    if (status) {
      where.status = status;
    } else if (statuses && statuses.length > 0) {
      where.status = { in: statuses };
    }

    // For ADMIN_CABANG, only show their own requests
    if (userRole === Role.ADMIN_CABANG && userId) {
      where.requestedBy = userId;
    }

    const [requests, total] = await Promise.all([
      prisma.stockRequest.findMany({
        where,
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          branch: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              status: true,
              paymentVerificationStatus: true,
            },
          },
          shipment: {
            select: {
              id: true,
              shipmentCode: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockRequest.count({ where }),
    ]);

    return {
      data: requests.map(request => this.formatStockRequest(request)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get requests for Admin Manager (only from managed branches)
   */
  async getRequestsForManager(userId: string, options: Omit<GetRequestsOptions, 'branchIds'> = {}) {
    // Get managed branches
    const managedBranches = await prisma.managerBranch.findMany({
      where: { userId },
      select: { branchId: true },
    });

    const branchIds = managedBranches.map(mb => mb.branchId);

    if (branchIds.length === 0) {
      return {
        data: [],
        pagination: {
          page: options.page || 1,
          limit: options.limit || 50,
          total: 0,
          totalPages: 0,
        },
      };
    }

    return this.getRequests({
      ...options,
      branchIds,
      userRole: Role.ADMIN_MANAGER,
    });
  }

  /**
   * Get requests pending review (for Admin Manager dashboard)
   */
  async getPendingReviewRequests(userId: string, userRole: Role) {
    let branchIds: string[] | undefined;

    if (userRole === Role.ADMIN_MANAGER) {
      const managedBranches = await prisma.managerBranch.findMany({
        where: { userId },
        select: { branchId: true },
      });
      branchIds = managedBranches.map(mb => mb.branchId);
    }

    const where: any = {
      status: {
        in: ['PENDING', 'PAYMENT_UPLOADED'],
      },
    };

    if (branchIds && branchIds.length > 0) {
      where.branchId = { in: branchIds };
    }

    const requests = await prisma.stockRequest.findMany({
      where,
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        branch: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            paymentVerificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first
      take: 20,
    });

    return requests.map(request => this.formatStockRequest(request));
  }

  /**
   * Get stock request by ID
   */
  async getRequestById(requestId: string) {
    const request = await prisma.stockRequest.findUnique({
      where: { id: requestId },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        branch: true,
        invoice: {
          include: {
            items: {
              include: {
                masterProduct: true,
              },
            },
          },
        },
        shipment: {
          include: {
            fromBranch: true,
            toBranch: true,
            items: {
              include: {
                masterProduct: true,
              },
            },
            discrepancies: {
              include: {
                masterProduct: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw {
        status: 404,
        code: 'REQUEST_NOT_FOUND',
        message: 'Permintaan stok tidak ditemukan',
      };
    }

    return this.formatStockRequestDetail(request);
  }

  /**
   * Get requests by status for a branch
   */
  async getRequestsByStatus(branchId: string, statuses: StockRequestStatus[]) {
    const requests = await prisma.stockRequest.findMany({
      where: {
        branchId,
        status: { in: statuses },
      },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        branch: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
          },
        },
        shipment: {
          select: {
            id: true,
            shipmentCode: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map(request => this.formatStockRequest(request));
  }

  /**
   * Format stock request for list response
   */
  private formatStockRequest(request: any) {
    return {
      id: request.id,
      requestCode: request.requestCode,
      branchId: request.branchId,
      branchName: request.branch.name,
      branchType: request.branch.type,
      status: request.status,
      notes: request.notes,
      itemCount: request.items.length,
      totalItems: request.items.reduce((sum: number, item: any) => sum + Number(item.requestedQty), 0),
      items: request.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        requestedQty: Number(item.requestedQty),
        approvedQty: item.approvedQty ? Number(item.approvedQty) : null,
        unit: item.masterProduct.baseUnit,
        notes: item.notes,
      })),
      // Invoice summary
      invoice: request.invoice ? {
        id: request.invoice.id,
        invoiceNumber: request.invoice.invoiceNumber,
        totalAmount: Number(request.invoice.totalAmount),
        status: request.invoice.status,
        paymentVerificationStatus: request.invoice.paymentVerificationStatus,
      } : null,
      // Shipment summary
      shipment: request.shipment ? {
        id: request.shipment.id,
        shipmentCode: request.shipment.shipmentCode,
        status: request.shipment.status,
      } : null,
      // Payment info
      paymentProofUrl: request.paymentProofUrl,
      paymentUploadedAt: request.paymentUploadedAt?.toISOString(),
      // Timestamps
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  /**
   * Format stock request for detail response
   */
  private formatStockRequestDetail(request: any) {
    const base = this.formatStockRequest(request);

    return {
      ...base,
      // Full payment info
      paymentProofFileName: request.paymentProofFileName,
      paymentProofFileSize: request.paymentProofFileSize,
      paymentProofMimeType: request.paymentProofMimeType,
      paymentUploadedBy: request.paymentUploadedBy,
      paymentVerifiedBy: request.paymentVerifiedBy,
      paymentVerifiedAt: request.paymentVerifiedAt?.toISOString(),
      paymentVerificationNotes: request.paymentVerificationNotes,
      paymentRejectionReason: request.paymentRejectionReason,
      // Review info
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt?.toISOString(),
      reviewNotes: request.reviewNotes,
      // Shipping info
      shippedBy: request.shippedBy,
      shippedAt: request.shippedAt?.toISOString(),
      // Receiving info
      receivedBy: request.receivedBy,
      receivedAt: request.receivedAt?.toISOString(),
      receivingNotes: request.receivingNotes,
      // Full invoice
      invoice: request.invoice ? {
        id: request.invoice.id,
        invoiceNumber: request.invoice.invoiceNumber,
        subtotal: Number(request.invoice.subtotal),
        totalAmount: Number(request.invoice.totalAmount),
        status: request.invoice.status,
        paymentVerificationStatus: request.invoice.paymentVerificationStatus,
        paymentProofUrl: request.invoice.paymentProofUrl,
        paymentProofFileName: request.invoice.paymentProofFileName,
        verifiedAt: request.invoice.verifiedAt?.toISOString(),
        paidAt: request.invoice.paidAt?.toISOString(),
        rejectionReason: request.invoice.rejectionReason,
        items: request.invoice.items?.map((item: any) => ({
          id: item.id,
          masterProductId: item.masterProductId,
          sku: item.sku,
          productName: item.productName,
          description: item.description,
          quantity: Number(item.quantity),
          pricePerUnit: Number(item.pricePerUnit),
          subtotal: Number(item.subtotal),
        })),
        createdAt: request.invoice.createdAt?.toISOString(),
      } : null,
      // Full shipment
      shipment: request.shipment ? {
        id: request.shipment.id,
        shipmentCode: request.shipment.shipmentCode,
        fromBranchId: request.shipment.fromBranchId,
        fromBranchName: request.shipment.fromBranch.name,
        toBranchId: request.shipment.toBranchId,
        toBranchName: request.shipment.toBranch.name,
        status: request.shipment.status,
        notes: request.shipment.notes,
        items: request.shipment.items?.map((item: any) => ({
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.masterProduct.name,
          sentQty: Number(item.sentQty),
          receivedQty: item.receivedQty ? Number(item.receivedQty) : null,
          unit: item.masterProduct.baseUnit,
        })),
        discrepancies: request.shipment.discrepancies?.map((d: any) => ({
          id: d.id,
          masterProductId: d.masterProductId,
          productName: d.productName,
          expectedQty: Number(d.expectedQty),
          receivedQty: Number(d.receivedQty),
          discrepancyType: d.discrepancyType,
          notes: d.notes,
          photoUrl: d.photoUrl,
        })),
        shippedAt: request.shipment.shippedAt?.toISOString(),
        shippedBy: request.shipment.shippedBy,
        receivedAt: request.shipment.receivedAt?.toISOString(),
        receivedBy: request.shipment.receivedBy,
        createdAt: request.shipment.createdAt?.toISOString(),
      } : null,
    };
  }
}
