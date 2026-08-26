import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('stock request shipment invoice contract', () => {
  it('allows invoice creation for a prepared reserved shipment without creating a duplicate', () => {
    const service = readFileSync(resolve(__dirname, '../stock-request-approval.service.ts'), 'utf8');
    const createInvoice = service.slice(
      service.indexOf('async createInvoice('),
      service.indexOf('async createPartnershipInvoice('),
    );
    expect(createInvoice).toContain('StockRequestStatus.APPROVED');
    expect(createInvoice).toContain('StockRequestStatus.PARTIALLY_APPROVED');
    expect(createInvoice).toContain("request.shipment.status !== 'PREPARING'");
    expect(createInvoice).toContain('where: { id: request.shipment.id }');
    expect(createInvoice).toContain("code: 'INVOICE_ALREADY_EXISTS'");
  });
});
