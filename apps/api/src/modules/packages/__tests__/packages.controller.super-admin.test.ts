import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@lib/prisma';
import { PackagesService } from '../packages.service';
import { PackagesController } from '../packages.controller';

jest.mock('@lib/prisma', () => ({
  prisma: {
    member: { findUnique: jest.fn() },
  },
}));

describe('PackagesController Super Admin assignment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('uses the member registration branch instead of the Super Admin home branch', async () => {
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      registrationBranchId: 'branch-member',
    });
    const assignPackage = jest
      .spyOn(PackagesService.prototype, 'assignPackage')
      .mockResolvedValue({ id: 'assignment-1' } as never);
    const controller = new PackagesController();
    const req = {
      params: { memberId: 'member-1' },
      body: { packages: [{ pricingId: 'pricing-1', quantity: 1 }] },
      user: {
        id: 'super-admin-1',
        userId: 'super-admin-1',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        branchId: 'branch-home',
        branchCode: 'HOME',
        fullName: 'Super Admin',
        staffCode: null,
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await controller.assignPackage(req, res, next);

    expect(prisma.member.findUnique).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      select: { registrationBranchId: true },
    });
    expect(assignPackage).toHaveBeenCalledWith(
      'member-1',
      expect.objectContaining({ packages: [{ pricingId: 'pricing-1', quantity: 1 }] }),
      'branch-member',
      'super-admin-1',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requests branch-only pricing for the member assignment catalog', async () => {
    const getPackagePricings = jest
      .spyOn(PackagesService.prototype, 'getPackagePricings')
      .mockResolvedValue([]);
    const controller = new PackagesController();
    const req = {
      query: {
        branchId: 'branch-member',
        catalogScope: 'BRANCH_ONLY',
      },
      user: {
        role: 'SUPER_ADMIN',
        branchId: 'branch-home',
      },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    await controller.getPackagePricings(req, res, next);

    expect(getPackagePricings).toHaveBeenCalledWith('branch-member', {
      includeGlobalFallback: false,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
