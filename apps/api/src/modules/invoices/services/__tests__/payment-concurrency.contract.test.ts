import { readFileSync } from 'fs';
import path from 'path';

describe('payment concurrency contract', () => {
  const service = readFileSync(path.resolve(__dirname, '../invoice-payment.service.ts'), 'utf8');
  const migration = readFileSync(path.resolve(__dirname, '../../../../../prisma/migrations/20260721140000_add_payment_cash_bank_foundation/migration.sql'), 'utf8');

  it('serializes submission and verification on invoice/payment rows', () => {
    expect(service).toContain('FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE');
    expect(service).toContain('FROM "invoice_payments" WHERE "id" = ${paymentId} FOR UPDATE');
  });

  it('has unique database guards for retry and one cash posting per payment', () => {
    expect(migration).toContain('invoice_payments_idempotencyKey_key');
    expect(migration).toContain('cash_bank_transactions_invoicePaymentId_key');
    expect(migration).toContain('cash_bank_transactions_postingKey_key');
  });

  it('rechecks idempotency after acquiring the invoice lock', () => {
    const lock = service.indexOf('FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE');
    const replayAfterLock = service.indexOf('const replayAfterLock', lock);
    expect(lock).toBeGreaterThan(-1);
    expect(replayAfterLock).toBeGreaterThan(lock);
  });
});
