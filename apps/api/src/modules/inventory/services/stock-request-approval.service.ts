import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import {
  AuditAction,
  Role,
  BranchType,
  type MasterProduct,
  Prisma,
  type StockRequestItem,
  StockRequestStatus,
  StockMutationType,
} from '@prisma/client';
import { deleteFileByUrl } from '../../../config/minio';
import {
  buildStockRequestInvoiceDraft,
  getStockRequestInvoiceApprovalPlan,
} from './stock-request-approval.helpers';
import {
  formatStockRequestQuantity,
  getStockRequestUnit,
  parseStockRequestQuantity,
} from './stock-request-units';
import { decideApprovalInTransaction, submitApprovalInTransaction } from '../../approvals/approval.service';
import {
  buildPartnershipPaymentVerifiedEventData,
} from '../../zoho/zoho.partnership.service';
import { assertBranchAccess } from '../../iam/authorization.service';

interface InvoiceItemInput {
  masterProductId: string;
  quantity: number;
  unit?: string;
  pricePerUnit: number;
}

interface CreateInvoiceInput {
  items: InvoiceItemInput[];
  totalAmount?: number;
  notes?: string;
  paymentMode?: 'NORMAL' | 'DEBT';
  paymentAccountLabel?: string;
  paymentBankName?: string;
  paymentAccountNumber?: string;
  paymentAccountHolder?: string;
}

type ApprovalInvoiceBase = Prisma.StockRequestInvoiceGetPayload<{
  include: {
    items: { include: { masterProduct: true } };
  };
}>;
type ApprovalInvoice = ApprovalInvoiceBase & {
  payments?: Prisma.StockRequestInvoicePaymentGetPayload<object>[];
};

type ApprovalStockRequest = Prisma.StockRequestGetPayload<{
  include: {
    items: { include: { masterProduct: true } };
    branch: true;
  };
}> & { invoice?: ApprovalInvoice | null };

type ApprovalShipment = Prisma.ShipmentGetPayload<{
  include: {
    fromBranch: true;
    toBranch: true;
    items: { include: { masterProduct: true } };
  };
}>;

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

    const managerRoles: Role[] = [
      Role.SUPER_ADMIN,
      Role.ADMIN_MANAGER,
      Role.ADMIN_LOGISTIK,
      Role.FINANCE_LOGISTICS_CONTROLLER,
    ];
    if (!user || !managerRoles.includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Role Anda tidak dapat memproses permintaan stok',
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
    if (user.role === Role.FINANCE_LOGISTICS_CONTROLLER) {
      await assertBranchAccess(userId, branchId);
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
            items: {
              include: {
                masterProduct: true,
              },
            },
            payments: {
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
        shipment: true,
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
    tx: Prisma.TransactionClient,
    branchId: string,
    items: Array<
      Pick<StockRequestItem, 'masterProductId' | 'requestedQty'> & {
        masterProduct: MasterProduct;
      }
    >,
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
    const request = await this.getRequestWithValidation(requestId, [
      StockRequestStatus.PENDING,
      StockRequestStatus.APPROVED,
      StockRequestStatus.PARTIALLY_APPROVED,
    ]);
    await this.validateManagerPermission(userId, request.branchId);

    if (request.invoice) {
      throw {
        status: 409,
        code: 'INVOICE_ALREADY_EXISTS',
        message: 'Invoice untuk permintaan stok ini sudah dibuat.',
      };
    }
    if (request.shipment && request.shipment.status !== 'PREPARING') {
      throw {
        status: 422,
        code: 'SHIPMENT_ALREADY_PROCESSED',
        message: 'Invoice tidak dapat dibuat karena shipment sudah diproses.',
      };
    }

    // Both PREMIER and PARTNERSHIP branches now use the same invoice flow
    if (request.branch.type !== BranchType.PREMIER && request.branch.type !== BranchType.PARTNERSHIP) {
      throw {
        status: 422,
        code: 'INVALID_BRANCH_TYPE',
        message: 'Endpoint ini hanya untuk cabang Premier (Cabang) atau Partnership.',
      };
    }

    const totalAmount = invoiceData.totalAmount;

    if (totalAmount !== undefined && (!Number.isFinite(Number(totalAmount)) || Number(totalAmount) < 0)) {
      throw {
        status: 400,
        code: 'INVALID_TOTAL_AMOUNT',
        message: 'Total harga invoice tidak boleh negatif',
      };
    }

    const normalizedInvoiceItems = invoiceData.items.map((item) => {
      const requestItem = request.items.find((requestItem) => requestItem.masterProductId === item.masterProductId);
      return {
        ...item,
        quantity: parseStockRequestQuantity(requestItem?.masterProduct, item.quantity, item.unit),
      };
    });

    const { items: invoiceItems, subtotal } = buildStockRequestInvoiceDraft(
      request.items,
      normalizedInvoiceItems,
      totalAmount !== undefined ? Number(totalAmount) : undefined
    );
    const approvalPlan = getStockRequestInvoiceApprovalPlan(subtotal, invoiceData.paymentMode);
    const { isFreeRequest, isDebtRequest } = approvalPlan;
    const approval = await prisma.$transaction(async (tx) => {
      const submitted = await submitApprovalInTransaction(tx, {
        subjectType: 'STOCK_REQUEST',
        subjectId: request.id,
        branchId: request.branchId,
        makerId: request.requestedBy,
        amount: subtotal,
        transactionType: 'STOCK_REQUEST',
        metadata: { requestCode: request.requestCode, branchType: request.branch.type },
      });
      if (submitted.status === 'APPROVED') return submitted;
      return decideApprovalInTransaction(tx, {
        subjectType: 'STOCK_REQUEST',
        subjectId: request.id,
        actorUserId: userId,
        decision: 'APPROVE',
        note: invoiceData.notes?.trim() || 'Permintaan stok disetujui',
      });
    });
    if (approval.status !== 'APPROVED') {
      throw {
        status: 409,
        code: 'STOCK_REQUEST_APPROVAL_PENDING',
        message: 'Langkah approval tersimpan dan masih menunggu approver berikutnya.',
      };
    }
    const senderBranch = (isFreeRequest || isDebtRequest) ? await this.getOrCreateExternalBranch() : null;
    const shipmentCode = (isFreeRequest || isDebtRequest)
      ? await this.generateShipmentCode(senderBranch.id, request.branchId)
      : null;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(request.branchId);
    const now = new Date();

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
          paidAmount: approvalPlan.paidAmount,
          remainingAmount: approvalPlan.remainingAmount,
          status: approvalPlan.invoiceStatus,
          paymentVerificationStatus: approvalPlan.paymentVerificationStatus,
          verifiedBy: approvalPlan.verifiedByUser ? userId : null,
          verifiedAt: approvalPlan.verifiedByUser ? now : null,
          verificationNotes: approvalPlan.verificationNotes,
          paidAt: approvalPlan.paidAtNow ? now : null,
          notes: invoiceData.notes,
          paymentAccountLabel: invoiceData.paymentAccountLabel?.trim() || null,
          paymentBankName: invoiceData.paymentBankName?.trim() || null,
          paymentAccountNumber: invoiceData.paymentAccountNumber?.trim() || null,
          paymentAccountHolder: invoiceData.paymentAccountHolder?.trim() || null,
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
          status: approvalPlan.requestStatus,
          reviewedBy: userId,
          reviewedAt: now,
          paymentVerifiedBy: approvalPlan.verifiedByUser ? userId : null,
          paymentVerifiedAt: approvalPlan.verifiedByUser ? now : null,
          paymentVerificationNotes: approvalPlan.verificationNotes,
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
              items: {
                include: {
                  masterProduct: true,
                },
              },
            },
          },
        },
      });

      const shipment = request.shipment
        ? await tx.shipment.findUnique({
            where: { id: request.shipment.id },
            include: {
              items: { include: { masterProduct: true } },
              fromBranch: true,
              toBranch: true,
            },
          })
        : (isFreeRequest || isDebtRequest)
          ? await tx.shipment.create({
            data: {
              shipmentCode,
              fromBranchId: senderBranch.id,
              toBranchId: request.branchId,
              stockRequestId: requestId,
              status: 'PREPARING',
              notes: isFreeRequest
                ? `Pengiriman untuk permintaan ${request.requestCode} (Gratis - tanpa bukti pembayaran)`
                : `Pengiriman untuk permintaan ${request.requestCode} (Utang - bukti pembayaran menyusul)`,
              items: {
                create: request.items.map(item => ({
                  masterProductId: item.masterProductId,
                  sentQty: item.finalQty ?? item.requestedQty,
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
        paymentRequired: approvalPlan.paymentRequired,
        paymentMode: approvalPlan.paymentMode,
        shipmentId: result.shipment?.id,
      },
    });

    return {
      request: this.formatStockRequest(result.updatedRequest),
      invoice: this.formatInvoice(result.invoice),
      message: approvalPlan.responseMessage,
      ...(result.shipment
        ? { shipment: this.formatShipment(result.shipment) }
        : {}),
    };
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
   * Allow a paid invoice to continue as debt.
   * The request moves to APPROVED and shipment is created immediately,
   * while the invoice remains unpaid until proof is uploaded later.
   */
  async markPaymentAsDebt(requestId: string, userId: string, notes?: string) {
    const request = await this.getRequestWithValidation(requestId, ['WAITING_PAYMENT']);
    await this.validateManagerPermission(userId, request.branchId);

    if (!request.invoice) {
      throw {
        status: 422,
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice belum dibuat untuk request ini',
      };
    }

    if (Number(request.invoice.totalAmount || 0) <= 0) {
      throw {
        status: 422,
        code: 'FREE_INVOICE_CANNOT_BE_DEBT',
        message: 'Invoice gratis tidak perlu ditandai sebagai utang',
      };
    }

    if (request.invoice.status !== 'PENDING_PAYMENT') {
      throw {
        status: 422,
        code: 'INVALID_INVOICE_STATUS',
        message: `Invoice tidak dapat dijadikan utang. Status saat ini: ${request.invoice.status}`,
      };
    }

    if (request.shipment) {
      throw {
        status: 422,
        code: 'SHIPMENT_ALREADY_EXISTS',
        message: 'Pengiriman untuk request ini sudah dibuat',
      };
    }

    const senderBranch = await this.getOrCreateExternalBranch();
    const shipmentCode = await this.generateShipmentCode(senderBranch.id, request.branchId);
    const debtNote = notes?.trim();
    const paymentNote = debtNote
      ? `Pembayaran ditandai sebagai utang - ${debtNote}`
      : 'Pembayaran ditandai sebagai utang - bukti pembayaran wajib diupload kemudian';

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          paymentVerificationNotes: paymentNote,
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
              items: {
                include: {
                  masterProduct: true,
                },
              },
            },
          },
        },
      });

      const invoice = await tx.stockRequestInvoice.update({
        where: { id: request.invoice.id },
        data: {
          status: 'DEBT',
          paymentVerificationStatus: 'PENDING',
          verificationNotes: paymentNote,
        },
        include: {
          items: {
            include: {
              masterProduct: true,
            },
          },
        },
      });

      const shipment = await tx.shipment.create({
        data: {
          shipmentCode,
          fromBranchId: senderBranch.id,
          toBranchId: request.branchId,
          stockRequestId: requestId,
          status: 'PREPARING',
          notes: `Pengiriman untuk permintaan ${request.requestCode} (Utang - bukti pembayaran menyusul)`,
          items: {
            create: request.items.map(item => ({
              masterProductId: item.masterProductId,
              sentQty: item.finalQty ?? item.requestedQty,
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
      });

      return { updatedRequest, invoice, shipment };
    });

    await logAudit({
      userId,
      branchId: request.branchId,
      action: AuditAction.UPDATE,
      resource: 'StockRequest',
      resourceId: requestId,
      meta: {
        action: 'MARK_PAYMENT_AS_DEBT',
        invoiceId: request.invoice.id,
        invoiceNumber: request.invoice.invoiceNumber,
        shipmentId: result.shipment.id,
        notes: debtNote,
      },
    });

    return {
      request: this.formatStockRequest(result.updatedRequest),
      invoice: this.formatInvoice(result.invoice),
      shipment: this.formatShipment(result.shipment),
      message: 'Request disetujui sebagai utang. Pengiriman telah dibuat dan bukti pembayaran wajib diupload kemudian.',
    };
  }

  /**
   * Upload payment proof (by Admin Manager / Super Admin)
   */
  async uploadPaymentProof(
    requestId: string, 
    userId: string, 
    fileData: {
      url: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    },
    paymentData?: {
      amount?: number;
      notes?: string;
    }
  ) {
    const request = await this.getRequestWithValidation(requestId, [
      'WAITING_PAYMENT',
      'APPROVED',
      'SHIPPED',
      'COMPLETED',
      'COMPLETED_WITH_ISSUE',
    ]);
    const isDebtRequest = request.invoice?.status === 'DEBT';

    if (request.status !== 'WAITING_PAYMENT' && !isDebtRequest) {
      throw {
        status: 422,
        code: 'INVALID_PAYMENT_UPLOAD_STATUS',
        message: 'Bukti pembayaran hanya dapat diupload untuk invoice menunggu pembayaran atau invoice utang',
      };
    }

    if (request.invoice && Number(request.invoice.totalAmount || 0) <= 0) {
      throw {
        status: 422,
        code: 'FREE_INVOICE_NO_PAYMENT_PROOF',
        message: 'Invoice gratis tidak memerlukan bukti pembayaran',
      };
    }

    if (!request.invoice) {
      throw {
        status: 422,
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice belum dibuat untuk request ini',
      };
    }

    const totalAmount = Number(request.invoice.totalAmount || 0);
    const paidAmount = Number(request.invoice.paidAmount || 0);
    const remainingAmount = Math.max(0, Number(request.invoice.remainingAmount ?? (totalAmount - paidAmount)));
    const paymentAmount = paymentData?.amount ?? (isDebtRequest ? undefined : totalAmount);

    if (!paymentAmount || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw {
        status: 400,
        code: 'PAYMENT_AMOUNT_REQUIRED',
        message: 'Jumlah pembayaran harus diisi dan lebih dari 0',
      };
    }

    if (paymentAmount > remainingAmount) {
      throw {
        status: 422,
        code: 'PAYMENT_AMOUNT_EXCEEDS_DEBT',
        message: `Jumlah pembayaran melebihi sisa utang. Sisa utang saat ini Rp ${remainingAmount.toLocaleString('id-ID')}`,
      };
    }

    // Verify user is Admin Manager or Super Admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, branchId: true },
    });

    const paymentRoles: Role[] = [
      Role.SUPER_ADMIN,
      Role.ADMIN_MANAGER,
      Role.ADMIN_LOGISTIK,
      Role.FINANCE_LOGISTICS_CONTROLLER,
    ];
    if (!user || !paymentRoles.includes(user.role)) {
      throw {
        status: 403,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Hanya Super Admin, Admin Manager, atau Admin Logistik yang dapat mengupload bukti pembayaran',
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
    if (user.role === Role.FINANCE_LOGISTICS_CONTROLLER) {
      await assertBranchAccess(userId, request.branchId);
    }

    // Update request and invoice with payment proof
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const nextPaidAmount = isDebtRequest ? paidAmount + paymentAmount : paidAmount;
      const nextRemainingAmount = isDebtRequest ? Math.max(0, totalAmount - nextPaidAmount) : remainingAmount;
      const isFullyPaid = isDebtRequest && nextRemainingAmount <= 0;
      const autoVerifyDebt = isDebtRequest
        && user.role !== Role.FINANCE_LOGISTICS_CONTROLLER;

      // Update request
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: isDebtRequest ? request.status : 'PAYMENT_UPLOADED',
          paymentProofUrl: fileData.url,
          paymentProofFileName: fileData.fileName,
          paymentProofFileSize: fileData.fileSize,
          paymentProofMimeType: fileData.mimeType,
          paymentUploadedAt: now,
          paymentUploadedBy: userId,
          paymentVerifiedBy: autoVerifyDebt && isFullyPaid ? userId : request.paymentVerifiedBy,
          paymentVerifiedAt: autoVerifyDebt && isFullyPaid ? now : request.paymentVerifiedAt,
          paymentVerificationNotes: isDebtRequest
            ? isFullyPaid
              ? 'Pembayaran utang sudah lunas'
              : `Pembayaran parsial diterima. Sisa utang Rp ${nextRemainingAmount.toLocaleString('id-ID')}`
            : request.paymentVerificationNotes,
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
              items: {
                include: {
                  masterProduct: true,
                },
              },
              payments: {
                orderBy: { uploadedAt: 'desc' },
              },
            },
          },
        },
      });

      await tx.stockRequestInvoicePayment.create({
        data: {
          invoiceId: request.invoice.id,
          amount: paymentAmount,
          proofFileUrl: fileData.url,
          proofFileName: fileData.fileName,
          proofFileSize: fileData.fileSize,
          proofMimeType: fileData.mimeType,
          notes: paymentData?.notes?.trim() || null,
          uploadedBy: userId,
          uploadedAt: now,
          verifiedBy: autoVerifyDebt ? userId : null,
          verifiedAt: autoVerifyDebt ? now : null,
          verificationNotes: autoVerifyDebt
            ? isFullyPaid
              ? 'Pembayaran utang sudah lunas'
              : `Pembayaran parsial diterima. Sisa utang Rp ${nextRemainingAmount.toLocaleString('id-ID')}`
            : null,
        },
      });

      await tx.stockRequestInvoice.update({
        where: { id: request.invoice.id },
        data: {
          paidAmount: nextPaidAmount,
          remainingAmount: nextRemainingAmount,
          status: autoVerifyDebt && isFullyPaid ? 'PAID' : isDebtRequest ? 'DEBT' : request.invoice.status,
          paymentProofUrl: fileData.url,
          paymentProofFileName: fileData.fileName,
          paymentProofFileSize: fileData.fileSize,
          paymentProofMimeType: fileData.mimeType,
          paymentUploadedAt: now,
          paymentUploadedBy: userId,
          paymentVerificationStatus: autoVerifyDebt
            ? isFullyPaid ? 'VERIFIED' : 'PENDING'
            : 'PENDING',
          verifiedBy: autoVerifyDebt && isFullyPaid ? userId : request.invoice.verifiedBy,
          verifiedAt: autoVerifyDebt && isFullyPaid ? now : request.invoice.verifiedAt,
          verificationNotes: autoVerifyDebt
            ? isFullyPaid
              ? 'Pembayaran utang sudah lunas'
              : `Pembayaran parsial diterima. Sisa utang Rp ${nextRemainingAmount.toLocaleString('id-ID')}`
            : request.invoice.verificationNotes,
          paidAt: autoVerifyDebt && isFullyPaid ? now : request.invoice.paidAt,
          rejectionReason: null,
        },
      });

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
        amount: paymentAmount,
        remainingAmount: Math.max(0, remainingAmount - paymentAmount),
        paymentMode: isDebtRequest ? 'DEBT' : 'NORMAL',
      },
    });

    return this.formatStockRequest(result);
  }

  /**
   * Confirm payment (by Admin Manager)
   * Creates shipment after payment confirmation - stock is added when Admin Cabang receives the shipment
   */
  async confirmPayment(requestId: string, userId: string, verificationNotes?: string) {
    const request = await this.getRequestWithValidation(requestId, [
      'WAITING_PAYMENT',
      'PAYMENT_UPLOADED',
      'APPROVED',
      'SHIPPED',
      'COMPLETED',
      'COMPLETED_WITH_ISSUE',
    ]);
    const user = await this.validateManagerPermission(userId, request.branchId);
    const isFreeRequest = Number(request.invoice?.totalAmount || 0) <= 0;
    const isDebtRequest = request.invoice?.status === 'DEBT';
    if (
      user.role === Role.FINANCE_LOGISTICS_CONTROLLER
      && !isFreeRequest
      && request.paymentUploadedBy === userId
    ) {
      throw {
        status: 403,
        code: 'PAYMENT_MAKER_CHECKER_REQUIRED',
        message: 'Pengunggah bukti pembayaran tidak boleh memverifikasi pembayaran yang sama',
      };
    }

    if (!isDebtRequest && !['WAITING_PAYMENT', 'PAYMENT_UPLOADED'].includes(request.status)) {
      throw {
        status: 422,
        code: 'INVALID_PAYMENT_CONFIRM_STATUS',
        message: 'Pembayaran hanya dapat dikonfirmasi untuk invoice menunggu pembayaran atau invoice utang',
      };
    }

    if (!isFreeRequest && !isDebtRequest && request.status === 'WAITING_PAYMENT') {
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

    if (isDebtRequest) {
      const remainingAmount = Number(request.invoice?.remainingAmount ?? request.invoice?.totalAmount ?? 0);
      if (remainingAmount > 0) {
        throw {
          status: 422,
          code: 'DEBT_PAYMENT_NOT_FULLY_PAID',
          message: `Pembayaran utang belum lunas. Sisa utang Rp ${remainingAmount.toLocaleString('id-ID')}`,
        };
      }

      const verifiedAt = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.stockRequest.update({
          where: { id: requestId },
          data: {
            paymentVerifiedBy: userId,
            paymentVerifiedAt: verifiedAt,
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
                items: {
                  include: {
                    masterProduct: true,
                  },
                },
              },
            },
          },
        });

        const invoice = request.invoice
          ? await tx.stockRequestInvoice.update({
              where: { id: request.invoice.id },
              data: {
                status: 'PAID',
                paidAmount: request.invoice.totalAmount,
                remainingAmount: 0,
                paymentVerificationStatus: 'VERIFIED',
                verifiedBy: userId,
                verifiedAt,
                verificationNotes,
                paidAt: verifiedAt,
              },
              include: {
                items: {
                  include: {
                    masterProduct: true,
                  },
                },
              },
            })
          : null;

        if (invoice) {
          await tx.stockRequestInvoicePayment.updateMany({
            where: { invoiceId: invoice.id, verifiedAt: null },
            data: {
              verifiedBy: userId,
              verifiedAt,
              verificationNotes,
              rejectionReason: null,
            },
          });
        }

        if (
          invoice
          && request.branch.type === BranchType.PARTNERSHIP
          && invoice.totalAmount.greaterThan(0)
        ) {
          const eventData = buildPartnershipPaymentVerifiedEventData({
            invoiceId: invoice.id,
            branchId: request.branchId,
            stockRequestId: request.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.totalAmount,
            verifiedAt,
            paymentAccountNumber: invoice.paymentAccountNumber,
          });
          await tx.integrationEvent.upsert({
            where: {
              eventType_aggregateId: {
                eventType: eventData.eventType,
                aggregateId: eventData.aggregateId,
              },
            },
            create: eventData,
            update: {
              payload: eventData.payload,
              branchId: eventData.branchId,
              occurredAt: verifiedAt,
              status: 'PENDING',
              attempts: 0,
              availableAt: new Date(),
              processedAt: null,
              deadLetteredAt: null,
              lockedBy: null,
              leaseUntil: null,
              lastError: null,
            },
          });
        }
        return { updatedRequest, invoice };
      });

      await logAudit({
        userId,
        action: AuditAction.UPDATE,
        resource: 'StockRequest',
        resourceId: requestId,
        meta: {
          action: 'CONFIRM_DEBT_PAYMENT',
          verificationNotes,
          branchType: request.branch.type,
        },
      });

      return {
        request: this.formatStockRequest(result.updatedRequest),
        invoice: result.invoice ? this.formatInvoice(result.invoice) : null,
        message: 'Pembayaran utang dikonfirmasi. Invoice sudah lunas.',
      };
    }

    const senderBranch = await this.getOrCreateExternalBranch();
    const shipmentCode = await this.generateShipmentCode(senderBranch.id, request.branchId);

    // Update request, invoice, and create shipment
    const verifiedAt = new Date();
    const result = await prisma.$transaction(async (tx) => {
      // Update request to APPROVED (shipment will be created)
      const updatedRequest = await tx.stockRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          paymentVerifiedBy: userId,
          paymentVerifiedAt: verifiedAt,
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
              items: {
                include: {
                  masterProduct: true,
                },
              },
            },
          },
        },
      });

      // Update invoice
      if (request.invoice) {
        const paidInvoice = await tx.stockRequestInvoice.update({
          where: { id: request.invoice.id },
          data: {
            status: 'PAID',
            paidAmount: request.invoice.totalAmount,
            remainingAmount: 0,
            paymentVerificationStatus: 'VERIFIED',
            verifiedBy: userId,
            verifiedAt,
            verificationNotes,
            paidAt: verifiedAt,
          },
        });
        if (
          request.branch.type === BranchType.PARTNERSHIP
          && paidInvoice.totalAmount.greaterThan(0)
        ) {
          const eventData = buildPartnershipPaymentVerifiedEventData({
            invoiceId: paidInvoice.id,
            branchId: request.branchId,
            stockRequestId: request.id,
            invoiceNumber: paidInvoice.invoiceNumber,
            amount: paidInvoice.totalAmount,
            verifiedAt,
            paymentAccountNumber: paidInvoice.paymentAccountNumber,
          });
          await tx.integrationEvent.upsert({
            where: {
              eventType_aggregateId: {
                eventType: eventData.eventType,
                aggregateId: eventData.aggregateId,
              },
            },
            create: eventData,
            update: {
              payload: eventData.payload,
              branchId: eventData.branchId,
              occurredAt: verifiedAt,
              status: 'PENDING',
              attempts: 0,
              availableAt: new Date(),
              processedAt: null,
              deadLetteredAt: null,
              lockedBy: null,
              leaseUntil: null,
              lastError: null,
            },
          });
        }
        await tx.stockRequestInvoicePayment.updateMany({
          where: { invoiceId: paidInvoice.id, verifiedAt: null },
          data: {
            verifiedBy: userId,
            verifiedAt,
            verificationNotes,
            rejectionReason: null,
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
              sentQty: item.finalQty ?? item.requestedQty,
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

    const request = await this.getRequestWithValidation(requestId, [
      'PAYMENT_UPLOADED',
      'APPROVED',
      'SHIPPED',
      'COMPLETED',
      'COMPLETED_WITH_ISSUE',
    ]);
    await this.validateManagerPermission(userId, request.branchId);
    const isDebtRequest = request.invoice?.status === 'DEBT';

    if (request.status !== 'PAYMENT_UPLOADED' && !isDebtRequest) {
      throw {
        status: 422,
        code: 'INVALID_PAYMENT_REJECT_STATUS',
        message: 'Pembayaran hanya dapat ditolak untuk bukti pembayaran yang sudah diupload',
      };
    }

    if (isDebtRequest && !request.paymentProofUrl) {
      throw {
        status: 422,
        code: 'NO_PAYMENT_PROOF',
        message: 'Belum ada bukti pembayaran utang yang dapat ditolak',
      };
    }

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
          status: isDebtRequest ? request.status : 'WAITING_PAYMENT',
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
              items: {
                include: {
                  masterProduct: true,
                },
              },
            },
          },
        },
      });

      // Update invoice
      if (request.invoice) {
        await tx.stockRequestInvoice.update({
          where: { id: request.invoice.id },
          data: {
            status: isDebtRequest ? 'DEBT' : request.invoice.status,
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
        paymentMode: isDebtRequest ? 'DEBT' : 'NORMAL',
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
    await this.validateManagerPermission(userId, request.branchId);

    const updatedRequest = await prisma.$transaction(async (tx) => {
      await submitApprovalInTransaction(tx, {
        subjectType: 'STOCK_REQUEST', subjectId: request.id, branchId: request.branchId,
        makerId: request.requestedBy, amount: request.invoice?.totalAmount || 0,
        transactionType: 'STOCK_REQUEST', metadata: { requestCode: request.requestCode },
      });
      await decideApprovalInTransaction(tx, {
        subjectType: 'STOCK_REQUEST', subjectId: request.id, actorUserId: userId,
        decision: 'REJECT', note: reviewNotes,
      });
      return tx.stockRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', reviewedBy: userId, reviewedAt: new Date(), reviewNotes },
        include: {
          items: { include: { masterProduct: true } },
          branch: true,
          invoice: { include: { items: { include: { masterProduct: true } } } },
        },
      });
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
  private formatStockRequest(request: ApprovalStockRequest) {
    return {
      id: request.id,
      requestCode: request.requestCode,
      branchId: request.branchId,
      branchName: request.branch.name,
      branchType: request.branch.type,
      status: request.status,
      notes: request.notes,
      itemCount: request.items.length,
      items: request.items.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        productCategory: item.masterProduct.category,
        requestedQty: formatStockRequestQuantity(item.masterProduct, item.requestedQty),
        approvedQty: item.approvedQty === null || item.approvedQty === undefined
          ? null
          : formatStockRequestQuantity(item.masterProduct, item.approvedQty),
        overstockDeducted: item.overstockDeducted === null || item.overstockDeducted === undefined
          ? 0
          : formatStockRequestQuantity(item.masterProduct, item.overstockDeducted),
        finalQty: item.finalQty === null || item.finalQty === undefined
          ? formatStockRequestQuantity(item.masterProduct, item.requestedQty)
          : formatStockRequestQuantity(item.masterProduct, item.finalQty),
        unit: getStockRequestUnit(item.masterProduct),
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
  private formatInvoice(invoice: ApprovalInvoice) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subtotal: Number(invoice.subtotal),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount || 0),
      remainingAmount: Number(invoice.remainingAmount ?? invoice.totalAmount ?? 0),
      status: invoice.status,
      paymentVerificationStatus: invoice.paymentVerificationStatus,
      paymentProofUrl: invoice.paymentProofUrl,
      paymentProofFileName: invoice.paymentProofFileName,
      paymentAccountLabel: invoice.paymentAccountLabel,
      paymentBankName: invoice.paymentBankName,
      paymentAccountNumber: invoice.paymentAccountNumber,
      paymentAccountHolder: invoice.paymentAccountHolder,
      verifiedAt: invoice.verifiedAt?.toISOString(),
      paidAt: invoice.paidAt?.toISOString(),
      rejectionReason: invoice.rejectionReason,
      notes: invoice.notes,
      items: invoice.items?.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.productName,
        quantity: formatStockRequestQuantity(item.masterProduct, item.quantity),
        unit: getStockRequestUnit(item.masterProduct),
        pricePerUnit: Number(item.pricePerUnit),
        subtotal: Number(item.subtotal),
      })),
      payments: invoice.payments?.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount),
        proofFileUrl: payment.proofFileUrl,
        proofFileName: payment.proofFileName,
        proofFileSize: payment.proofFileSize,
        proofMimeType: payment.proofMimeType,
        notes: payment.notes,
        uploadedBy: payment.uploadedBy,
        uploadedAt: payment.uploadedAt?.toISOString(),
        verifiedBy: payment.verifiedBy,
        verifiedAt: payment.verifiedAt?.toISOString(),
        verificationNotes: payment.verificationNotes,
        rejectionReason: payment.rejectionReason,
      })),
      createdAt: invoice.createdAt.toISOString(),
    };
  }

  /**
   * Format shipment
   */
  private formatShipment(shipment: ApprovalShipment) {
    return {
      id: shipment.id,
      shipmentCode: shipment.shipmentCode,
      fromBranchId: shipment.fromBranchId,
      fromBranchName: shipment.fromBranch.name,
      toBranchId: shipment.toBranchId,
      toBranchName: shipment.toBranch.name,
      status: shipment.status,
      notes: shipment.notes,
      items: shipment.items.map((item) => ({
        id: item.id,
        masterProductId: item.masterProductId,
        productName: item.masterProduct.name,
        sentQty: formatStockRequestQuantity(item.masterProduct, item.sentQty),
        receivedQty: item.receivedQty === null || item.receivedQty === undefined
          ? null
          : formatStockRequestQuantity(item.masterProduct, item.receivedQty),
        unit: getStockRequestUnit(item.masterProduct),
      })),
      shippedAt: shipment.shippedAt?.toISOString(),
      receivedAt: shipment.receivedAt?.toISOString(),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    };
  }
}
