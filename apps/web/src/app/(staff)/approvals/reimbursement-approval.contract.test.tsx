import fs from 'fs';
import path from 'path';

describe('Approval Inbox reimbursement contract', () => {
  const page = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');
  const reimbursementPage = fs.readFileSync(path.resolve(__dirname, '..', 'reimbursements', 'page.tsx'), 'utf8');

  it('shows amount, receipt photos, and all review decisions', () => {
    expect(page).toContain('rupiah(row.amount)');
    expect(page).toContain('Foto bukti');
    expect(page).toContain("decide('APPROVE')");
    expect(page).toContain("decide('REJECT')");
    expect(page).toContain("decide('RETURN_FOR_REVISION')");
  });

  it('supports draft submission, correction, cancellation, and payment', () => {
    expect(reimbursementPage).toContain('reimbursementApi.submit');
    expect(reimbursementPage).toContain('reimbursementApi.update');
    expect(reimbursementPage).toContain('reimbursementApi.cancel');
    expect(reimbursementPage).toContain('reimbursementApi.pay');
  });
});
