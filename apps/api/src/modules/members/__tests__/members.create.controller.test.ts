import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { sendSuccess } from '../../../utils/response';
import { MembersController } from '../members.controller';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    branch: {
      findFirst: jest.fn(),
    },
    managerBranch: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/response', () => ({
  sendSuccess: jest.fn(),
}));

jest.mock('../members.service', () => ({
  MembersService: jest.fn().mockImplementation(() => ({
    createMember: jest.fn(),
  })),
}));

describe('MembersController.createMember', () => {
  const controller = new MembersController();
  const createMemberMock = (
    jest.requireMock('../members.service').MembersService as jest.Mock
  ).mock.results[0].value.createMember as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows SUPER_ADMIN to create a member in the selected active branch', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'branch-1' });
    createMemberMock.mockResolvedValue({
      memberId: 'member-1',
      memberNo: '317101-0001',
      message: 'Member berhasil dibuat',
    } as any);

    const req = {
      body: {
        branchId: 'branch-1',
        fullName: 'Member Test',
        phone: '081234567890',
        memberUsername: 'member.test',
        memberPassword: 'password123',
      },
      files: {},
      headers: {},
      user: {
        userId: 'super-admin-1',
        role: Role.SUPER_ADMIN,
        branchId: null,
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.createMember(req, res, next);

    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'branch-1',
        isActive: true,
      },
      select: { id: true },
    });
    expect(createMemberMock).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-1' }),
      { psp: undefined, photo: undefined },
      'branch-1',
      'super-admin-1'
    );
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ memberId: 'member-1' }),
      201
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects SUPER_ADMIN when the selected branch is missing or inactive', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

    const req = {
      body: {
        branchId: 'missing-branch',
        fullName: 'Member Test',
        phone: '081234567890',
        memberUsername: 'member.test',
        memberPassword: 'password123',
      },
      files: {},
      headers: {},
      user: {
        userId: 'super-admin-1',
        role: Role.SUPER_ADMIN,
        branchId: null,
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.createMember(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        code: 'BRANCH_NOT_FOUND',
      })
    );
    expect(createMemberMock).not.toHaveBeenCalled();
    expect(sendSuccess).not.toHaveBeenCalled();
  });
});
