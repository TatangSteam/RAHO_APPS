import { Role } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { MemberDestructionService } from '../member-destruction.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    member: { findUnique: jest.fn() },
    treatmentSession: { count: jest.fn(), findMany: jest.fn() },
    memberPackage: { count: jest.fn() },
    invoice: { count: jest.fn() },
    invoicePayment: { count: jest.fn() },
    diagnosis: { count: jest.fn() },
    therapyPlan: { count: jest.fn() },
    labResult: { count: jest.fn() },
    memberDocument: { count: jest.fn() },
    memberAddOn: { count: jest.fn() },
    memberNonTherapyPurchase: { count: jest.fn() },
    revenueRecognition: { count: jest.fn() },
    deferredRevenueMovement: { count: jest.fn() },
    homecareBagUsage: { count: jest.fn() },
    homecareMultiBagUsage: { count: jest.fn() },
  },
}));

jest.mock('../../../../config/minio', () => ({ deleteFileByUrl: jest.fn() }));
jest.mock('../../../../utils/auditLog', () => ({ logAudit: jest.fn() }));
jest.mock('../../../packages/services/add-on-inventory.service', () => ({
  releaseAddOnStockInTransaction: jest.fn(),
}));
jest.mock('../../../sessions/services/session-deletion.service', () => ({
  SessionDeletionService: jest.fn().mockImplementation(() => ({ deleteSession: jest.fn() })),
}));

const prismaMock = prisma as any;

function mockZeroCounts() {
  prismaMock.memberPackage.count.mockResolvedValue(0);
  prismaMock.treatmentSession.count.mockResolvedValue(0);
  prismaMock.invoice.count.mockResolvedValue(0);
  prismaMock.invoicePayment.count.mockResolvedValue(0);
  prismaMock.diagnosis.count.mockResolvedValue(0);
  prismaMock.therapyPlan.count.mockResolvedValue(0);
  prismaMock.labResult.count.mockResolvedValue(0);
  prismaMock.memberDocument.count.mockResolvedValue(0);
  prismaMock.memberAddOn.count.mockResolvedValue(0);
  prismaMock.memberNonTherapyPurchase.count.mockResolvedValue(0);
  prismaMock.revenueRecognition.count.mockResolvedValue(0);
  prismaMock.deferredRevenueMovement.count.mockResolvedValue(0);
  prismaMock.homecareBagUsage.count.mockResolvedValue(0);
  prismaMock.homecareMultiBagUsage.count.mockResolvedValue(0);
}

describe('MemberDestructionService preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockZeroCounts();
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member-1',
      memberNo: 'RAHO-0001',
      isEmployee: false,
      user: { role: Role.MEMBER, profile: { fullName: 'Member Dummy' } },
    });
    prismaMock.treatmentSession.count.mockResolvedValue(0);
  });

  it('allows destruction for a regular member with only unposted data', async () => {
    prismaMock.treatmentSession.count.mockResolvedValue(1);

    const preview = await new MemberDestructionService().preview('member-1');

    expect(preview.allowed).toBe(true);
    expect(preview.confirmationPhrase).toBe('DESTRUCTION MEMBER');
    expect(preview.counts.sessions).toBe(1);
  });

  it('allows finalized clinical and financial data for hard destruction', async () => {
    prismaMock.treatmentSession.count.mockResolvedValue(1);
    prismaMock.invoicePayment.count.mockResolvedValue(1);
    prismaMock.revenueRecognition.count.mockResolvedValue(1);

    const preview = await new MemberDestructionService().preview('member-1');

    expect(preview.allowed).toBe(true);
    expect(preview.blockers).toEqual([]);
  });

  it('blocks staff accounts enrolled as members', async () => {
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member-staff',
      memberNo: 'RAHO-STAFF',
      isEmployee: true,
      user: { role: Role.NURSE, profile: { fullName: 'Nakes' } },
    });

    const preview = await new MemberDestructionService().preview('member-staff');

    expect(preview.allowed).toBe(false);
    expect(preview.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'STAFF_MEMBER_ACCOUNT' })]),
    );
  });
});
