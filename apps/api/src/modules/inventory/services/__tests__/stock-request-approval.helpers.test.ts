import { InvoiceStatus, PaymentVerificationStatus, StockRequestStatus } from '@prisma/client';
import {
  buildStockRequestInvoiceDraft,
  getStockRequestInvoiceApprovalPlan,
} from '../stock-request-approval.helpers';

const requestItems = [
  {
    masterProductId: 'product-1',
    masterProduct: {
      sku: 'SKU-001',
      name: 'Infus Vitamin',
      description: 'Vitamin drip',
    },
  },
  {
    masterProductId: 'product-2',
    masterProduct: {
      sku: null,
      name: 'Needle',
      description: null,
    },
  },
];

describe('stock request approval helpers', () => {
  describe('buildStockRequestInvoiceDraft', () => {
    it('builds invoice item snapshots and subtotal from request products', () => {
      const draft = buildStockRequestInvoiceDraft(requestItems, [
        { masterProductId: 'product-1', quantity: 2, pricePerUnit: 15000 },
        { masterProductId: 'product-2', quantity: 3, pricePerUnit: 5000 },
      ]);

      expect(draft.subtotal).toBe(45000);
      expect(draft.items).toEqual([
        {
          masterProductId: 'product-1',
          sku: 'SKU-001',
          productName: 'Infus Vitamin',
          description: 'Vitamin drip',
          quantity: 2,
          pricePerUnit: 15000,
          subtotal: 30000,
        },
        {
          masterProductId: 'product-2',
          sku: null,
          productName: 'Needle',
          description: null,
          quantity: 3,
          pricePerUnit: 5000,
          subtotal: 15000,
        },
      ]);
    });

    it('rejects invoice items outside the stock request', () => {
      expect(() =>
        buildStockRequestInvoiceDraft(requestItems, [
          { masterProductId: 'unknown-product', quantity: 1, pricePerUnit: 1000 },
        ])
      ).toThrow(
        expect.objectContaining({
          status: 400,
          code: 'INVALID_INVOICE_ITEM',
        })
      );
    });

    it('supports an aggregate total amount without distributing prices to items', () => {
      const draft = buildStockRequestInvoiceDraft(
        requestItems,
        [
          { masterProductId: 'product-1', quantity: 2, pricePerUnit: 0 },
          { masterProductId: 'product-2', quantity: 3, pricePerUnit: 0 },
        ],
        125000
      );

      expect(draft.subtotal).toBe(125000);
      expect(draft.items).toEqual([
        expect.objectContaining({
          masterProductId: 'product-1',
          pricePerUnit: 0,
          subtotal: 0,
        }),
        expect.objectContaining({
          masterProductId: 'product-2',
          pricePerUnit: 0,
          subtotal: 0,
        }),
      ]);
    });
  });

  describe('getStockRequestInvoiceApprovalPlan', () => {
    it('marks zero-total invoices as free and immediately approved', () => {
      expect(getStockRequestInvoiceApprovalPlan(0)).toEqual({
        paymentMode: 'FREE',
        isFreeRequest: true,
        isDebtRequest: false,
        requestStatus: StockRequestStatus.APPROVED,
        invoiceStatus: InvoiceStatus.PAID,
        paymentVerificationStatus: PaymentVerificationStatus.VERIFIED,
        paidAmount: 0,
        remainingAmount: 0,
        verifiedByUser: true,
        paidAtNow: true,
        verificationNotes: 'Invoice gratis - tidak memerlukan bukti pembayaran',
        paymentRequired: false,
        responseMessage: 'Request gratis disetujui dan pengiriman telah dibuat tanpa bukti pembayaran.',
      });
    });

    it('marks debt invoices as approved with pending payment verification', () => {
      expect(getStockRequestInvoiceApprovalPlan(125000, 'DEBT')).toEqual({
        paymentMode: 'DEBT',
        isFreeRequest: false,
        isDebtRequest: true,
        requestStatus: StockRequestStatus.APPROVED,
        invoiceStatus: InvoiceStatus.DEBT,
        paymentVerificationStatus: PaymentVerificationStatus.PENDING,
        paidAmount: 0,
        remainingAmount: 125000,
        verifiedByUser: false,
        paidAtNow: false,
        verificationNotes: 'Pembayaran ditandai sebagai utang - bukti pembayaran wajib diupload kemudian',
        paymentRequired: false,
        responseMessage: 'Request disetujui sebagai utang. Pengiriman telah dibuat dan bukti pembayaran wajib diupload kemudian.',
      });
    });

    it('marks paid invoices as waiting for payment proof by default', () => {
      expect(getStockRequestInvoiceApprovalPlan(125000, 'NORMAL')).toEqual({
        paymentMode: 'NORMAL',
        isFreeRequest: false,
        isDebtRequest: false,
        requestStatus: StockRequestStatus.WAITING_PAYMENT,
        invoiceStatus: InvoiceStatus.PENDING_PAYMENT,
        paymentVerificationStatus: PaymentVerificationStatus.PENDING,
        paidAmount: 0,
        remainingAmount: 125000,
        verifiedByUser: false,
        paidAtNow: false,
        verificationNotes: null,
        paymentRequired: true,
        responseMessage: 'Invoice berhasil dibuat. Menunggu upload bukti pembayaran.',
      });
    });
  });
});
