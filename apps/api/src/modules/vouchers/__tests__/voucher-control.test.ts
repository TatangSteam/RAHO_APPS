import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { lookupVoucherControl, releaseVoucherControl } from '../voucher.service';
import { releaseVoucherSchema } from '../voucher.schema';
jest.mock('@lib/prisma', () => ({ prisma: {
  campaignVoucher: { findUnique: jest.fn(), update: jest.fn() },
  voucherClaimLocation: { findMany: jest.fn() },
  voucherCampaign: { updateMany: jest.fn() }, auditLog: { create: jest.fn() },
  $transaction: jest.fn(), $executeRaw: jest.fn(),
} }));
const db = prisma as any;
const input = { code: 'RAHO-TEST-23456789', reason: 'Penerima sebelumnya salah ditetapkan' };
const voucher = { id: 'v1', campaignId: 'c1', codeLast4: '6789', status: 'ISSUED', claimedAt: null,
  allowedLocationId: null, claimedLocationId: null, recipientNameSnapshot: 'Penerima Lama',
  campaign: { code: 'TEST', title: 'Test', basicSessions: 10, boosterSessions: 0 } };
describe('voucher operator control', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation((callback: any) => callback(db));
    db.campaignVoucher.findUnique.mockResolvedValue(voucher);
    db.voucherClaimLocation.findMany.mockResolvedValue([{ id: 'l1' }]);
    db.campaignVoucher.update.mockImplementation(async ({ data }: any) => ({ ...voucher, ...data }));
  });
  it.each([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.MEMBER])('denies control to %s', async (role) => {
    await expect(lookupVoucherControl('u1', role, input.code)).rejects.toMatchObject({ status: 403 });
    await expect(releaseVoucherControl('u1', role, input)).rejects.toMatchObject({ status: 403 });
    expect(db.campaignVoucher.findUnique).not.toHaveBeenCalled();
  });
  it('shows actual status with masked identity', async () => {
    const result = await lookupVoucherControl('u1', Role.VOUCHER_OPERATOR, input.code);
    expect(result.status).toBe('ISSUED');
    expect(result.maskedCode).toBe('RAHO-****-6789');
  });
  it('releases an unclaimed issued recipient and records a reason atomically', async () => {
    await expect(releaseVoucherControl('u1', Role.VOUCHER_OPERATOR, input)).resolves.toMatchObject({ status: 'AVAILABLE' });
    expect(db.campaignVoucher.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      recipientMemberId: null, recipientNameSnapshot: null, recipientNikHash: null, recipientDateOfBirth: null, nikLast4: null,
    }) }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ description: input.reason }) }));
  });
  it.each(['CLAIMED', 'AVAILABLE', 'CANCELLED', 'EXPIRED'])('cannot release %s', async (status) => {
    db.campaignVoucher.findUnique.mockResolvedValue({ ...voucher, status });
    await expect(releaseVoucherControl('u1', Role.VOUCHER_OPERATOR, input)).rejects.toMatchObject({ code: 'VOUCHER_RELEASE_NOT_ALLOWED' });
    expect(db.campaignVoucher.update).not.toHaveBeenCalled();
  });
  it('rechecks status under lock if a claim won the race', async () => {
    db.campaignVoucher.findUnique.mockResolvedValueOnce(voucher).mockResolvedValueOnce({ ...voucher, status: 'CLAIMED', claimedAt: new Date() });
    await expect(releaseVoucherControl('u1', Role.VOUCHER_OPERATOR, input)).rejects.toMatchObject({ code: 'VOUCHER_RELEASE_NOT_ALLOWED' });
    expect(db.campaignVoucher.update).not.toHaveBeenCalled();
  });
  it('rejects vouchers outside assigned locations', async () => {
    db.campaignVoucher.findUnique.mockResolvedValue({ ...voucher, allowedLocationId: 'other' });
    await expect(releaseVoucherControl('u1', Role.VOUCHER_OPERATOR, input)).rejects.toMatchObject({ status: 403 });
    expect(db.campaignVoucher.update).not.toHaveBeenCalled();
  });
  it('requires a reason', () => {
    expect(releaseVoucherSchema.safeParse({ code: input.code, reason: '' }).success).toBe(false);
  });
});
