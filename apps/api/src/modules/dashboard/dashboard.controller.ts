import { Request, Response, NextFunction } from 'express';
import {
  getStaffDashboardService,
  getAdminCabangDashboardService,
  getAdminManagerDashboardService,
  getSuperAdminDashboardService,
} from './dashboard.service';
import { sendSuccess } from '@utils/response';

// ── Staff Dashboard (ADMIN_LAYANAN, DOCTOR, NURSE) ───────────────────────

export async function getStaffDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const branchId = req.user.branchId!;

    const data = await getStaffDashboardService(branchId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// ── Admin Cabang Dashboard ──────────────────────────────────────────────

export async function getAdminCabangDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const branchId = req.user.branchId!;

    const data = await getAdminCabangDashboardService(branchId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// ── Admin Manager Dashboard ─────────────────────────────────────────────

export async function getAdminManagerDashboard(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getAdminManagerDashboardService();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// ── Super Admin Dashboard ───────────────────────────────────────────────

export async function getSuperAdminDashboard(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getSuperAdminDashboardService();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}