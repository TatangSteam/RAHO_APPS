import { Request, Response, NextFunction } from 'express';
import { SessionsService } from './sessions.service';
import {
  createSessionSchema,
  createDiagnosisSchema,
  createTherapyPlanSchema,
  createVitalSignSchema,
  createInfusionSchema,
  createMaterialUsageSchema,
  createEvaluationSchema,
} from './sessions.schema';
import { sendSuccess, sendError } from '../../utils/response';

const sessionsService = new SessionsService();

export class SessionsController {
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

      const result = await sessionsService.createSession(validation.data, branchId, req.user!.userId);
      return sendSuccess(res, result, 201);
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
      const { memberId, page, limit } = req.query;
      
      const result = await sessionsService.getAllSessions({
        memberId: memberId as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
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
  // STEP 2: CREATE THERAPY PLAN
  // ============================================================

  async createTherapyPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = createTherapyPlanSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const result = await sessionsService.createTherapyPlan(sessionId, validation.data, req.user!.userId);
      return sendSuccess(res, result, 201);
    } catch (err: any) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
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

      const branchId = req.user!.branchId;
      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'User harus terikat dengan cabang');
      }

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
      const branchId = req.user!.branchId;
      
      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'User harus terikat dengan cabang');
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

      const branchId = req.user!.branchId;
      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'User harus terikat dengan cabang');
      }

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

      const branchId = req.user!.branchId;
      if (!branchId) {
        return sendError(res, 403, 'BRANCH_REQUIRED', 'User harus terikat dengan cabang');
      }

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
}
