import bcrypt from 'bcryptjs';
import { prisma } from '@lib/prisma';
import { generateTokenPair } from '@lib/jwt';
import { logAudit } from '@utils/auditLog';
import { loginService } from '../auth.service';

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: jest.fn() },
}));

jest.mock('@lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@lib/jwt', () => ({
  generateTokenPair: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('@utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

const prismaMock = prisma as any;

describe('loginService with a member username', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'member.test',
      password: 'hashed-password',
      role: 'MEMBER',
      branchId: 'branch-1',
      staffCode: null,
      isActive: true,
      profile: { fullName: 'Member Test', avatarUrl: null },
      branch: { id: 'branch-1', branchCode: '317101' },
    });
    prismaMock.user.update.mockResolvedValue({});
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (generateTokenPair as jest.Mock).mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    (logAudit as jest.Mock).mockResolvedValue(undefined);
  });

  it('queries the existing email column using the username', async () => {
    const result = await loginService({
      identifier: 'member.test',
      password: 'password123',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'member.test' } })
    );
    expect(result.user).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        role: 'MEMBER',
        email: 'member.test',
      })
    );
  });
});
