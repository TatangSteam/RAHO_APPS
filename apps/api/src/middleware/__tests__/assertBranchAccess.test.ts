import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { assertBranchAccess } from '../assertBranchAccess';
import { prisma } from '@lib/prisma';
import { sendError } from '@utils/response';

jest.mock('@lib/prisma', () => ({
  prisma: {
    staffBranch: {
      findMany: jest.fn(),
    },
    managerBranch: {
      findMany: jest.fn(),
    },
    member: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock('@utils/response');

function makeRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    params: { memberId: 'member-1' },
    user: {
      id: 'user-1',
      userId: 'user-1',
      email: 'staff@example.com',
      role: Role.ADMIN_CABANG,
      branchId: 'branch-1',
      branchCode: 'JKT',
      fullName: 'Staff User',
      staffCode: 'STAFF001',
    },
    ...overrides,
  };
}

describe('assertBranchAccess middleware', () => {
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
    (prisma.staffBranch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.managerBranch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-1',
      branchAccesses: [],
    });
  });

  it('should skip branch check when memberId is missing', async () => {
    const request = makeRequest({ params: {} });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('should bypass branch check for super admin', async () => {
    const request = makeRequest({
      user: {
        ...makeRequest().user!,
        role: Role.SUPER_ADMIN,
        branchId: null,
      },
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('should allow admin manager access through assigned manager branches', async () => {
    const request = makeRequest({
      user: {
        ...makeRequest().user!,
        role: Role.ADMIN_MANAGER,
        branchId: null,
      },
    });

    (prisma.managerBranch.findMany as jest.Mock).mockResolvedValue([
      { branchId: 'branch-2' },
    ]);
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-2',
      branchAccesses: [],
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(sendError).not.toHaveBeenCalled();
  });

  it('should deny admin manager access when member is outside assigned branches', async () => {
    const request = makeRequest({
      user: {
        ...makeRequest().user!,
        role: Role.ADMIN_MANAGER,
        branchId: null,
      },
    });

    (prisma.managerBranch.findMany as jest.Mock).mockResolvedValue([
      { branchId: 'branch-1' },
    ]);
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-2',
      branchAccesses: [],
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(sendError).toHaveBeenCalledWith(
      mockResponse,
      403,
      'BRANCH_ACCESS_DENIED',
      'Anda tidak memiliki akses ke member ini.',
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow access through registration branch', async () => {
    const request = makeRequest();

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(sendError).not.toHaveBeenCalled();
  });

  it('should allow doctor access through assigned staff branches', async () => {
    const request = makeRequest({
      user: {
        ...makeRequest().user!,
        role: Role.DOCTOR,
        branchId: 'branch-1',
      },
    });

    (prisma.staffBranch.findMany as jest.Mock).mockResolvedValue([
      { branchId: 'branch-2' },
    ]);
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-2',
      branchAccesses: [],
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should allow access through granted branch member access', async () => {
    const request = makeRequest();

    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-2',
      branchAccesses: [{ branchId: 'branch-1' }],
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should deny access when user has no branch context', async () => {
    const request = makeRequest({
      user: {
        ...makeRequest().user!,
        branchId: null,
      },
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(sendError).toHaveBeenCalledWith(
      mockResponse,
      403,
      'BRANCH_ACCESS_DENIED',
      'Anda tidak memiliki akses ke member ini.',
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should deny access when member branch is not accessible', async () => {
    const request = makeRequest();

    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-2',
      branchAccesses: [],
    });

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(sendError).toHaveBeenCalledWith(
      mockResponse,
      403,
      'BRANCH_ACCESS_DENIED',
      'Anda tidak memiliki akses ke member ini.',
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return not found when member does not exist', async () => {
    const request = makeRequest();

    (prisma.member.findUnique as jest.Mock).mockResolvedValue(null);

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(sendError).toHaveBeenCalledWith(
      mockResponse,
      404,
      'MEMBER_NOT_FOUND',
      'Member tidak ditemukan.',
    );
  });

  it('should return internal error when lookup fails', async () => {
    const request = makeRequest();

    (prisma.member.findUnique as jest.Mock).mockRejectedValue(new Error('db down'));

    await assertBranchAccess(request as Request, mockResponse as Response, mockNext);

    expect(sendError).toHaveBeenCalledWith(
      mockResponse,
      500,
      'INTERNAL_ERROR',
      'Terjadi kesalahan pada server.',
    );
  });
});
