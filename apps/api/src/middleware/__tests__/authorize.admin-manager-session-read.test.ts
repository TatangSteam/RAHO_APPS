import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { authorize } from '../authorize';

jest.mock('@lib/prisma', () => ({
  prisma: {
    managerBranch: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@utils/response', () => ({
  sendError: jest.fn(),
}));

const readOnlyManager = {
  userId: 'manager-1',
  role: Role.ADMIN_MANAGER,
  branchId: null,
  branches: ['branch-1'],
  adminManagerAccessScope: 'MEMBER_VIEW_ONLY',
};

function request(method: string, path: string): Request {
  return {
    method,
    baseUrl: '/api/v1/treatment-sessions',
    path,
    params: {},
    query: {},
    body: {},
    user: readOnlyManager,
  } as unknown as Request;
}

describe('authorize ADMIN_MANAGER session read-only access', () => {
  const response = {} as Response;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    '/',
    '/session-1',
    '/session-1/evaluation',
    '/session-1/materials',
    '/session-1/supporting-photos',
    '/encounters/encounter-1/diagnoses',
  ])('allows GET %s so branch-scoped read authorization can run', async (path) => {
    const next = jest.fn() as NextFunction;

    await authorize([Role.ADMIN_MANAGER])(request('GET', path), response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    '/workflow-burden',
    '/unfinished-reminders',
    '/members/member-1/suggested-numbers',
  ])('does not broaden read-only access to manager operations at GET %s', async (path) => {
    const { sendError } = jest.requireMock('@utils/response') as { sendError: jest.Mock };
    const next = jest.fn() as NextFunction;

    await authorize([Role.ADMIN_MANAGER])(request('GET', path), response, next);

    expect(sendError).toHaveBeenCalledWith(
      response,
      403,
      'ADMIN_MANAGER_MEMBER_VIEW_ONLY',
      'Akses Admin Manager ini dibatasi hanya untuk melihat data member.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps session mutations blocked', async () => {
    const { sendError } = jest.requireMock('@utils/response') as { sendError: jest.Mock };
    const next = jest.fn() as NextFunction;

    await authorize([Role.ADMIN_MANAGER])(request('PATCH', '/session-1/details'), response, next);

    expect(sendError).toHaveBeenCalledWith(
      response,
      403,
      'ADMIN_MANAGER_MEMBER_VIEW_ONLY',
      'Akses Admin Manager ini dibatasi hanya untuk melihat data member.',
    );
    expect(next).not.toHaveBeenCalled();
  });
});
