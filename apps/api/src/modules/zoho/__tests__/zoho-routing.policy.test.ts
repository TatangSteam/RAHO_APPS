import { BranchType, Prisma } from '@prisma/client';
import {
  buildPartnershipGoodsShippedPayload,
  isPartnershipBranch,
  shouldSyncTreatmentRevenueToZoho,
} from '../zoho-routing.policy';

describe('Zoho branch routing policy', () => {
  it('does not sync treatment revenue per infusion for Partnership', () => {
    expect(isPartnershipBranch(BranchType.PARTNERSHIP)).toBe(true);
    expect(shouldSyncTreatmentRevenueToZoho(BranchType.PARTNERSHIP)).toBe(false);
    expect(shouldSyncTreatmentRevenueToZoho(BranchType.PUSAT)).toBe(true);
    expect(shouldSyncTreatmentRevenueToZoho(BranchType.PREMIER)).toBe(true);
  });

  it('builds Partnership revenue and FIFO cost snapshot', () => {
    const payload = buildPartnershipGoodsShippedPayload({
      partnershipBranchId: 'partner-1',
      stockRequestId: 'request-1',
      stockRequestInvoiceId: 'invoice-1',
      shipmentCode: 'SHP-001',
      invoiceNumber: 'INV-001',
      revenueAmount: new Prisma.Decimal('5000000'),
      invoiceItems: [{
        masterProductId: 'product-1',
        sku: 'VIT-C',
        quantity: new Prisma.Decimal('10'),
        pricePerUnit: new Prisma.Decimal('500000'),
      }],
      shipmentCosts: [{
        masterProductId: 'product-1',
        quantity: new Prisma.Decimal('10'),
        totalCost: new Prisma.Decimal('3000000'),
      }],
    });

    expect(payload).toMatchObject({
      revenueAmount: '5000000.00',
      costAmount: '3000000.0000',
      grossProfit: '2000000.0000',
      items: [{
        masterProductId: 'product-1',
        quantity: '10.0000',
        unitPrice: '500000.00',
        unitCost: '300000.0000',
      }],
    });
  });
});
