import fs from 'fs';
import path from 'path';

describe('Sprint 7 deferred revenue contract', () => {
  it('pembayaran paket mendanai deferred revenue dan tidak menjadi omzet', () => {
    const apiRoot = path.resolve(__dirname, '..', '..', '..');
    const payment = fs.readFileSync(path.join(apiRoot, 'modules', 'invoices', 'services', 'invoice-payment.service.ts'), 'utf8');
    const revenue = fs.readFileSync(path.join(apiRoot, 'modules', 'revenue', 'revenue.service.ts'), 'utf8');
    const dashboard = fs.readFileSync(path.join(apiRoot, 'modules', 'dashboard', 'dashboard.service.ts'), 'utf8');
    const schema = fs.readFileSync(path.resolve(apiRoot, '..', 'prisma', 'schema.prisma'), 'utf8');
    expect(payment).toContain('fundPackageDeferredRevenueInTransaction');
    expect(payment).toContain('payment.invoice.settlementAccountCode, credit: payment.amount');
    expect(schema).toContain('settlementAccountCode String    @default("2200")');
    expect(revenue).toContain("type: 'FUNDING'");
    expect(revenue).not.toContain("postJournal({");
    expect(dashboard).toContain('prisma.revenueRecognition.findMany');
    expect(dashboard).toContain("status: 'POSTED'");
  });

  it('event TREATMENT_COMPLETED atomik dan anti-double recognition siap', () => {
    const apiRoot = path.resolve(__dirname, '..', '..', '..');
    const completion = fs.readFileSync(path.join(apiRoot, 'modules', 'sessions', 'services', 'session-completion.service.ts'), 'utf8');
    const revenue = fs.readFileSync(path.join(apiRoot, 'modules', 'revenue', 'revenue.service.ts'), 'utf8');
    const migration = fs.readFileSync(path.resolve(apiRoot, '..', 'prisma', 'migrations', '20260722100000_add_deferred_revenue_recognition', 'migration.sql'), 'utf8');
    expect(completion).toContain('createTreatmentCompletedEventInTransaction');
    expect(completion).toContain('FOR UPDATE');
    expect(revenue).toContain('TREATMENT_COMPLETED:${input.sessionId}');
    expect(revenue).toContain('reserveTreatmentCompletedRevenue');
    expect(migration).toContain('revenue_recognitions_treatmentSessionId_memberPackageId_key');
    expect(migration).toContain('domain_events_eventKey_key');
  });
});
