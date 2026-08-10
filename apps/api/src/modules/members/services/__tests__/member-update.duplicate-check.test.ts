import { prisma } from '../../../../lib/prisma';
import { MemberUpdateService } from '../member-update.service';
import { Role } from '@prisma/client';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    member: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
});
