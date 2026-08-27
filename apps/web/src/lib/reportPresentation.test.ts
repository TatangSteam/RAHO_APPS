import {
  buildInventoryReportRows,
  buildMemberReportRows,
  buildPaymentReportRows,
  buildSessionReportRows,
} from './reportPresentation';

const sessions = [
  {
    session: {
      sessionCode: 'SES-JKT-001',
      branchName: 'RAHO Jakarta',
      isCompleted: true,
      completionStatus: 'COMPLETED' as const,
      member: { fullName: 'Siti Aminah', memberNo: 'MBR-001' },
      doctor: { fullName: 'dr. Andri' },
    },
  },
  {
    session: {
      sessionCode: 'SES-BGR-001',
      branchName: 'RAHO Bogor',
      isCompleted: false,
      completionStatus: 'IN_PROGRESS' as const,
      member: { fullName: 'Budi Santoso', memberNo: 'MBR-002' },
      doctor: { fullName: 'dr. Dewi' },
    },
  },
];

describe('session report presentation', () => {
  it('shows the actual branch returned by the filtered session API', () => {
    const rows = buildSessionReportRows([sessions[0]], {
      status: 'Semua Status',
      member: '',
      doctor: '',
    });

    expect(rows).toEqual([expect.objectContaining({
      name: 'Siti Aminah · SES-JKT-001',
      branch: 'RAHO Jakarta',
      status: 'Completed',
    })]);
    expect(rows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ branch: 'RAHO Bogor' }),
    ]));
  });

  it('combines status, member, and doctor filters', () => {
    expect(buildSessionReportRows(sessions, {
      status: 'Pending',
      member: 'budi',
      doctor: 'dewi',
    })).toEqual([
      expect.objectContaining({ name: 'Budi Santoso · SES-BGR-001', status: 'Pending' }),
    ]);
  });
});

describe('other real report presentations', () => {
  it('filters members by status, search, and registration date', () => {
    const rows = buildMemberReportRows([{
      memberNo: 'MBR-JKT-001', fullName: 'Ani', registrationBranch: 'Jakarta',
      isActive: true, createdAt: '2026-08-10T10:00:00.000Z',
    }], { status: 'Completed', member: 'ani', startDate: '2026-08-01', endDate: '2026-08-31' });
    expect(rows).toEqual([expect.objectContaining({ branch: 'Jakarta', total: '1' })]);
  });

  it('maps paid invoices and keeps their real branch and amount', () => {
    const rows = buildPaymentReportRows([{
      invoiceNumber: 'INV-001', memberName: 'Budi', memberNo: 'MBR-002', branchName: 'Bogor',
      status: 'PAID', totalAmount: 1500000, createdAt: '2026-08-20T10:00:00.000Z',
    }], { status: 'Paid', member: 'budi', startDate: '', endDate: '' });
    expect(rows).toEqual([expect.objectContaining({ branch: 'Bogor', status: 'Paid' })]);
    expect(rows[0].total).toContain('1.500.000');
  });

  it('uses inventory reconciliation as its report status', () => {
    const rows = buildInventoryReportRows([{
      inventoryValue: '250000', quantityReconciled: false, branch: { name: 'Jakarta' },
      masterProduct: { sku: 'IFA-001', name: 'IFA 250' }, stockLocation: { name: 'Gudang Utama' },
    }], { status: 'Pending', member: 'ifa' });
    expect(rows).toEqual([expect.objectContaining({ branch: 'Jakarta', status: 'Pending' })]);
  });
});
