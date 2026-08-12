import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  buildDeletedUserEmail,
  softDeleteUserService,
} from '../users.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    treatmentSession: {
      count: jest.fn(),
    },
  },
}));

jest.mock('@utils/codeGenerator', () => ({
  generateStaffCode: jest.fn(),
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertCanAssignBaseRole: jest.fn(),
  assertNotSelf: jest.fn(),
  assertTargetInActorScope: jest.fn(),
  getAccessibleBranchIds: jest.fn(),
}));

const prismaMock = prisma as any;

describe('softDeleteUserService', () => {
  const staff = {
    id: 'staff-legacy-1',
    email: 'staff@example.com',
    role: Role.NURSE,
    isActive: true,
    profile: { fullName: 'Staff Lama' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(staff);
    prismaMock.user.update.mockResolvedValue({});
  });

  it('deactivates the account and releases its email while preserving history', async () => {
    prismaMock.treatmentSession.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(4);

    const result = await softDeleteUserService(staff.id);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: staff.id },
      data: {
        isActive: false,
        email: buildDeletedUserEmail(staff.id),
      },
    });
    expect(result).toMatchObject({
      success: true,
      email: staff.email,
      historicalSessions: 4,
      hasHistoricalData: true,
    });
    expect(result.message).toContain('email dapat digunakan kembali');
  });

  it('does not modify the account when an active treatment session exists', async () => {
    prismaMock.treatmentSession.count.mockResolvedValueOnce(1);

    await expect(softDeleteUserService(staff.id)).rejects.toMatchObject({
      code: 'HAS_ACTIVE_SESSIONS',
    });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
