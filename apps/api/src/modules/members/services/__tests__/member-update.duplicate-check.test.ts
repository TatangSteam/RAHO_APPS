import { prisma } from '../../../../lib/prisma';
import { MemberUpdateService } from '../member-update.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    member: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
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
      dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
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
});
