/// <reference types="jest" />
import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { sendError, sendSuccess } from '../../../utils/response';
import { SessionsController } from '../sessions.controller';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    treatmentSession: {
      findUnique: jest.fn(),
    },
    managerBranch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/response', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));

jest.mock('../sessions.service', () => ({
  SessionsService: jest.fn().mockImplementation(() => ({
    getSessionById: jest.fn(),
    getAllSessions: jest.fn(),
    createInfusion: jest.fn(),
    updateSessionDetails: jest.fn(),
    updateTherapyPlanSetForSession: jest.fn(),
  })),
}));

jest.mock('../services/session-export.service', () => ({
  SessionExportService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../services/supporting-photos.service', () => ({
  SupportingPhotosService: jest.fn().mockImplementation(() => ({})),
}));

describe('SessionsController branch context', () => {
  const controller = new SessionsController();
  const sessionsServiceMock = (
    jest.requireMock('../sessions.service').SessionsService as jest.Mock
  ).mock.results[0].value;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the session branch when SUPER_ADMIN edits infusion data', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'session-branch',
    });
    sessionsServiceMock.createInfusion.mockResolvedValue({ id: 'infusion-1' });

    const req = {
      params: { sessionId: 'session-1' },
      body: { ifa250: 1 },
      user: {
        userId: 'super-admin-1',
        role: Role.SUPER_ADMIN,
        branchId: 'different-primary-branch',
        branches: [],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.createInfusion(req, res, next);

    expect(sessionsServiceMock.createInfusion).toHaveBeenCalledWith(
      'session-1',
      expect.any(Object),
      'super-admin-1',
      'session-branch'
    );
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      { id: 'infusion-1' },
      201
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows ADMIN_MANAGER to open sessions from an assigned branch', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'managed-branch',
    });
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
    sessionsServiceMock.getSessionById.mockResolvedValue({
      session: { sessionId: 'session-1' },
    });

    const req = {
      params: { sessionId: 'session-1' },
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['managed-branch'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.getSessionById(req, res, next);

    expect(sessionsServiceMock.getSessionById).toHaveBeenCalledWith('session-1');
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      { session: { sessionId: 'session-1' } }
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows ADMIN_MANAGER with FULL branch access to save session details', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'managed-branch',
    });
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue({
      id: 'assignment-1',
      accessScope: 'FULL',
    });
    sessionsServiceMock.updateSessionDetails.mockResolvedValue({ id: 'session-1' });

    const req = {
      params: { sessionId: 'session-1' },
      body: {
        treatmentDate: '2026-08-20T05:00:00.000Z',
        shiftFollowingSessions: false,
      },
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['managed-branch'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.updateSessionDetails(req, res, next);

    expect(sessionsServiceMock.updateSessionDetails).toHaveBeenCalledWith(
      'session-1',
      req.body,
      'manager-1',
      'managed-branch',
    );
    expect(sendSuccess).toHaveBeenCalledWith(res, { id: 'session-1' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects ADMIN_MANAGER for a session outside managed branches', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'other-branch',
    });
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue(null);

    const req = {
      params: { sessionId: 'session-1' },
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['managed-branch'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.getSessionById(req, res, next);

    expect(sendError).toHaveBeenCalledWith(
      res,
      403,
      'SESSION_BRANCH_ACCESS_DENIED',
      'Anda tidak memiliki akses ke sesi pada cabang ini'
    );
    expect(sessionsServiceMock.getSessionById).not.toHaveBeenCalled();
  });

  it('allows MEMBER_VIEW_ONLY manager assignments to read session data', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'managed-branch',
    });
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue({
      id: 'assignment-1',
      accessScope: 'MEMBER_VIEW_ONLY',
    });

    const req = {
      params: { sessionId: 'session-1' },
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['managed-branch'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.getSessionById(req, res, next);

    expect(sessionsServiceMock.getSessionById).toHaveBeenCalledWith('session-1');
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      { session: { sessionId: 'session-1' } },
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps MEMBER_VIEW_ONLY manager assignments read-only for session writes', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'managed-branch',
    });
    (prisma.managerBranch.findFirst as jest.Mock).mockResolvedValue({
      id: 'assignment-1',
      accessScope: 'MEMBER_VIEW_ONLY',
    });

    const req = {
      params: { sessionId: 'session-1' },
      body: { treatmentDate: '2026-08-20T05:00:00.000Z' },
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['managed-branch'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.updateSessionDetails(req, res, next);

    expect(sendError).toHaveBeenCalledWith(
      res,
      403,
      'SESSION_BRANCH_ACCESS_DENIED',
      'Akses Admin Manager pada cabang ini hanya untuk melihat data member',
    );
    expect(sessionsServiceMock.updateSessionDetails).not.toHaveBeenCalled();
  });

  it('limits the ADMIN_MANAGER session list to assigned branches', async () => {
    (prisma.managerBranch.findMany as jest.Mock).mockResolvedValue([
      { branchId: 'managed-branch-1' },
      { branchId: 'managed-branch-2' },
    ]);
    sessionsServiceMock.getAllSessions.mockResolvedValue([]);

    const req = {
      query: {},
      user: {
        userId: 'manager-1',
        role: Role.ADMIN_MANAGER,
        branchId: null,
        branches: ['managed-branch-1', 'managed-branch-2'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.getAllSessions(req, res, next);

    expect(sessionsServiceMock.getAllSessions).toHaveBeenCalledWith(expect.objectContaining({
      role: Role.ADMIN_MANAGER,
      userId: 'manager-1',
      branchIds: ['managed-branch-1', 'managed-branch-2'],
    }));
    expect(sendSuccess).toHaveBeenCalledWith(res, []);
  });

  it('allows an assigned DOCTOR to edit the session therapy plan set', async () => {
    (prisma.treatmentSession.findUnique as jest.Mock).mockResolvedValue({
      branchId: 'doctor-branch',
    });
    sessionsServiceMock.updateTherapyPlanSetForSession.mockResolvedValue({
      success: true,
      data: { version: 2 },
    });

    const req = {
      params: { sessionId: 'session-1' },
      body: {
        plans: [{ planNumber: 1, ifa250: 1 }],
      },
      user: {
        userId: 'doctor-1',
        role: Role.DOCTOR,
        branchId: 'doctor-branch',
        branches: ['doctor-branch'],
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await controller.updateTherapyPlanSet(req, res, next);

    expect(sessionsServiceMock.updateTherapyPlanSetForSession).toHaveBeenCalledWith(
      'session-1',
      req.body,
      'doctor-1'
    );
    expect(sendSuccess).toHaveBeenCalledWith(res, {
      success: true,
      data: { version: 2 },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
