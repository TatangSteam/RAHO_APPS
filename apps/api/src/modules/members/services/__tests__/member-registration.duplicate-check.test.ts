import { prisma } from '../../../../lib/prisma';
import { MemberRegistrationService } from '../member-registration.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    member: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../../../config/minio', () => ({
  uploadFile: jest.fn(),
}));

jest.mock('../../../../utils/imageProcessor', () => ({
  processFile: jest.fn(),
}));

const prismaMock = prisma as any;

const registrationData = {
  fullName: 'Budi Santoso',
  identityType: 'NIK',
  nik: '3174010101010001',
  birthDate: '1990-01-15',
  phone: '081234567890',
  memberUsername: 'budi.santoso',
  memberPassword: 'password123',
} as const;

describe('MemberRegistrationService duplicate checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.branch.findUnique.mockResolvedValue({
      id: 'branch-1',
      branchCode: 'PST',
    });
    prismaMock.member.findFirst.mockResolvedValue(null);
  });

  it('rejects an NIK that is already registered globally', async () => {
    prismaMock.member.findUnique.mockImplementation(({ where }: any) => (
      where.nik ? { id: 'existing-member' } : null
    ));

    await expect(
      new MemberRegistrationService().createMember(
        registrationData,
        {},
        'branch-1',
        'admin-1',
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'NIK_EXISTS',
    });

    expect(prismaMock.member.findMany).not.toHaveBeenCalled();
  });

  it('rejects the same normalized name on the same birth date', async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);
    prismaMock.member.findMany.mockResolvedValue([
      {
        user: {
          profile: { fullName: '  BUDI   SANTOSO ' },
        },
      },
    ]);

    await expect(
      new MemberRegistrationService().createMember(
        registrationData,
        {},
        'branch-1',
        'admin-1',
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MEMBER_NAME_BIRTH_DATE_EXISTS',
    });

    expect(prismaMock.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dateOfBirth: new Date('1990-01-15T00:00:00.000Z') },
      }),
    );
  });
});
