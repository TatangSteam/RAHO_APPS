import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { sendSuccess } from '../../../utils/response';
import { MembersController } from '../members.controller';

jest.mock('../../../lib/prisma', () => ({ prisma: { member: { findUnique: jest.fn() }, managerBranch: { findFirst: jest.fn() } } }));
jest.mock('../../../utils/response', () => ({ sendSuccess: jest.fn() }));
jest.mock('../members.service', () => ({ MembersService: jest.fn().mockImplementation(() => ({ updateMember: jest.fn() })) }));

describe('Admin Manager member name branch permissions', () => {
  const controller = new MembersController();
  const updateMember = (jest.requireMock('../members.service').MembersService as jest.Mock).mock.results[0].value.updateMember;
  const request = () => ({ params: { memberId: 'member-1' }, body: { fullName: 'Nama Baru' }, user: { userId: 'manager-1', role: Role.ADMIN_MANAGER, adminManagerAccessScope: 'FULL' } } as unknown as Request);
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({ registrationBranchId: 'branch-1', branchAccesses: [{ branchId: 'branch-2' }] });
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-full' });
    updateMember.mockResolvedValue({ fullName: 'Nama Baru' });
  });

  it('allows name correction with active FULL assignment in one of the member branches', async () => {
    const res = {} as Response;
    const next = jest.fn();
    await controller.updateMember(request(), res, next);
    expect(prisma.managerBranch.findFirst).toHaveBeenCalledWith({ where: { userId: 'manager-1', branchId: { in: ['branch-1', 'branch-2'] }, accessScope: 'FULL', branch: { isActive: true } }, select: { id: true } });
    expect(updateMember).toHaveBeenCalledWith('member-1', { fullName: 'Nama Baru' }, 'manager-1', Role.ADMIN_MANAGER);
    expect(sendSuccess).toHaveBeenCalledWith(res, { fullName: 'Nama Baru' });
    expect(next).not.toHaveBeenCalled();
  });
  it('refuses global MEMBER_VIEW_ONLY', async () => {
    const req = request(); req.user.adminManagerAccessScope = 'MEMBER_VIEW_ONLY';
    const next = jest.fn();
    await controller.updateMember(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'ADMIN_MANAGER_MEMBER_VIEW_ONLY' }));
    expect(updateMember).not.toHaveBeenCalled();
    expect(prisma.managerBranch.findFirst).not.toHaveBeenCalled();
  });
  it('refuses a member with no active FULL branch assignment (including read-only branches)', async () => {
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue(null);
    const next = jest.fn();
    await controller.updateMember(request(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'BRANCH_ACCESS_DENIED' }));
    expect(updateMember).not.toHaveBeenCalled();
  });
  it('reports a missing member without mutating anything', async () => {
    (prisma.member.findUnique as jest.Mock).mockResolvedValue(null);
    const next = jest.fn();
    await controller.updateMember(request(), {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: 'MEMBER_NOT_FOUND' }));
    expect(updateMember).not.toHaveBeenCalled();
  });
  it('keeps existing Super Admin update flow without a manager assignment lookup', async () => {
    const req = request(); req.user.role = Role.SUPER_ADMIN;
    await controller.updateMember(req, {} as Response, jest.fn());
    expect(updateMember).toHaveBeenCalled();
    expect(prisma.managerBranch.findFirst).not.toHaveBeenCalled();
  });
});
