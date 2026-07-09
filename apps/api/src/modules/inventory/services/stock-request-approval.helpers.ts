import { InvoiceStatus, PaymentVerificationStatus, StockRequestStatus } from '@prisma/client';

export type StockRequestPaymentMode = 'NORMAL' | 'DEBT';
export type StockRequestInvoicePaymentMode = 'FREE' | 'DEBT' | 'NORMAL';

export interface InvoiceItemInput {
  masterProductId: string;
  quantity: number;
  pricePerUnit: number;
}

interface StockRequestItemForInvoice {
  masterProductId: string;
  masterProduct: {
    sku?: string | null;
    name?: string | null;
    description?: string | null;
  };
}

export interface StockRequestInvoiceItemSnapshot {
  masterProductId: string;
  sku: string | null;
  productName: string;
  description: string | null;
  quantity: number;
  pricePerUnit: number;
  subtotal: number;
}

export interface StockRequestInvoiceDraft {
  items: StockRequestInvoiceItemSnapshot[];
  subtotal: number;
}

export interface StockRequestInvoiceApprovalPlan {
  paymentMode: StockRequestInvoicePaymentMode;
  isFreeRequest: boolean;
  isDebtRequest: boolean;
  requestStatus: StockRequestStatus;
  invoiceStatus: InvoiceStatus;
  paymentVerificationStatus: PaymentVerificationStatus;
  paidAmount: number;
  remainingAmount: number;
  verifiedByUser: boolean;
  paidAtNow: boolean;
  verificationNotes: string | null;
  paymentRequired: boolean;
  responseMessage: string;
}

export function buildStockRequestInvoiceDraft(
  requestItems: StockRequestItemForInvoice[],
  invoiceItems: InvoiceItemInput[],
  totalAmountOverride?: number
): StockRequestInvoiceDraft {
  const requestProductIds = requestItems.map((item) => item.masterProductId);
  const invalidInvoiceItem = invoiceItems.find((item) => !requestProductIds.includes(item.masterProductId));

  if (invalidInvoiceItem) {
    throw {
      status: 400,
      code: 'INVALID_INVOICE_ITEM',
      message: 'Item invoice tidak sesuai dengan item permintaan',
    };
  }

  let subtotal = 0;
  const items = invoiceItems.map((item) => {
    const requestItem = requestItems.find(
      (stockRequestItem) => stockRequestItem.masterProductId === item.masterProductId
    );
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

  return { items, subtotal: totalAmountOverride ?? subtotal };
}

export function getStockRequestInvoiceApprovalPlan(
  subtotal: number,
  paymentMode?: StockRequestPaymentMode
): StockRequestInvoiceApprovalPlan {
  const isFreeRequest = subtotal <= 0;
  const isDebtRequest = !isFreeRequest && paymentMode === 'DEBT';

  if (isFreeRequest) {
    return {
      paymentMode: 'FREE',
      isFreeRequest: true,
      isDebtRequest: false,
      requestStatus: StockRequestStatus.APPROVED,
      invoiceStatus: InvoiceStatus.PAID,
      paymentVerificationStatus: PaymentVerificationStatus.VERIFIED,
      paidAmount: subtotal,
      remainingAmount: 0,
      verifiedByUser: true,
      paidAtNow: true,
      verificationNotes: 'Invoice gratis - tidak memerlukan bukti pembayaran',
      paymentRequired: false,
      responseMessage: 'Request gratis disetujui dan pengiriman telah dibuat tanpa bukti pembayaran.',
    };
  }

  if (isDebtRequest) {
    return {
      paymentMode: 'DEBT',
      isFreeRequest: false,
      isDebtRequest: true,
      requestStatus: StockRequestStatus.APPROVED,
      invoiceStatus: InvoiceStatus.DEBT,
      paymentVerificationStatus: PaymentVerificationStatus.PENDING,
      paidAmount: 0,
      remainingAmount: subtotal,
      verifiedByUser: false,
      paidAtNow: false,
      verificationNotes: 'Pembayaran ditandai sebagai utang - bukti pembayaran wajib diupload kemudian',
      paymentRequired: false,
      responseMessage: 'Request disetujui sebagai utang. Pengiriman telah dibuat dan bukti pembayaran wajib diupload kemudian.',
    };
  }

  return {
    paymentMode: 'NORMAL',
    isFreeRequest: false,
    isDebtRequest: false,
    requestStatus: StockRequestStatus.WAITING_PAYMENT,
    invoiceStatus: InvoiceStatus.PENDING_PAYMENT,
    paymentVerificationStatus: PaymentVerificationStatus.PENDING,
    paidAmount: 0,
    remainingAmount: subtotal,
    verifiedByUser: false,
    paidAtNow: false,
    verificationNotes: null,
    paymentRequired: true,
    responseMessage: 'Invoice berhasil dibuat. Menunggu upload bukti pembayaran.',
  };
}
