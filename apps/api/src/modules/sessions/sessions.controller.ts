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
  updateSessionDetailsSchema,
  updateSessionBoosterPackageSchema,
  completeSessionSchema,
  cancelSessionCompletionSchema,
  saveSessionProgressSchema,
  type CreateSessionInput,
} from './sessions.schema';
import { sendSuccess, sendError } from '../../utils/response';
import { SessionExportService } from './services/session-export.service';
import { SupportingPhotosService } from './services/supporting-photos.service';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getSessionMaterialRecommendations } from '@modules/inventory/services/treatment-bom.service';
import { WorkflowBurdenService } from './services/workflow-burden.service';

const sessionsService = new SessionsService();
const exportService = new SessionExportService();
const supportingPhotosService = new SupportingPhotosService();
const workflowBurdenService = new WorkflowBurdenService();

const parseQueryIdList = (value: unknown): string[] | undefined => {
  if (!value) return undefined;

  const rawValues = Array.isArray(value) ? value : [value];
  const ids = rawValues
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim())
    .filter((item) => item && item !== 'all');

  return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
};

export class SessionsController {
  async getWorkflowBurden(req: Request, res: Response, next: NextFunction) {
    try {
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : new Date();
      const dateFrom = req.query.dateFrom
        ? new Date(String(req.query.dateFrom))
        : new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime()) || dateFrom > dateTo) {
        return sendError(res, 400, 'INVALID_REPORT_PERIOD', 'Periode audit tidak valid');
      }
      const result = await workflowBurdenService.getReport({
        branchId: typeof req.query.branchId === 'string' ? req.query.branchId : undefined,
        dateFrom,
        dateTo,
      });
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) return sendError(res, err.status, err.code, err.message);
      next(err);
    }
  }

  private async assertEvaluationWriteAccess(
    sessionId: string,
    user: Request['user'],
    data: Record<string, unknown>,
  ) {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: {
        adminLayananId: true,
        doctorId: true,
        nurseId: true,
        sessionDoctors: { where: { doctorId: user.userId }, select: { id: true } },
        sessionNurses: { where: { nurseId: user.userId }, select: { id: true } },
        encounter: { select: { diagnoses: { take: 1, select: { id: true } } } },
        therapyPlan: { select: { id: true } },
        vitalSigns: { select: { waktuCatat: true } },
        infusion: { select: { id: true } },
        materials: { take: 1, select: { id: true } },
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    const doctorFieldNames = ['subjective', 'objective', 'assessment', 'plan', 'generalNotes'];
    const writesDoctorEvaluation = doctorFieldNames.some((field) => Object.prototype.hasOwnProperty.call(data, field));

    if (writesDoctorEvaluation) {
      if (user.role !== Role.DOCTOR) {
        throw {
          status: 403,
          code: 'DOCTOR_EVALUATION_ROLE_REQUIRED',
          message: 'Evaluasi dokter hanya dapat diisi oleh dokter yang ditugaskan',
        };
      }

      const isAssignedDoctor = session.doctorId === user.userId || session.sessionDoctors.length > 0;
      if (!isAssignedDoctor) {
        throw {
          status: 403,
          code: 'DOCTOR_NOT_ASSIGNED',
          message: 'Anda bukan dokter yang ditugaskan pada sesi ini',
        };
      }

      const prerequisitesReady =
        session.encounter.diagnoses.length > 0 &&
        Boolean(session.therapyPlan) &&
        session.vitalSigns.some((vital) => vital.waktuCatat === 'SEBELUM') &&
        Boolean(session.infusion) &&
        session.materials.length > 0 &&
        session.vitalSigns.some((vital) => vital.waktuCatat === 'SESUDAH');

      if (!prerequisitesReady) {
        throw {
          status: 409,
          code: 'DOCTOR_EVALUATION_NOT_READY',
          message: 'Evaluasi dokter belum dapat diisi karena tahap sebelumnya belum lengkap',
        };
      }

      return;
    }

    if (user.role === Role.ADMIN_LAYANAN && session.adminLayananId !== user.userId) {
      throw { status: 403, code: 'SESSION_NOT_ASSIGNED', message: 'Sesi ini tidak ditugaskan kepada Anda' };
    }

    if (
      user.role === Role.NURSE &&
      session.nurseId !== user.userId &&
      session.sessionNurses.length === 0
    ) {
      throw { status: 403, code: 'SESSION_NOT_ASSIGNED', message: 'Sesi ini tidak ditugaskan kepada Anda' };
    }
  }

  private async assertManagerCanAccessBranch(userId: string, branchId: string) {
    const managedBranch = await prisma.managerBranch.findFirst({
      where: {
        userId,
        branchId,
        branch: { isActive: true },
      },
      select: { id: true, accessScope: true },
    });

    if (!managedBranch || managedBranch.accessScope === 'MEMBER_VIEW_ONLY') {
      throw {
        status: 403,
        code: 'SESSION_BRANCH_ACCESS_DENIED',
        message: managedBranch
          ? 'Akses Admin Manager pada cabang ini hanya untuk melihat data member'
          : 'Anda tidak memiliki akses ke sesi pada cabang ini',
      };
    }
  }

  private async resolveCreateSessionBranchId(
    data: CreateSessionInput,
    user: Request['user']
  ): Promise<string> {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN_MANAGER) {
      if (!user.branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'User harus terikat dengan cabang' };
      }

      return user.branchId;
    }

    let branchId = data.branchId || user.branchId || undefined;

    if (!branchId) {
      const memberPackage = await prisma.memberPackage.findFirst({
        where: {
          id: data.memberPackageId,
          memberId: data.memberId,
        },
        select: { branchId: true },
      });
      branchId = memberPackage?.branchId;
    }

    if (!branchId) {
      throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Cabang sesi harus dipilih' };
    }

    if (user.role === Role.ADMIN_MANAGER) {
      await this.assertManagerCanAccessBranch(user.userId, branchId);
    }

    return branchId;
  }

  private async resolveSuggestedSessionBranchId(
    memberId: string,
    requestedBranchId: unknown,
    user: Request['user']
  ): Promise<string> {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN_MANAGER) {
      if (!user.branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'User harus terikat dengan cabang' };
      }

      return user.branchId;
    }

    let branchId = typeof requestedBranchId === 'string' && requestedBranchId
      ? requestedBranchId
      : user.branchId || undefined;

    if (!branchId) {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { registrationBranchId: true },
      });
      branchId = member?.registrationBranchId;
    }

    if (!branchId) {
      throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Cabang sesi harus dipilih' };
    }

    if (user.role === Role.ADMIN_MANAGER) {
      await this.assertManagerCanAccessBranch(user.userId, branchId);
    }

    return branchId;
  }

  private async getAuthorizedSessionBranchId(
    sessionId: string,
    user: Request['user']
  ): Promise<string> {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      select: {
        branchId: true,
        adminLayananId: true,
        doctorId: true,
        nurseId: true,
        sessionDoctors: { where: { doctorId: user.userId }, select: { id: true } },
        sessionNurses: { where: { nurseId: user.userId }, select: { id: true } },
      },
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

    if (user.role === Role.ADMIN_MANAGER) {
      await this.assertManagerCanAccessBranch(user.userId, session.branchId);
      return session.branchId;
    }

    const isAssigned =
      (user.role === Role.ADMIN_LAYANAN && session.adminLayananId === user.userId) ||
      (user.role === Role.DOCTOR && (session.doctorId === user.userId || (session.sessionDoctors?.length ?? 0) > 0)) ||
      (user.role === Role.NURSE && (session.nurseId === user.userId || (session.sessionNurses?.length ?? 0) > 0));

    if (isAssigned) {
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

  private async getAuthorizedEncounterBranchId(
    encounterId: string,
    user: Request['user']
  ): Promise<string> {
    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { branchId: true },
    });

    if (!encounter) {
      throw {
        status: 404,
        code: 'ENCOUNTER_NOT_FOUND',
        message: 'Encounter tidak ditemukan',
      };
    }

    if (user.role === Role.SUPER_ADMIN) {
      return encounter.branchId;
    }

    if (user.role === Role.ADMIN_MANAGER) {
      await this.assertManagerCanAccessBranch(user.userId, encounter.branchId);
      return encounter.branchId;
    }

    const accessibleBranchIds = new Set([
      ...(user.branchId ? [user.branchId] : []),
      ...(user.branches || []),
    ]);

    if (!accessibleBranchIds.has(encounter.branchId)) {
      let assignmentFilter: Prisma.TreatmentSessionWhereInput | null = null;
      if (user.role === Role.ADMIN_LAYANAN) {
        assignmentFilter = { adminLayananId: user.userId };
      } else if (user.role === Role.DOCTOR) {
        assignmentFilter = {
          OR: [
            { doctorId: user.userId },
            { sessionDoctors: { some: { doctorId: user.userId } } },
          ],
        };
      } else if (user.role === Role.NURSE) {
        assignmentFilter = {
          OR: [
            { nurseId: user.userId },
            { sessionNurses: { some: { nurseId: user.userId } } },
          ],
        };
      }

      if (assignmentFilter) {
        const assignedSession = await prisma.treatmentSession.findFirst({
          where: { encounterId, AND: [assignmentFilter] },
          select: { id: true },
        });
        if (assignedSession) return encounter.branchId;
      }

      throw {
        status: 403,
        code: 'SESSION_BRANCH_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses ke encounter pada cabang ini',
      };
    }

    return encounter.branchId;
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

      const branchId = await this.resolveCreateSessionBranchId(validation.data, req.user!);

      const result = await sessionsService.createSession(
        validation.data, 
        branchId, 
        req.user!.userId,
        req.user!.role // Pass user role for auto-fill logic
      );
      return sendSuccess(res, result, 201);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getSuggestedSessionNumbers(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const branchId = await this.resolveSuggestedSessionBranchId(memberId, req.query.branchId, req.user!);

      const result = await sessionsService.getSuggestedSessionNumbers(memberId, branchId);
      return sendSuccess(res, result);
    } catch (err) {
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
    } catch (err) {
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
        branchIds: filterBranchIds,
        diagnosisCategories: filterDiagnosisCategories,
        doctorId,
        doctorIds,
        nurseId,
        nurseIds,
        dateFrom,
        dateTo,
        status,
        pelaksanaan,
        assignedToMe,
      } = req.query;
      const { userId, branchId, role } = req.user!;
      
      // For SUPER_ADMIN and ADMIN_MANAGER, support multiple branch selection
      let effectiveBranchIds: string[] | undefined = undefined;
      
      if (filterBranchIds) {
        // Handle multiple branchIds (comma-separated string or array)
        if (typeof filterBranchIds === 'string') {
          effectiveBranchIds = filterBranchIds.split(',').filter(Boolean);
        } else if (Array.isArray(filterBranchIds)) {
          effectiveBranchIds = (filterBranchIds as string[]).filter(id => typeof id === 'string' && id.trim());
        }
      } else if (filterBranchId) {
        // Backward compatibility: single branchId
        effectiveBranchIds = [filterBranchId as string];
      } else if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN_MANAGER) {
        // Non-admin roles: use their assigned branch
        if (branchId) {
          effectiveBranchIds = [branchId];
        }
      }
      // For SUPER_ADMIN/ADMIN_MANAGER without filter: effectiveBranchIds stays undefined (see all)
      
      // Parse diagnosis categories filter (comma-separated string to array)
      let effectiveDiagnosisCategories: string[] | undefined = undefined;
      if (filterDiagnosisCategories) {
        if (typeof filterDiagnosisCategories === 'string') {
          effectiveDiagnosisCategories = filterDiagnosisCategories.split(',').filter(Boolean);
        } else if (Array.isArray(filterDiagnosisCategories)) {
          effectiveDiagnosisCategories = (filterDiagnosisCategories as string[]).filter(cat => typeof cat === 'string' && cat.trim());
        }
      }

      const effectiveDoctorIds = parseQueryIdList(doctorIds) ?? parseQueryIdList(doctorId);
      const effectiveNurseIds = parseQueryIdList(nurseIds) ?? parseQueryIdList(nurseId);
      
      const result = await sessionsService.getAllSessions({
        memberId: memberId as string | undefined,
        branchId: effectiveBranchIds?.length === 1 ? effectiveBranchIds[0] : undefined,
        branchIds: effectiveBranchIds,
        diagnosisCategories: effectiveDiagnosisCategories,
        role: role as string,
        userId, // Pass userId for DOCTOR/NURSE multi-branch support
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        // Additional filters
        doctorId: doctorId as string | undefined,
        doctorIds: effectiveDoctorIds,
        nurseId: nurseId as string | undefined,
        nurseIds: effectiveNurseIds,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        status: status as string | undefined,
        pelaksanaan: pelaksanaan as string | undefined,
        assignedToMe: assignedToMe === 'true',
      });
      
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async deleteSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      const result = await sessionsService.deleteSession(sessionId, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async updateSessionDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = updateSessionDetailsSchema.safeParse(req.body);

      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const branchId = await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      const result = await sessionsService.updateSessionDetails(
        sessionId,
        validation.data,
        req.user!.userId,
        branchId
      );

      return sendSuccess(res, result);
    } catch (err) {
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

      await this.getAuthorizedEncounterBranchId(encounterId, req.user!);

      const result = await sessionsService.createDiagnosis(encounterId, validation.data, req.user!.userId);
      return sendSuccess(res, result, 201);
    } catch (err) {
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
      await this.getAuthorizedEncounterBranchId(encounterId, req.user!);
      const diagnosis = await sessionsService.getDiagnosisByEncounter(encounterId);
      return sendSuccess(res, diagnosis);
    } catch (err) {
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

      await this.getAuthorizedEncounterBranchId(encounterId, req.user!);

      const result = await sessionsService.updateDiagnosis(encounterId, validation.data, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async deleteDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const { encounterId } = req.params;
      await this.getAuthorizedEncounterBranchId(encounterId, req.user!);

      const result = await sessionsService.deleteDiagnosis(encounterId, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async updateSessionBoosterPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const validation = updateSessionBoosterPackageSchema.safeParse(req.body);

      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data tidak valid', validation.error.errors);
      }

      const branchId = await this.getAuthorizedSessionBranchId(sessionId, req.user!);

      const result = await sessionsService.updateSessionBoosterPackage(
        sessionId,
        validation.data,
        req.user!.userId,
        branchId,
      );
      return sendSuccess(res, result);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async getMaterialUsages(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      const result = await sessionsService.getMaterialUsages(sessionId);
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async deleteMaterialUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, usageId } = req.params;
      const branchId = await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      return sendSuccess(
        res,
        await sessionsService.deleteMaterialUsage(sessionId, usageId, req.user!.userId, branchId),
      );
    } catch (err) {
      if (err.status) return sendError(res, err.status, err.code, err.message);
      next(err);
    }
  }

  async getMaterialRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      return sendSuccess(res, await getSessionMaterialRecommendations(req.user!.userId, sessionId));
    } catch (err) {
      if (err.status) return sendError(res, err.status, err.code, err.message);
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

      await this.getAuthorizedSessionBranchId(sessionId, req.user!);
      await this.assertEvaluationWriteAccess(sessionId, req.user!, validation.data);
      const result = await sessionsService.createEvaluation(sessionId, validation.data, req.user!.userId);
      return sendSuccess(res, result, 201);
    } catch (err) {
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

      await this.assertEvaluationWriteAccess(sessionId, req.user!, validation.data);
      const result = await sessionsService.updateEvaluation(sessionId, validation.data, req.user!.userId);
      return sendSuccess(res, result);
    } catch (err) {
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
    } catch (err) {
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
      const input = completeSessionSchema.parse(req.body ?? {});
      const result = await sessionsService.completeSession(sessionId, req.user!.userId, input);
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message, err.errors);
      }
      next(err);
    }
  }

  async getUnfinishedSessionReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, role, branchId } = req.user!;
      const result = await sessionsService.getUnfinishedSessionReminders({
        userId,
        role: role as Role,
        branchId: branchId || null,
      });
      return sendSuccess(res, result);
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }

  async cancelCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const input = cancelSessionCompletionSchema.parse(req.body);
      if (
        input.reopenForEditing
        && req.user!.role !== Role.SUPER_ADMIN
        && req.user!.role !== Role.ADMIN_MANAGER
      ) {
        return sendError(
          res,
          403,
          'SESSION_REOPEN_FORBIDDEN',
          'Hanya Super Admin atau Admin Manager yang dapat membuka kembali sesi posted untuk diedit.',
        );
      }
      const result = await sessionsService.cancelCompletion(sessionId, req.user!.userId, input);
      return sendSuccess(res, result);
    } catch (err) {
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
      const validation = saveSessionProgressSchema.safeParse(req.body ?? {});
      if (!validation.success) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Data progress tidak valid', validation.error.errors);
      }
      const result = await sessionsService.saveProgress(sessionId, req.user!.userId, validation.data);
      return sendSuccess(res, result);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        staffInfo: true,
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      if (err.status) {
        return sendError(res, err.status, err.code, err.message);
      }
      next(err);
    }
  }
}
