import { Request, Response, NextFunction } from 'express';
import {
  getMemberDashboardService,
  getMemberSessionsService,
  getMemberDiagnosesService,
  getMemberPackagesService,
} from './me.service';
import { sendSuccess, buildPaginationMeta } from '@utils/response';
import { prisma } from '@lib/prisma';

// ── Get Member ID from User ID ────────────────────────────────

async function getMemberIdFromUserId(userId: string): Promise<string> {
  const member = await prisma.member.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!member) {
    throw new Error('Member not found');
  }
  return member.id;
}

// ── Member Dashboard ───────────────────────────────────────────

export async function getMemberDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const data = await getMemberDashboardService(memberId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// ── Member Sessions ────────────────────────────────────────────

export async function getMemberSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { data, total } = await getMemberSessionsService(memberId, page, limit);
    const meta = buildPaginationMeta(total, page, limit);

    sendSuccess(res, data, 200, meta);
  } catch (err) {
    next(err);
  }
}

// ── Member Diagnoses ───────────────────────────────────────────

export async function getMemberDiagnoses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const data = await getMemberDiagnosesService(memberId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// ── Member Packages ────────────────────────────────────────────

export async function getMemberPackages(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const data = await getMemberPackagesService(memberId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}