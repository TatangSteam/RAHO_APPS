import { SessionRetrievalService } from '../services/session-retrieval.service';
import { Prisma } from '@prisma/client';

describe('SessionRetrievalService branch context', () => {
  it('includes the owning branch identity in session detail data', () => {
    const service = new SessionRetrievalService();
    const session = {
      id: 'session-1',
      sessionCode: 'SES-001',
      encounterId: 'encounter-1',
      encounter: {
        encounterCode: 'ENC-001',
        memberPackage: {
          id: 'member-package-1',
          packageCode: 'PKG-001',
          packageType: 'BASIC',
        },
        member: {
          id: 'member-1',
          memberNo: 'MEM-001',
          user: { profile: { fullName: 'Member Test' } },
        },
      },
      infusKe: 1,
      branchId: 'branch-1',
      pelaksanaan: 'INFUSION',
      treatmentDate: new Date('2026-06-23T00:00:00.000Z'),
      isCompleted: false,
      recognizedRevenue: new Prisma.Decimal(0),
      materialCost: new Prisma.Decimal(0),
      grossProfit: new Prisma.Decimal(0),
      adminLayanan: {
        id: 'admin-1',
        profile: { fullName: 'Admin Layanan' },
      },
      doctor: {
        id: 'doctor-1',
        profile: { fullName: 'Dokter Test' },
      },
      nurse: {
        id: 'nurse-1',
        profile: { fullName: 'Nakes Test' },
      },
      boosterPackage: null,
      sessionDoctors: [],
      sessionNurses: [],
    };

    const result = (service as any).formatSessionData(session, 1, {
      id: 'branch-1',
      branchCode: 'CBG-001',
      name: 'Cabang Test',
    });

    expect(result).toMatchObject({
      branchId: 'branch-1',
      branchCode: 'CBG-001',
      branchName: 'Cabang Test',
    });
  });
});
