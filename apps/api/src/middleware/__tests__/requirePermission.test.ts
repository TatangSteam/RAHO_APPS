import type { NextFunction, Request, Response } from 'express';
import { requirePermission } from '../requirePermission';
import { hasPermission } from '@modules/iam/authorization.service';

jest.mock('@modules/iam/authorization.service', () => ({
  hasPermission: jest.fn(),
}));

const mockedHasPermission = hasPermission as jest.MockedFunction<typeof hasPermission>;

describe('requirePermission', () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  beforeEach(() => jest.clearAllMocks());

  it('continues when the effective permission is granted for the requested branch', async () => {
    mockedHasPermission.mockResolvedValue(true);
    const next = jest.fn() as NextFunction;
    const request = {
      user: { userId: 'actor-1' },
      params: { branchId: 'branch-1' },
      body: {},
      query: {},
    } as unknown as Request;

    await requirePermission('INVOICE.READ')(request, response, next);

    expect(mockedHasPermission).toHaveBeenCalledWith('actor-1', 'INVOICE.READ', 'branch-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects access when permission is not effective', async () => {
    mockedHasPermission.mockResolvedValue(false);
    const next = jest.fn() as NextFunction;
    const request = {
      user: { userId: 'actor-1' },
      params: {},
      body: {},
      query: {},
    } as unknown as Request;

    await requirePermission('IAM.PERMISSION.MANAGE')(request, response, next);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'PERMISSION_FORBIDDEN' }),
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
