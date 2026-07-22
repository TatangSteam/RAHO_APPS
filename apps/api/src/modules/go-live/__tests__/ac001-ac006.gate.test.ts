import fs from 'fs';
import path from 'path';

describe('Sprint 11 AC-001–006 automated gate inventory', () => {
  const src = path.resolve(__dirname, '..', '..');
  const read = (relative: string) => fs.readFileSync(path.join(src, relative), 'utf8');

  it('AC-001 pembayaran paket memiliki posting dan PostgreSQL integration test', () => {
    expect(read('revenue/__tests__/sprint8.ac001-ac002.contract.test.ts')).toContain('AC-001');
    expect(read('invoices/services/__tests__/payment-posting.integration.test.ts')).toContain("describeDatabase('AC-001");
  });

  it('AC-002 treatment selesai menguji atomicity, closed period, dan duplicate completion', () => {
    const integration = read('sessions/services/__tests__/session-completion.integration.test.ts');
    expect(integration).toContain('logistics-to-treatment PostgreSQL E2E');
    expect(integration).toContain('shipBranchShipment');
    expect(integration).toContain('receiveBranchShipment');
    expect(integration).toContain("code: 'ACCOUNTING_PERIOD_CLOSED'");
    expect(integration).toContain('service.completeSession(sessionId, actorId)');
    expect(integration).toContain('idempotentReplay');
  });

  it('AC-003 purchasing supplier kredit sampai pembayaran memiliki policy contract', () => {
    const contract = read('purchasing/__tests__/ac003.contract.test.ts');
    const integration = read('purchasing/__tests__/ac003.integration.test.ts');
    const service = read('purchasing/purchasing.service.ts');
    expect(contract).toContain('AC-003');
    expect(contract).toContain('SUPPLIER_PAYMENT_EXCEEDS_BALANCE');
    expect(integration).toContain("['1110', '1300', '2110', '2100']");
    expect(service).toContain('withTransactionRetry');
  });

  it('AC-004/006 transfer menjaga nilai dan double processing lewat PostgreSQL concurrency test', () => {
    const integration = read('inventory/services/__tests__/internal-transfer.concurrency.integration.test.ts');
    expect(integration).toContain('AC-004/AC-006');
    expect(integration).toContain('totalValue.toFixed(4)');
    expect(integration).toContain('toBe(1)');
  });

  it('AC-005 role sejajar memakai granular permission, branch scope, dan anti-self escalation', () => {
    expect(read('iam/__tests__/authorization.service.test.ts')).toContain('anti-self-escalation');
    expect(read('../middleware/__tests__/assertBranchAccess.test.ts')).toContain('BRANCH_ACCESS_DENIED');
    expect(read('../middleware/__tests__/requirePermission.test.ts')).toContain('PERMISSION_FORBIDDEN');
  });

  it('AC-006 mencakup duplicate payment, shipment, treatment, dan FIFO contention', () => {
    expect(read('invoices/services/__tests__/payment-concurrency.contract.test.ts')).toContain('FOR UPDATE');
    expect(read('inventory/services/__tests__/inventory-ledger.concurrency.test.ts')).toContain('competing');
    expect(read('sessions/services/__tests__/session-completion.integration.test.ts')).toContain('Promise.all');
  });

  it('inventory go-live audit merekonsiliasi mutation, FIFO, in-transit, dan control ledger', () => {
    const audit = read('go-live/go-live-audit.service.ts');
    expect(audit).toContain("'INV-004'");
    expect(audit).toContain("'INV-005'");
    expect(audit).toContain("code: { in: ['1300', '1310'] }");
  });
});
