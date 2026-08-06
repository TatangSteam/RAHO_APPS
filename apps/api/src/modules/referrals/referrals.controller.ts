import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@utils/response';
import * as referralService from './referrals.service';
import {
  createReferralSchema,
  updateReferralSchema,
  listReferralsQuerySchema,
} from './referrals.schema';
import {
  exportIncentivesToExcel,
  exportIncentivesToPDF,
  exportReferralSummaryExcel,
  type ExportFilters,
} from './referral-export.service';
import { logger } from '@lib/logger';

function parseReferrerType(value: unknown): ExportFilters['referrerType'] {
  return value === 'SALES' || value === 'DOKTER' || value === 'MEMBER'
    ? value
    : undefined;
}

export class ReferralsController {
  // GET /api/v1/referrals - List referrals
  async listReferrals(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listReferralsQuerySchema.parse(req.query);
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const userBranchId = req.user?.branchId;

      logger.debug('[Referrals] listReferrals request', {
        userId,
        userRole,
        userBranchId,
      });

      const result = await referralService.listReferralsService(
        query,
        userId,
        userRole,
        userBranchId
      );

      return sendSuccess(res, result);
    } catch (error) {
      logger.error('[Referrals] listReferrals failed', { error });
      next(error);
    }
  }

  // GET /api/v1/referrals/active - Get active referrals (for dropdown)
  async getActiveReferrals(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.query.branchId as string | undefined;
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const userBranchId = req.user?.branchId;

      const referrals = await referralService.getActiveReferralsService(
        branchId,
        userId,
        userRole,
        userBranchId
      );

      return sendSuccess(res, referrals);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/referrals/:referralId - Get referral by ID
  async getReferralById(req: Request, res: Response, next: NextFunction) {
    try {
      const { referralId } = req.params;
      const referral = await referralService.getReferralByIdService(referralId);

      return sendSuccess(res, referral);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/referrals/:referralId/incentives - Get referral incentive records
  async getReferralIncentives(req: Request, res: Response, next: NextFunction) {
    try {
      const { referralId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await referralService.getReferralIncentiveRecordsService(
        referralId,
        page,
        limit
      );

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/referrals - Create referral
  async createReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createReferralSchema.parse(req.body);
      const referral = await referralService.createReferralService(input);

      return sendSuccess(res, referral, 201);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/v1/referrals/:referralId - Update referral
  async updateReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const { referralId } = req.params;
      const input = updateReferralSchema.parse(req.body);

      const referral = await referralService.updateReferralService(referralId, input);

      return sendSuccess(res, referral);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/v1/referrals/:referralId - Delete referral (soft delete)
  async deleteReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const { referralId } = req.params;
      const result = await referralService.deleteReferralService(referralId);

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/referrals/export/excel - Export incentives to Excel
  async exportIncentivesExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: ExportFilters = {};

      if (req.query.referralId) filters.referralId = req.query.referralId as string;
      if (req.query.branchId) filters.branchId = req.query.branchId as string;
      filters.referrerType = parseReferrerType(req.query.referrerType);
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      await exportIncentivesToExcel(filters, res);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/referrals/export/pdf - Export incentives to PDF
  async exportIncentivesPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: ExportFilters = {};

      if (req.query.referralId) filters.referralId = req.query.referralId as string;
      if (req.query.branchId) filters.branchId = req.query.branchId as string;
      filters.referrerType = parseReferrerType(req.query.referrerType);
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      await exportIncentivesToPDF(filters, res);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/referrals/export/summary - Export summary per referral to Excel
  async exportSummaryExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: ExportFilters = {};

      if (req.query.branchId) filters.branchId = req.query.branchId as string;
      if (
        req.query.referrerType === 'SALES' ||
        req.query.referrerType === 'DOKTER' ||
        req.query.referrerType === 'MEMBER'
      ) {
        filters.referrerType = req.query.referrerType;
      }

      await exportReferralSummaryExcel(filters, res);
    } catch (error) {
      next(error);
    }
  }
}
