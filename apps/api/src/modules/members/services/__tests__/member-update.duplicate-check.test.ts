import { prisma } from '../../../../lib/prisma';
import { MemberUpdateService } from '../member-update.service';
import { Role } from '@prisma/client';
import { logAudit } from '../../../../utils/auditLog';
import { updateMemberSchema } from '../../members.schema';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    member: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../../../config/minio', () => ({
  deleteFileByUrl: jest.fn(),
}));
jest.mock('../../../zoho/zoho.contact.service', () => ({ enqueueContactSafely: jest.fn() }));

const prismaMock = prisma as any;

describe('MemberUpdateService duplicate checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.member.findUnique.mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      nik: '3173000000000001',
      tempatLahir: null,
      dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
      jenisKelamin: 'L',
      agama: null,
      address: null,
      pekerjaan: null,
      statusNikah: null,
      emergencyContact: null,
      sumberInfoRaho: null,
      postalCode: null,
      isActive: true,
      isDeceased: false,
      firstIncentiveType: null,
      firstIncentiveValue: null,
      nextIncentiveType: null,
      nextIncentiveValue: null,
      user: {
        email: 'member.satu',
        profile: {
          fullName: 'Member Satu',
          phone: '081234567890',
        },
      },
    });
  });

  it('rejects an update that would duplicate another name and birth date', async () => {
    prismaMock.member.findMany.mockResolvedValue([
      {
        user: {
          profile: { fullName: 'Budi Santoso' },
        },
      },
    ]);

    await expect(
      new MemberUpdateService().updateMember(
        'member-1',
        {
          fullName: '  BUDI   SANTOSO ',
          birthDate: '1990-01-15',
        },
        'admin-1',
        Role.SUPER_ADMIN,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MEMBER_NAME_BIRTH_DATE_EXISTS',
    });

    expect(prismaMock.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: 'member-1' },
          dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
        },
      }),
    );
  });

  it('rejects an Admin Manager attempt to overwrite a populated member field', async () => {
    await expect(
      new MemberUpdateService().updateMember(
        'member-1',
        { phone: '089999999999' },
        'manager-1',
        Role.ADMIN_MANAGER,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'ADMIN_MANAGER_MEMBER_FIELD_LOCKED',
      message: expect.stringContaining('Nomor telepon'),
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('lets Admin Manager correct an existing name without changing member identity and audits the change', async () => {
    const original = await prismaMock.member.findUnique();
    const profileUpdate = jest.fn();
    const memberUpdate = jest.fn();
    const userUpdate = jest.fn();
    const updated = { ...original, registrationBranchId: 'branch-1', createdAt: new Date(), updatedAt: new Date(), user: { ...original.user, profile: { ...original.user.profile, fullName: 'Nama Baru' } } };
    prismaMock.member.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work({ userProfile: { update: profileUpdate }, member: { update: memberUpdate, findUnique: jest.fn().mockResolvedValue(updated) }, user: { update: userUpdate } }));
    const result = await new MemberUpdateService().updateMember('member-1', { fullName: ' Nama   Baru ' }, 'manager-1', Role.ADMIN_MANAGER);
    expect(result.fullName).toBe('Nama Baru');
    expect(profileUpdate).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { fullName: 'Nama Baru' } });
    expect(memberUpdate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ userId: 'manager-1', resourceId: 'member-1', meta: { changes: { fullName: ' Nama   Baru ' } } }));
  });

  it('still refuses duplicate name and birth date for Admin Manager', async () => {
    prismaMock.member.findMany.mockResolvedValue([{ user: { profile: { fullName: 'Nama Baru' } } }]);
    await expect(new MemberUpdateService().updateMember('member-1', { fullName: 'Nama Baru' }, 'manager-1', Role.ADMIN_MANAGER)).rejects.toMatchObject({ status: 409, code: 'MEMBER_NAME_BIRTH_DATE_EXISTS' });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it.each(['', '  ', ' A '])('refuses an invalid name %j at the API boundary', (fullName) => {
    expect(updateMemberSchema.safeParse({ fullName }).success).toBe(false);
  });

  it('allows an Admin Manager request that only fills an empty field', async () => {
    const transactionReached = new Error('TRANSACTION_REACHED');
    prismaMock.$transaction.mockRejectedValue(transactionReached);

    await expect(
      new MemberUpdateService().updateMember(
        'member-1',
        {
          fullName: 'Member Satu',
          address: 'Jl. Melati 10',
        },
        'manager-1',
        Role.ADMIN_MANAGER,
      ),
    ).rejects.toBe(transactionReached);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('allows Admin Layanan to update a member phone number', async () => {
    const transactionReached = new Error('TRANSACTION_REACHED');
    prismaMock.userProfile.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValue(transactionReached);

    await expect(
      new MemberUpdateService().updateMember(
        'member-1',
        { phone: '089999999999' },
        'admin-layanan-1',
        Role.ADMIN_LAYANAN,
      ),
    ).rejects.toBe(transactionReached);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects Admin Layanan attempts to update other member profile fields', async () => {
    await expect(
      new MemberUpdateService().updateMember(
        'member-1',
        { fullName: 'Nama Baru', phone: '089999999999' },
        'admin-layanan-1',
        Role.ADMIN_LAYANAN,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'ADMIN_LAYANAN_MEMBER_FIELD_FORBIDDEN',
    });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('keeps the existing Admin Layanan permission to update life status', async () => {
    const transactionReached = new Error('TRANSACTION_REACHED');
    prismaMock.$transaction.mockRejectedValue(transactionReached);

    await expect(
      new MemberUpdateService().updateMember(
        'member-1',
        { isDeceased: true },
        'admin-layanan-1',
        Role.ADMIN_LAYANAN,
      ),
    ).rejects.toBe(transactionReached);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
