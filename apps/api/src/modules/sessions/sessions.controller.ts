import { Request, Response, NextFunction } from 'express';
import { SessionsService } from './sessions.service';
import {
  createSessionSchema,
  createDiagnosisSchema,
  updateDiagnosisSchema,
  createVitalSignSchema,
  createInfusionSchema,
  createMaterialUsageSchema,
  createEvaluationSchema,
} from './sessions.schema';
import { sendSuccess, sendError } from '../../utils/response';
import { SessionExportService } from './services/session-export.service';
import { SupportingPhotosService } from './services/supporting-photos.service';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const sessionsService = new SessionsService();
const exportService = new SessionExportService();
const supportingPhotosService = new SupportingPhotosService();

export class SessionsController {
  private async getAuthorizedSessionBranchId(
    sessionId: string,
    user: Request['user']
  ): Promise<string> {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: { branchId: true },
    });

    if (!session) {
      throw {
        status: 404,
        code: 'SESSION_NOT_FOUND',
        message: 'Sesi tidak ditemukan',
      };
    }

    if (user.role === Role.SUPER_ADMIN) {
      return session.branchId;
    }

    const accessibleBranchIds = new Set([
      ...(user.branchId ? [user.branchId] : []),
      ...(user.branches || []),
    ]);

    if (!accessibleBranchIds.has(session.branchId)) {
      throw {
        status: 403,
        code: 'SESSION_BRANCH_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses ke sesi pada cabang ini',
      };
    }

    return session.branchId;
  }

  // ============================================================
  // CREATE SESSION
  // ============================================================

  async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const validation = createSessionSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const branchId = req.user!.branchId;
      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'User harus terikat dengan cabang');
      }

      const result = await sessionsService.createSession(
        validation.data, 
        branchId, 
        req.user!.userId,
        req.user!.role // Pass user role for auto-fill logic
      );
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getSuggestedSessionNumbers(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const branchId = req.user!.branchId;
      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'User harus terikat dengan cabang');
      }

      const result = await sessionsService.getSuggestedSessionNumbers(memberId, branchId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // GET SESSION DETAIL
  // ============================================================

  async getSessionById(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      const result = await sessionsService.getSessionById(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // GET ALL SESSIONS (with optional filters)
  // ============================================================

  async getAllSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        memberId, 
        page, 
        limit,
        branchId: filterBranchId,
        doctorId,
        nurseId,
        dateFrom,
        dateTo,
        status,
        pelaksanaan,
      } = req.query;
      const { userId, branchId, role } = req.user!;
      
      // For SUPER_ADMIN and ADMIN_MANAGER, don't filter by branch unless explicitly requested
      // This allows them to see sessions across all branches
      let effectiveBranchId: string | undefined = undefined;
      if (filterBranchId) {
        effectiveBranchId = filterBranchId as string;
      } else if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN_MANAGER) {
        effectiveBranchId = branchId || undefined;
      }
      
      const result = await sessionsService.getAllSessions({
        memberId: memberId as string | undefined,
        branchId: effectiveBranchId,
        role: role as string,
        userId, // Pass userId for DOCTOR/NURSE multi-branch support
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        // Additional filters
        doctorId: doctorId as string | undefined,
        nurseId: nurseId as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        status: status as string | undefined,
        pelaksanaan: pelaksanaan as string | undefined,
      });
      
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 1: CREATE DIAGNOSIS
  // ============================================================

  async createDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const { encounterId } = req.params;
      const validation = createDiagnosisSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const result = await sessionsService.createDiagnosis(encounterId, validation.data, req.user!.userId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // GET DIAGNOSIS BY ENCOUNTER
  // ============================================================

  async getDiagnosisByEncounter(req: Request, res: Response, next: NextFunction) {
    try {
      const { encounterId } = req.params;
      const diagnosis = await sessionsService.getDiagnosisByEncounter(encounterId);
      return sendSuccess(res, diagnosis);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // UPDATE DIAGNOSIS
  // ============================================================

  async updateDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const { encounterId } = req.params;
      const validation = updateDiagnosisSchema.safeParse(req.body);

      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const result = await sessionsService.updateDiagnosis(encounterId, validation.data, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 2: CREATE THERAPY PLAN
  // ============================================================

  async createTherapyPlan(_req: Request, res: Response, _next: NextFunction) {
    return sendError(
      res,
      410,
      'THERAPY_PLAN_BULK_ONLY',
      'Therapy plan sesi hanya sebagai acuan dari set bulk. Pilih therapy plan saat membuat sesi, bukan membuat therapy plan baru di dalam sesi.'
    );
  }

  // ============================================================
  // GET THERAPY PLAN
  // ============================================================

  async getTherapyPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getTherapyPlan(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getTherapyPlanSet(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      const result = await sessionsService.getTherapyPlanSetForSession(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async updateTherapyPlanSet(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      const result = await sessionsService.updateTherapyPlanSetForSession(
        sessionId,
        req.body,
        req.user!.userId
      );
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 4: UPDATE BOOSTER TYPE (Conditional)
  // ============================================================

  async updateBoosterType(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const { boosterType } = req.body;

      if (!boosterType || !['NO2', 'HHO'].includes(boosterType)) {
        return sendError(res, 400, 'INVALID_BOOSTER_TYPE', 'Jenis booster harus NO2 atau HHO');
      }

      const branchId = await this.getAuthorizedSessionBranchId(sessionId, req.user!);

      const result = await sessionsService.updateBoosterType(sessionId, boosterType, req.user!.userId, branchId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getBoosterStockAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const branchId = sessionId
        ? await this.getAuthorizedSessionBranchId(sessionId, req.user!)
        : req.user!.branchId;

      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'Cabang sesi tidak ditemukan');
      }

      const availability = await sessionsService.getBoosterStockAvailability(branchId);
      return sendSuccess(res, availability);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 3 & 8: UPSERT VITAL SIGN
  // ============================================================

  async upsertVitalSign(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = createVitalSignSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const result = await sessionsService.upsertVitalSign(sessionId, validation.data, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // GET VITAL SIGNS
  // ============================================================

  async getVitalSigns(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getVitalSigns(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 4: CREATE INFUSION
  // ============================================================

  async createInfusion(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = createInfusionSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const branchId = await this.getAuthorizedSessionBranchId(sessionId, req.user!);

      const result = await sessionsService.createInfusion(sessionId, validation.data, req.user!.userId, branchId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // GET INFUSION
  // ============================================================

  async getInfusion(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getInfusion(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 5: MATERIAL USAGE
  // ============================================================

  async createMaterialUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = createMaterialUsageSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const branchId = await this.getAuthorizedSessionBranchId(sessionId, req.user!);

      const result = await sessionsService.createMaterialUsage(sessionId, validation.data, req.user!.userId, branchId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getMaterialUsages(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getMaterialUsages(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 8: DOCTOR EVALUATION
  // ============================================================

  async createEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = createEvaluationSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const result = await sessionsService.createEvaluation(sessionId, validation.data, req.user!.userId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async updateEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      
      // Check branch access for SUPER_ADMIN, ADMIN_MANAGER, and DOCTOR
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      
      const validation = createEvaluationSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const result = await sessionsService.updateEvaluation(sessionId, validation.data, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getEvaluation(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // COMPLETE SESSION
  // ============================================================

  async completeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.completeSession(sessionId, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message, err.errors);
      }
      next(err);
    }
  }

  // ============================================================
  // SAVE PROGRESS (NEW)
  // ============================================================

  async saveProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.saveProgress(sessionId, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // GET SESSION PROGRESS (NEW)
  // ============================================================

  async getSessionProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getSessionProgress(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // STEP 7: PHOTO UPLOAD
  // ============================================================

  async uploadPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      
      if (!req.file) {
        return sendError(res, 400, 'FILE_REQUIRED', 'File foto harus disertakan');
      }

      const uploadedBy = req.user!.userId;
      const result = await sessionsService.uploadPhoto(sessionId, req.file, uploadedBy);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async deletePhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.deletePhoto(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await sessionsService.getPhoto(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  // ============================================================
  // EXPORT SESSIONS
  // ============================================================

  async exportSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { format = 'xlsx', groupBy = 'none' } = req.query;
      const { userId, branchId, role } = req.user!;
      
      const fields = req.body.fields || {
        basicInfo: true,
        memberInfo: true,
        staffInfo: false,
        vitalSigns: false,
        therapyPlan: false,
        infusion: false,
        materials: false,
        evaluation: false,
      };

      const filters = req.body.filters || {};

      const data = await exportService.exportSessions(userId, role as Role, branchId, {
        fields,
        format: format as 'csv' | 'json' | 'xlsx',
        filters,
        groupBy: groupBy as 'date' | 'member' | 'doctor' | 'none',
      });

      if (format === 'csv') {
        const csv = exportService.generateCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=sessions-${Date.now()}.csv`);
        res.send(csv);
      } else if (format === 'xlsx') {
        const buffer = await exportService.generateXLSX(data, groupBy as string);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename=sessions-${Date.now()}.xlsx`);
        res.send(buffer);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=sessions-${Date.now()}.json`);
        res.json(data);
      }
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // STEP 7: SUPPORTING PHOTOS (MULTIPLE)
  // ============================================================

  async uploadSupportingPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const { description } = req.body;

      if (!req.file) {
        return sendError(res, 400, 'FILE_REQUIRED', 'File foto penunjang harus disertakan');
      }

      const result = await supportingPhotosService.uploadSupportingPhoto(sessionId, {
        file: req.file,
        description,
        uploadedBy: req.user!.userId,
      });

      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getSupportingPhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const result = await supportingPhotosService.getSupportingPhotosBySession(sessionId);
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async deleteSupportingPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { photoId } = req.params;
      await supportingPhotosService.deleteSupportingPhoto(photoId, req.user!.userId);
      return sendSuccess(res, { message: 'Foto penunjang berhasil dihapus' });
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async updateSupportingPhotoDescription(req: Request, res: Response, next: NextFunction) {
    try {
      const { photoId } = req.params;
      const { description } = req.body;

      if (description === undefined) {
        return sendError(res, 400, 'DESCRIPTION_REQUIRED', 'Keterangan foto harus disertakan');
      }

      const result = await supportingPhotosService.updateSupportingPhotoDescription(
        photoId,
        description
      );
      return sendSuccess(res, result);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }
}
