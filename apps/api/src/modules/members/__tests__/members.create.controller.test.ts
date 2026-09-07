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
    member: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/response', () => ({
  sendSuccess: jest.fn(),
}));

jest.mock('../members.service', () => ({
  MembersService: jest.fn().mockImplementation(() => ({
    createMember: jest.fn(),
    uploadMemberDocument: jest.fn(),
  })),
}));

describe('MembersController.uploadMemberDocuments', () => {
  const controller = new MembersController();
  const uploadMemberDocumentMock = (
    jest.requireMock('../members.service').MembersService as jest.Mock
  ).mock.results[0].value.uploadMemberDocument as jest.Mock;

  const file = {
    originalname: 'consent.pdf',
    mimetype: 'application/pdf',
    size: 100,
    buffer: Buffer.from('%PDF-1.4'),
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      registrationBranchId: 'branch-1',
      branchAccesses: [],
    });
  });

  it('allows ADMIN_MANAGER with FULL branch assignment to upload informed consent', async () => {
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
    uploadMemberDocumentMock.mockResolvedValue({ id: 'document-1' });
    const req = {
      params: { memberId: 'member-1' },
      body: { documentType: 'PERSETUJUAN_SETELAH_PENJELASAN' },
      file,
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['branch-1'],
        adminManagerAccessScope: 'FULL',
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.uploadMemberDocuments(req, res, next);

    expect(prisma.managerBranch.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'manager-1',
        branchId: { in: ['branch-1'] },
        accessScope: 'FULL',
      }),
    }));
    expect(uploadMemberDocumentMock).toHaveBeenCalledWith(
      'member-1',
      file,
      'PERSETUJUAN_SETELAH_PENJELASAN',
      'manager-1',
    );
    expect(sendSuccess).toHaveBeenCalledWith(res, { id: 'document-1' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects document upload without a FULL assignment to a member branch', async () => {
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue(null);
    const req = {
      params: { memberId: 'member-1' },
      body: { documentType: 'PERSETUJUAN_SETELAH_PENJELASAN' },
      file,
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['branch-1'],
        adminManagerAccessScope: 'FULL',
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.uploadMemberDocuments(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 403,
      code: 'ADMIN_MANAGER_BRANCH_MEMBER_VIEW_ONLY',
    }));
    expect(uploadMemberDocumentMock).not.toHaveBeenCalled();
  });
});

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
        birthDate: '1990-01-15',
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
        birthDate: '1990-01-15',
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
