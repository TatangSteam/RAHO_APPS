import fs from 'fs';
import path from 'path';

describe('Sprint 10 reporting and notification contract', () => {
  const modules = path.resolve(__dirname, '..', '..');
  const reports = fs.readFileSync(path.join(modules, 'finance-report', 'finance-report.service.ts'), 'utf8');
  const workflow = fs.readFileSync(path.join(modules, 'workflow', 'approval.service.ts'), 'utf8');
  const payment = fs.readFileSync(path.join(modules, 'invoices', 'services', 'invoice-payment.service.ts'), 'utf8');

  it('semua finance report memakai posted journal lines dan branch scope', () => {
    expect(reports).toContain('prisma.journalLine.findMany');
    expect(reports).toContain("journalEntry: { status: 'POSTED'");
    expect(reports).toContain('getAccessibleBranchIds');
    expect(reports).not.toContain('prisma.invoice.findMany');
    expect(reports).not.toContain('prisma.revenueRecognition.findMany');
  });

  it('dashboard menampilkan status rekonsiliasi kas, deferred, dan jurnal', () => {
    expect(reports).toContain('journalBalanced: trial.balanced');
    expect(reports).toContain('cashBank: cashBank.reconciled');
    expect(reports).toContain('deferredRevenue: deferredRevenue.reconciled');
  });

  it('notification aktif untuk approval dan payment rejection', () => {
    expect(workflow).toContain('notifyApprovers(tx');
    expect(workflow).toContain("title: 'Approval ditolak'");
    expect(workflow).toContain("title: 'Approval disetujui'");
    expect(payment).toContain("title: 'Pembayaran ditolak'");
  });
});
