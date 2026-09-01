import { prisma } from '../../../../lib/prisma';
import { logAudit } from '../../../../utils/auditLog';
import { enqueueContactSafely } from '../../../zoho/zoho.contact.service';
import { MemberUpdateService } from '../member-update.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    member: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../utils/auditLog', () => ({ logAudit: jest.fn() }));
jest.mock('../../../../config/minio', () => ({ deleteFileByUrl: jest.fn() }));
jest.mock('../../../zoho/zoho.contact.service', () => ({ enqueueContactSafely: jest.fn() }));

const prismaMock = prisma as any;

describe('MemberUpdateService deactivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member-1',
      userId: 'member-user-1',
      memberNo: 'RAHO-0001',
      registrationBranchId: 'branch-1',
      isActive: true,
      user: { isActive: true },
    });
  });

  it('deactivates the member and login account in one transaction', async () => {
    const tx = {
      member: { update: jest.fn().mockResolvedValue({}) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(new MemberUpdateService().deleteMember('member-1', 'super-admin-1')).resolves.toEqual({
      message: 'Member berhasil dinonaktifkan',
    });

    expect(tx.member.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { isActive: false },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'member-user-1' },
      data: { isActive: false },
    });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      meta: expect.objectContaining({ action: 'DEACTIVATE_MEMBER' }),
    }));
    expect(enqueueContactSafely).toHaveBeenCalledWith('MEMBER', 'member-1');
  });

  it('does not partially deactivate when the account update fails', async () => {
    prismaMock.$transaction.mockRejectedValue(new Error('user update failed'));

    await expect(
      new MemberUpdateService().deleteMember('member-1', 'super-admin-1'),
    ).rejects.toThrow('user update failed');

    expect(logAudit).not.toHaveBeenCalled();
    expect(enqueueContactSafely).not.toHaveBeenCalled();
  });
});
