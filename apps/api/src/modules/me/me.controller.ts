import { Request, Response, NextFunction } from 'express';
import {
  getMemberDashboardService,
  getMemberSessionsService,
  getMemberSessionDetailService,
  getMemberDiagnosesService,
  getMemberPackagesService,
  getMemberProfileService,
  getMemberInvoicesService,
  getMemberInvoiceDetailService,
  uploadPaymentProofService,
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
    throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Data member tidak ditemukan.' };
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
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { data, total } = await getMemberSessionsService(memberId, page, limit);
    const meta = buildPaginationMeta(total, page, limit);

    sendSuccess(res, data, 200, meta);
  } catch (err) {
    next(err);
  }
}


// ── Member Session Detail (Read-Only) ──────────────────────────


export async function getMemberSessionDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const { sessionId } = req.params;

    const data = await getMemberSessionDetailService(memberId, sessionId);
    sendSuccess(res, data);
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


// ── Member Profile ─────────────────────────────────────────────


export async function getMemberProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Profile service menerima userId langsung — tidak perlu resolve memberId
    const data = await getMemberProfileService(req.user.userId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}


// ── Member Invoices ────────────────────────────────────────────


export async function getMemberInvoices(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { data, total } = await getMemberInvoicesService(memberId, page, limit);
    const meta = buildPaginationMeta(total, page, limit);

    sendSuccess(res, data, 200, meta);
  } catch (err) {
    next(err);
  }
}


// ── Member Invoice Detail ──────────────────────────────────────


export async function getMemberInvoiceDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const { invoiceId } = req.params;

    const data = await getMemberInvoiceDetailService(memberId, invoiceId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}


// ── Upload Payment Proof ───────────────────────────────────────


export async function uploadPaymentProof(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const memberId = await getMemberIdFromUserId(req.user.userId);
    const { packageId } = req.params;
    const file = req.file;

    if (!file) {
      throw { status: 400, code: 'FILE_REQUIRED', message: 'File bukti pembayaran diperlukan' };
    }

    const data = await uploadPaymentProofService(memberId, packageId, file);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}