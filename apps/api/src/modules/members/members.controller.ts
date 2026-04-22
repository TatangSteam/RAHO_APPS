import type { Request, Response, NextFunction } from 'express';
import { MembersService } from './members.service';
import {
  createMemberSchema,
  updateMemberSchema,
  grantAccessSchema,
  sendNotificationSchema,
} from './members.schema';
import { sendSuccess } from '../../utils/response';
import { Role } from '@prisma/client';

const membersService = new MembersService();

export class MembersController {
  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, page, limit } = req.query;
      const { branchId, role } = req.user!;

      const result = await membersService.getMembers(branchId, role as Role, {
        search: search as string,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async lookupMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberNo } = req.query;
      const { branchId, role } = req.user!;

      if (!memberNo) {
        throw { status: 400, code: 'VALIDATION_ERROR', message: 'Nomor member wajib diisi' };
      }

      const result = await membersService.lookupMember(memberNo as string, branchId, role as Role);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async grantAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = grantAccessSchema.parse(req.body);
      const { branchId, userId } = req.user!;

      if (!branchId) {
        throw {
          status: 403,
          code: 'BRANCH_REQUIRED',
          message: 'Hanya staff cabang yang bisa grant akses',
        };
      }

      const result = await membersService.grantAccess(validated.memberNo, branchId, userId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async createMember(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📥 Received request body:', req.body);
      console.log('📁 Received files:', req.files);
      
      const validated = createMemberSchema.parse(req.body);
      console.log('✅ Validation passed:', validated);
      
      const { branchId, userId } = req.user!;

      if (!branchId) {
        throw {
          status: 403,
          code: 'BRANCH_REQUIRED',
          message: 'Hanya staff cabang yang bisa mendaftarkan member',
        };
      }

      const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] };
      const files = {
        psp: filesObj?.['psp']?.[0],
        photo: filesObj?.['photo']?.[0],
      };

      const result = await membersService.createMember(
        validated as any, // Type assertion since schema validation ensures correct types
        files, 
        branchId, 
        userId
      );

      sendSuccess(res, result, 201);
    } catch (error) {
      console.error('❌ Create member error:', error);
      next(error);
    }
  }

  async getMemberById(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;

      const result = await membersService.getMemberById(memberId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const validated = updateMemberSchema.parse(req.body);
      const { userId } = req.user!;

      const result = await membersService.updateMember(memberId, validated, userId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async deleteMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { userId } = req.user!;

      const result = await membersService.deleteMember(memberId, userId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async sendNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const validated = sendNotificationSchema.parse(req.body);
      const { userId } = req.user!;

      const result = await membersService.sendNotification(
        memberId,
        validated.title,
        validated.message,
        userId
      );

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getMemberDiagnoses(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;

      const result = await membersService.getMemberDiagnoses(memberId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async createMemberDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { userId } = req.user!;

      const result = await membersService.createMemberDiagnosis(memberId, req.body, userId);

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // THERAPY PLAN METHODS
  // ============================================================

  async getMemberTherapyPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const therapyPlans = await membersService.getMemberTherapyPlans(memberId);
      return sendSuccess(res, therapyPlans);
    } catch (error) {
      next(error);
    }
  }

  async createMemberTherapyPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const userId = req.user!.userId;
      const result = await membersService.createMemberTherapyPlan(memberId, req.body, userId);
      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // INFUSION METHODS
  // ============================================================

  async getMemberInfusions(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const infusions = await membersService.getMemberInfusions(memberId);
      return sendSuccess(res, infusions);
    } catch (error) {
      next(error);
    }
  }

  // Get members by specific branch (for Admin Manager viewing branch details)
  async getMembersByBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;
      const { search, status, page, limit } = req.query;

      console.log('📊 getMembersByBranch called with branchId:', branchId);

      const result = await membersService.getMembersByBranch(branchId, {
        search: search as string,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      console.log('✅ Found members:', result.members.length);

      sendSuccess(res, result);
    } catch (error) {
      console.error('❌ Error in getMembersByBranch:', error);
      next(error);
    }
  }
}
