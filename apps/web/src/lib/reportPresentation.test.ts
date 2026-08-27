import { buildSessionReportRows } from './reportPresentation';

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
