// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role, BranchType, StockRequestStatus, StockMutationType } from '@prisma/client';
import { deleteFileByUrl } from '../../../config/minio';

interface InvoiceItemInput {
  masterProductId: string;
  quantity: number;
  pricePerUnit: number;
}

interface CreateInvoiceInput {
  items: InvoiceItemInput[];
  notes?: string;
}

/**
 * Service for approving/rejecting stock requests
 * 
 * Approval Rules:
 * - SUPER_ADMIN: Can approve any request
 * - ADMIN_MANAGER: Can only approve requests from branches they manage
 * 
 * Flow based on Branch Type:
 * - PREMIER & PARTNERSHIP: Create invoice → Wait for payment → Confirm payment → Create shipment
 *   (Both branch types now follow the same invoice/payment flow)
 * - PUSAT: Direct internal transfers (not handled here)
 */
export class StockRequestApprovalService {
  // Branch code for external/system shipments
  private readonly EXTERNAL_BRANCH_CODE = 'EXT';

  /**
   * Get or create the external/system branch for shipments
   */
  private async getOrCreateExternalBranch() {
    let externalBranch = await prisma.branch.findFirst({
      where: { branchCode: this.EXTERNAL_BRANCH_CODE },
    });

    if (!externalBranch) {
      externalBranch = await prisma.branch.create({
        data: {
          branchCode: this.EXTERNAL_BRANCH_CODE,
          name: 'External / Sistem',
          type: BranchType.PUSAT,
          address: 'Pengiriman dari sistem eksternal',
          phone: '-',
          isActive: true,
        },
      });
    }

    return externalBranch;
  }

  /**
   * Validate user has permission to manage the request
   */
  private async validateManagerPermission(userId: string, branchId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN_MANAGER)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin atau Admin Manager yang dapat memproses permintaan stok',
      };
    }

    // For Admin Manager: verify they manage the requesting branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_ACCESS_DENIED',
          message: 'Anda hanya dapat memproses permintaan dari cabang yang Anda kelola',
        };
      }
    }

    return user;
  }

  /**
   * Get request with validation
   */
  private async getRequestWithValidation(requestId: string, allowedStatuses: StockRequestStatus[]) {
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
            items: true,
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

    if (!allowedStatuses.includes(request.status)) {
      throw {
        status: 422,
        code: 'INVALID_STATUS',
        message: `Permintaan stok tidak dapat diproses. Status saat ini: ${request.status}`,
      };
    }

    return request;
  }

  /**
   * Add stock to branch inventory
   * Called after payment confirmation (for both Premier and Partnership branches)
   */
  private async addStockToBranch(
    tx: any,
    branchId: string,
    items: Array<{ masterProductId: string; requestedQty: any; masterProduct: any }>,
    userId: string,
    referenceId: string,
    referenceCode: string
  ) {
    const stockAdditions = [];

    console.log(`[StockRequest] Adding stock to branch ${branchId} for ${items.length} items`);

    for (const item of items) {
      const requestedQty = Number(item.requestedQty);

      console.log(`[StockRequest] Processing item: ${item.masterProduct.name}, qty: ${requestedQty}`);

      // Find or create inventory item at destination branch
      let inventoryItem = await tx.inventoryItem.findFirst({
        where: {
          branchId,
          masterProductId: item.masterProductId,
        },
      });

      if (!inventoryItem) {
        // Create inventory item if doesn't exist
        console.log(`[StockRequest] Creating new inventory item for ${item.masterProduct.name}`);
        inventoryItem = await tx.inventoryItem.create({
          data: {
            branchId,
            masterProductId: item.masterProductId,
            stock: 0,
            minThreshold: 10,
          },
        });
      }

      const stockBefore = Number(inventoryItem.stock);
      const stockAfter = stockBefore + requestedQty;

      console.log(`[StockRequest] ${item.masterProduct.name}: ${stockBefore} -> ${stockAfter}`);

      // Update stock
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          stock: stockAfter,
        },
      });

      // Create stock mutation record
      await tx.stockMutation.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: StockMutationType.RECEIVED,
          quantity: requestedQty,
          stockBefore,
          stockAfter,
          referenceType: 'STOCK_REQUEST',
          referenceId,
          notes: `Penambahan stok dari request ${referenceCode}`,
          createdBy: userId,
        },
      });

      stockAdditions.push({
        productName: item.masterProduct.name,
        quantity: requestedQty,
        stockBefore,
        stockAfter,
      });
    }

    return stockAdditions;
  }

  /**
   * @deprecated Use createInvoice instead. Both Premier and Partnership now follow the same invoice flow.
   * This method is kept for backward compatibility but now redirects to createInvoice.
   */
  async approvePremierRequest(requestId: string, userId: string, reviewNotes?: string) {
    // Redirect to the unified invoice creation flow
    // Create a minimal invoice with 0 price (can be updated later if needed)
    const request = await this.getRequestWithValidation(requestId, ['PENDING']);
    
    // Build invoice items with 0 price (free transfer for Premier)
    const invoiceItems = request.items.map(item => ({
      masterProductId: item.masterProductId,
      quantity: Number(item.requestedQty),
      pricePerUnit: 0,
    }));

    return this.createInvoice(requestId, userId, { items: invoiceItems, notes: reviewNotes });
  }

  /**
   * Create invoice for stock request (unified flow for both Premier and Partnership branches)
   * This is the main approval method - creates invoice and sets status to WAITING_PAYMENT
   */
  async createInvoice(requestId: string, userId: string, invoiceData: CreateInvoiceInput) {
    const request = await this.getRequestWithValidation(requestId, ['PENDING']);
    const user = await this.validateManagerPermission(userId, request.branchId);

    // Both PREMIER and PARTNERSHIP branches now use the same invoice flow
    if (request.branch.type !== BranchType.PREMIER && request.branch.type !== BranchType.PARTNERSHIP) {
      throw {
        status: 422,
        code: 'INVALID_BRANCH_TYPE',
        message: 'Endpoint ini hanya untuk cabang Premier (Cabang) atau Partnership.',
      };
    }

    // Validate invoice items match request items
    const requestProductIds = request.items.map(i => i.masterProductId);
    const invoiceProductIds = invoiceData.items.map(i => i.masterProductId);
    
    for (const productId of invoiceProductIds) {
      if (!requestProductIds.includes(productId)) {
        throw {
          status: 400,
          code: 'INVALID_INVOICE_ITEM',
          message: 'Item invoice tidak sesuai dengan item permintaan',
        };
      }
    }

    // Calculate totals
    let subtotal = 0;
    const invoiceItems = invoiceData.items.map(item => {
      const requestItem = request.items.find(ri => ri.masterProductId === item.masterProductId);
      const itemSubtotal = item.quantity * item.pricePerUnit;
      subtotal += itemSubtotal;
      
      return {
        masterProductId: item.masterProductId,
        sku: requestItem?.masterProduct.sku || null,
        productName: requestItem?.masterProduct.name || 'Unknown',
        description: requestItem?.masterProduct.description || null,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        subtotal: itemSubtotal,
      };
    });
    const isFreeRequest = subtotal <= 0;
    const now = new Date();
    const senderBranch = isFreeRequest ? await this.getOrCreateExternalBranch() : null;
    const shipmentCode = isFreeRequest
      ? await this.generateShipmentCode(senderBranch.id, request.branchId)
      : null;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(request.branchId);

    // Create invoice and update request in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.stockRequestInvoice.create({
        data: {
          invoiceNumber,
          stockRequestId: requestId,
          branchId: request.branchId,
          subtotal,
          totalAmount: subtotal,
          status: isFreeRequest ? 'PAID' : 'PENDING_PAYMENT',
          paymentVerificationStatus: isFreeRequest ? 'VERIFIED' : 'PENDING',
          verifiedBy: isFreeRequest ? userId : null,
          verifiedAt: isFreeRequest ? now : null,
          verificationNotes: isFreeRequest ? 'Invoice gratis - tidak memerlukan bukti pembayaran' : null,
          paidAt: isFreeRequest ? now : null,
          notes: invoiceData.notes,
          createdBy: userId,
          items: {
            create: invoiceItems,
          },
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
        },
      });

      // Update request status
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: isFreeRequest ? 'APPROVED' : 'WAITING_PAYMENT',
          reviewedBy: userId,
          reviewedAt: now,
          paymentVerifiedBy: isFreeRequest ? userId : null,
          paymentVerifiedAt: isFreeRequest ? now : null,
          paymentVerificationNotes: isFreeRequest
            ? 'Invoice gratis - tidak memerlukan bukti pembayaran'
            : null,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          branch: true,
          invoice: {
            include: {
              items: true,
            },
          },
        },
      });

      const shipment = isFreeRequest
        ? await tx.shipment.create({
            data: {
              shipmentCode,
              fromBranchId: senderBranch.id,
              toBranchId: request.branchId,
              stockRequestId: requestId,
              status: 'PREPARING',
              notes: `Pengiriman untuk permintaan ${request.requestCode} (Gratis - tanpa bukti pembayaran)`,
              items: {
                create: request.items.map(item => ({
                  masterProductId: item.masterProductId,
                  sentQty: item.finalQty || item.requestedQty,
                  requestedQty: item.requestedQty,
                })),
              },
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
          })
        : null;

      return { updatedRequest, invoice, shipment };
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'StockRequestInvoice',
      resourceId: result.invoice.id,
      meta: { 
        requestId,
        invoiceNumber,
        totalAmount: subtotal,
        branchType: request.branch.type,
        paymentRequired: !isFreeRequest,
        shipmentId: result.shipment?.id,
      },
    });

    const response: any = {
      request: this.formatStockRequest(result.updatedRequest),
      invoice: this.formatInvoice(result.invoice),
      message: isFreeRequest
        ? 'Request gratis disetujui dan pengiriman telah dibuat tanpa bukti pembayaran.'
        : 'Invoice berhasil dibuat. Menunggu upload bukti pembayaran.',
    };

    if (result.shipment) {
      response.shipment = this.formatShipment(result.shipment);
    }

    return response;
  }

  /**
   * @deprecated Use createInvoice instead. This method is kept for backward compatibility.
   * Create invoice for PARTNERSHIP branch (now also works for PREMIER)
   */
  async createPartnershipInvoice(requestId: string, userId: string, invoiceData: CreateInvoiceInput) {
    // Redirect to the unified createInvoice method
    return this.createInvoice(requestId, userId, invoiceData);
  }

  /**
   * Upload payment proof (by Admin Manager after receiving proof from Admin Cabang externally)
   */
  async uploadPaymentProof(
    requestId: string, 
    userId: string, 
    fileData: {
      url: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    }
  ) {
    const request = await this.getRequestWithValidation(requestId, ['WAITING_PAYMENT']);

    // Verify user is Admin Manager or Super Admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    if (!user || (user.role !== Role.ADMIN_MANAGER && user.role !== Role.SUPER_ADMIN)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Admin Manager atau Super Admin yang dapat mengupload bukti pembayaran',
      };
    }

    // For Admin Manager, verify they manage this branch
    if (user.role === Role.ADMIN_MANAGER) {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId,
          branchId: request.branchId,
        },
      });

      if (!managerBranch) {
        throw {
          status: 403,
          code: 'BRANCH_NOT_MANAGED',
          message: 'Anda tidak mengelola cabang ini',
        };
      }
    }

    // Delete old payment proof from MinIO if exists (when re-uploading)
    if (request.paymentProofUrl) {
      console.log(`[StockRequest] Deleting old payment proof: ${request.paymentProofUrl}`);
      await deleteFileByUrl(request.paymentProofUrl);
    }

    // Update request and invoice with payment proof
    const result = await prisma.$transaction(async (tx) => {
      // Update request
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'PAYMENT_UPLOADED',
          paymentProofUrl: fileData.url,
          paymentProofFileName: fileData.fileName,
          paymentProofFileSize: fileData.fileSize,
          paymentProofMimeType: fileData.mimeType,
          paymentUploadedAt: new Date(),
          paymentUploadedBy: userId,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          branch: true,
          invoice: {
            include: {
              items: true,
            },
          },
        },
      });

      // Update invoice if exists
      if (request.invoice) {
        await tx.stockRequestInvoice.update({
          where: { id: request.invoice.id },
          data: {
            paymentProofUrl: fileData.url,
            paymentProofFileName: fileData.fileName,
            paymentProofFileSize: fileData.fileSize,
            paymentProofMimeType: fileData.mimeType,
            paymentUploadedAt: new Date(),
            paymentUploadedBy: userId,
          },
        });
      }

      return updatedRequest;
    });

    // Audit log
    await logAudit({
      userId,
      branchId: request.branchId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { 
        action: 'UPLOAD_PAYMENT_PROOF',
        fileName: fileData.fileName,
      },
    });

    return this.formatStockRequest(result);
  }

  /**
   * Confirm payment (by Admin Manager)
   * Creates shipment after payment confirmation - stock is added when Admin Cabang receives the shipment
   */
  async confirmPayment(requestId: string, userId: string, verificationNotes?: string) {
    const request = await this.getRequestWithValidation(requestId, ['WAITING_PAYMENT', 'PAYMENT_UPLOADED']);
    const user = await this.validateManagerPermission(userId, request.branchId);
    const isFreeRequest = Number(request.invoice?.totalAmount || 0) <= 0;

    if (!isFreeRequest && request.status === 'WAITING_PAYMENT') {
      throw {
        status: 422,
        code: 'PAYMENT_PROOF_REQUIRED',
        message: 'Bukti pembayaran wajib diupload untuk invoice berbayar',
      };
    }

    if (!isFreeRequest && !request.paymentProofUrl) {
      throw {
        status: 422,
        code: 'NO_PAYMENT_PROOF',
        message: 'Bukti pembayaran belum diupload',
      };
    }

    const senderBranch = await this.getOrCreateExternalBranch();
    const shipmentCode = await this.generateShipmentCode(senderBranch.id, request.branchId);

    // Update request, invoice, and create shipment
    const result = await prisma.$transaction(async (tx) => {
      // Update request to APPROVED (shipment will be created)
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          paymentVerifiedBy: userId,
          paymentVerifiedAt: new Date(),
          paymentVerificationNotes: verificationNotes,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          branch: true,
          invoice: {
            include: {
              items: true,
            },
          },
        },
      });

      // Update invoice
      if (request.invoice) {
        await tx.stockRequestInvoice.update({
          where: { id: request.invoice.id },
          data: {
            status: 'PAID',
            paymentVerificationStatus: 'VERIFIED',
            verifiedBy: userId,
            verifiedAt: new Date(),
            verificationNotes,
            paidAt: new Date(),
          },
        });
      }

      // Create shipment
      const shipment = await tx.shipment.create({
        data: {
          shipmentCode,
          fromBranchId: senderBranch.id,
          toBranchId: request.branchId,
          stockRequestId: requestId,
          status: 'PREPARING',
          notes: isFreeRequest
            ? `Pengiriman untuk permintaan ${request.requestCode} (Gratis - tanpa bukti pembayaran)`
            : `Pengiriman untuk permintaan ${request.requestCode} (Pembayaran Dikonfirmasi)`,
          items: {
            create: request.items.map(item => ({
              masterProductId: item.masterProductId,
              // Use finalQty (after overstock deduction) instead of requestedQty
              sentQty: item.finalQty || item.requestedQty,
              requestedQty: item.requestedQty, // Keep original for reference
            })),
          },
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

      return { updatedRequest, shipment };
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { 
        action: 'CONFIRM_PAYMENT',
        verificationNotes,
        shipmentId: result.shipment.id,
        branchType: request.branch.type,
        paymentRequired: !isFreeRequest,
      },
    });

    return {
      request: this.formatStockRequest(result.updatedRequest),
      shipment: this.formatShipment(result.shipment),
      message: isFreeRequest
        ? 'Request gratis disetujui tanpa bukti pembayaran dan pengiriman telah dibuat.'
        : 'Pembayaran dikonfirmasi dan pengiriman telah dibuat. Stok akan ditambahkan setelah Admin Cabang menerima barang.',
    };
  }

  /**
   * Reject payment (by Admin Manager)
   */
  async rejectPayment(requestId: string, userId: string, rejectionReason: string) {
    if (!rejectionReason) {
      throw {
        status: 400,
        code: 'REJECTION_REASON_REQUIRED',
        message: 'Alasan penolakan harus diisi',
      };
    }

    const request = await this.getRequestWithValidation(requestId, ['PAYMENT_UPLOADED']);
    const user = await this.validateManagerPermission(userId, request.branchId);

    // Delete payment proof from MinIO before clearing the reference
    if (request.paymentProofUrl) {
      console.log(`[StockRequest] Deleting rejected payment proof: ${request.paymentProofUrl}`);
      await deleteFileByUrl(request.paymentProofUrl);
    }

    // Update request back to WAITING_PAYMENT
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'WAITING_PAYMENT',
          paymentRejectionReason: rejectionReason,
          // Clear payment proof so they can upload again
          paymentProofUrl: null,
          paymentProofFileName: null,
          paymentProofFileSize: null,
          paymentProofMimeType: null,
          paymentUploadedAt: null,
          paymentUploadedBy: null,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
          branch: true,
          invoice: {
            include: {
              items: true,
            },
          },
        },
      });

      // Update invoice
      if (request.invoice) {
        await tx.stockRequestInvoice.update({
          where: { id: request.invoice.id },
          data: {
            paymentVerificationStatus: 'REJECTED',
            rejectionReason,
            paymentProofUrl: null,
            paymentProofFileName: null,
            paymentProofFileSize: null,
            paymentProofMimeType: null,
            paymentUploadedAt: null,
            paymentUploadedBy: null,
          },
        });
      }

      return updatedRequest;
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { 
        action: 'REJECT_PAYMENT',
        rejectionReason,
      },
    });

    return this.formatStockRequest(result);
  }

  /**
   * Reject stock request
   */
  async rejectRequest(requestId: string, userId: string, reviewNotes: string) {
    if (!reviewNotes) {
      throw {
        status: 400,
        code: 'REVIEW_NOTES_REQUIRED',
        message: 'Alasan penolakan harus diisi',
      };
    }

    const request = await this.getRequestWithValidation(requestId, ['PENDING', 'WAITING_PAYMENT', 'PAYMENT_UPLOADED']);
    const user = await this.validateManagerPermission(userId, request.branchId);

    // Update request status
    const updatedRequest = await prisma.stockRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
      include: {
        items: {
          include: {
            masterProduct: true,
          },
        },
        branch: true,
        invoice: {
          include: {
            items: true,
          },
        },
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: { 
        action: 'REJECT',
        reason: reviewNotes,
      },
    });

    return this.formatStockRequest(updatedRequest);
  }

  /**
   * Generate shipment code
   */
  private async generateShipmentCode(fromBranchId: string, toBranchId: string): Promise<string> {
    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findUnique({ where: { id: fromBranchId }, select: { branchCode: true } }),
      prisma.branch.findUnique({ where: { id: toBranchId }, select: { branchCode: true } }),
    ]);

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const prefix = `SHP-${fromBranch?.branchCode || 'EXT'}-${toBranch?.branchCode}-${year}${month}${day}`;
    
    const lastShipment = await prisma.shipment.findFirst({
      where: {
        shipmentCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        shipmentCode: 'desc',
      },
    });

    let sequence = 1;
    if (lastShipment) {
      const lastSeq = parseInt(lastShipment.shipmentCode.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(branchId: string): Promise<string> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { branchCode: true },
    });

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const prefix = `INV-STK-${branch?.branchCode}-${year}${month}${day}`;
    
    const lastInvoice = await prisma.stockRequestInvoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
      sequence = lastSeq + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Format stock request
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
      // Payment info
      paymentProofUrl: request.paymentProofUrl,
      paymentProofFileName: request.paymentProofFileName,
      paymentUploadedAt: request.paymentUploadedAt?.toISOString(),
      paymentVerifiedAt: request.paymentVerifiedAt?.toISOString(),
      paymentRejectionReason: request.paymentRejectionReason,
      // Invoice info
      invoice: request.invoice ? this.formatInvoice(request.invoice) : null,
      // Timestamps
      reviewedAt: request.reviewedAt?.toISOString(),
      reviewNotes: request.reviewNotes,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  /**
   * Format invoice
   */
  private formatInvoice(invoice: any) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subtotal: Number(invoice.subtotal),
      totalAmount: Number(invoice.totalAmount),
      status: invoice.status,
      paymentVerificationStatus: invoice.paymentVerificationStatus,
      paymentProofUrl: invoice.paymentProofUrl,
      paymentProofFileName: invoice.paymentProofFileName,
      verifiedAt: invoice.verifiedAt?.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      rejectionReason: invoice.rejectionReason,
      items: invoice.items?.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.productName,
        quantity: Number(item.quantity),
        pricePerUnit: Number(item.pricePerUnit),
        subtotal: Number(item.subtotal),
      })),
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  /**
   * Format shipment
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
      items: shipment.items.map((item: any) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        sentQty: Number(item.sentQty),
        receivedQty: item.receivedQty ? Number(item.receivedQty) : null,
        unit: item.masterProduct.baseUnit,
      })),
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedAt: shipment.receivedAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
