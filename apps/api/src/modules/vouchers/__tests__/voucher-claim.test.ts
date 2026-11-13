import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { claimVoucher } from '../voucher.service';

jest.mock('@lib/prisma', () => ({ prisma: {
  voucherClaimLocation: { findMany: jest.fn() },
  voucherClaimAttempt: { count: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), create: jest.fn() },
  campaignVoucher: { findUnique: jest.fn(), update: jest.fn() },
  voucherCampaign: { update: jest.fn() },
  $executeRaw: jest.fn(), $transaction: jest.fn(),
} }));
jest.mock('@utils/auditLog', () => ({ logAudit: jest.fn() }));

const db = prisma as any;
const input = {
  code: 'RAHO-TEST-ABCDEFG234', recipientName: 'Penerima Baru',
  nik: '3173000000001234', dateOfBirth: '1990-01-01',
  locationId: 'location-1', requestId: '4d660640-5786-48fa-8902-7d2b94d05015',
};

describe('voucher claim recipient eligibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.voucherClaimLocation.findMany.mockResolvedValue([{ id: input.locationId }]);
    db.voucherClaimAttempt.count.mockResolvedValue(0);
    db.voucherClaimAttempt.findUnique.mockResolvedValue(null);
    db.voucherClaimAttempt.upsert.mockResolvedValue({});
    db.$transaction.mockImplementation((callback: any) => callback(db));
  });

  it('claims an AVAILABLE code for a new recipient without any member account', async () => {
    const voucher = {
      id: 'voucher-1', campaignId: 'campaign-1', status: 'AVAILABLE',
      recipientMember: null, recipientNameSnapshot: null, recipientNikHash: null,
      recipientDateOfBirth: null, allowedLocationId: null, claimDeadline: null,
      campaign: { code: 'TEST', title: 'Test', basicSessions: 10, boosterSessions: 0 },
    };
    db.campaignVoucher.findUnique.mockResolvedValue(voucher);
    db.campaignVoucher.update.mockImplementation(async ({ data }: any) => ({ ...voucher, ...data }));
    const result = await claimVoucher('operator-1', Role.VOUCHER_OPERATOR, input);
    expect(result.status).toBe('CLAIMED');
    expect(db.campaignVoucher.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ recipientNameSnapshot: input.recipientName, nikLast4: '1234', status: 'CLAIMED' }),
    }));
    expect(db.voucherClaimAttempt.create).toHaveBeenCalled();
  });

  it('reports a missing code without suggesting that a member account is required', async () => {
    db.campaignVoucher.findUnique.mockResolvedValue(null);
    await expect(claimVoucher('operator-1', Role.VOUCHER_OPERATOR, input))
      .rejects.toMatchObject({ status: 404, code: 'VOUCHER_NOT_FOUND' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('keeps an ISSUED code bound to its designated recipient', async () => {
    db.campaignVoucher.findUnique.mockResolvedValue({
      id: 'voucher-1', status: 'ISSUED', campaign: {},
      recipientNameSnapshot: 'Penerima Lain', recipientMember: null,
    });
    await expect(claimVoucher('operator-1', Role.VOUCHER_OPERATOR, input))
      .rejects.toMatchObject({ code: 'VOUCHER_IDENTITY_MISMATCH' });
    expect(db.campaignVoucher.update).not.toHaveBeenCalled();
  });
});
