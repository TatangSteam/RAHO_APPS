import {
  canCreateStockRequestInvoice,
  getStockRequestRowActions,
} from './stockRequestPresentation';
import type { StockRequest } from './types';

function request(overrides: Partial<StockRequest> = {}): StockRequest {
  return {
    id: 'request-1',
    requestCode: 'REQ-001',
    branchId: 'branch-1',
    branchName: 'RAHO Cabang',
    branchType: 'PREMIER',
    status: 'APPROVED',
    itemCount: 1,
    items: [],
    createdAt: '2026-08-26T00:00:00.000Z',
    shipment: {
      id: 'shipment-1',
      shipmentCode: 'SHP-001',
      status: 'PREPARING',
    },
    ...overrides,
  };
}

describe('stock request invoice actions', () => {
  it('lets an admin manager create an invoice after a shipment is prepared', () => {
    const approvedRequest = request();
    expect(canCreateStockRequestInvoice(approvedRequest, 'ADMIN_MANAGER')).toBe(true);
    expect(getStockRequestRowActions(approvedRequest, 'ADMIN_MANAGER').canReview).toBe(true);
  });

  it('does not offer invoice creation after dispatch or when an invoice exists', () => {
    expect(canCreateStockRequestInvoice(request({ shipment: { id: 'shipment-1', shipmentCode: 'SHP-001', status: 'SHIPPED' } }), 'ADMIN_MANAGER')).toBe(false);
    expect(canCreateStockRequestInvoice(request({ invoice: { id: 'invoice-1', invoiceNumber: 'INV-001', status: 'PENDING_PAYMENT', paymentVerificationStatus: 'PENDING', subtotal: 1, totalAmount: 1, paidAmount: 0, remainingAmount: 1, items: [], createdAt: '2026-08-26T00:00:00.000Z' } }), 'ADMIN_MANAGER')).toBe(false);
  });
});
