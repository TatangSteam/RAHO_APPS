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
import { MemberExportService } from './services/member-export.service';
import { logAudit } from '../../utils/auditLog';
import { prisma } from '../../lib/prisma';

const membersService = new MembersService();
const exportService = new MemberExportService();

export class MembersController {
  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, branchCode, page, limit } = req.query;
      const { branchId, role, userId } = req.user!;

      const result = await membersService.getMembers(branchId, role as Role, {
        search: search as string,
        status: status as string,
        branchCode: branchCode as string,
        userId, // Pass userId for ADMIN_MANAGER
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
      const validated = createMemberSchema.parse(req.body);
      const { branchId: userBranchId, userId, role } = req.user!;

      // Determine which branchId to use
      let targetBranchId: string | null = null;
      
      // For ADMIN_MANAGER, must select a branch from their managed branches
      if (role === Role.ADMIN_MANAGER) {
        if (!validated.branchId) {
          throw {
            status: 400,
            code: 'BRANCH_SELECTION_REQUIRED',
            message: 'Pilih cabang terlebih dahulu',
          };
        }
        
        // Verify the manager has access to this branch
        const managerBranch = await prisma.managerBranch.findFirst({
          where: {
            userId,
            branchId: validated.branchId,
          },
        });
        
        if (!managerBranch) {
          throw {
            status: 403,
            code: 'BRANCH_ACCESS_DENIED',
            message: 'Anda tidak memiliki akses ke cabang ini',
          };
        }
        
        targetBranchId = validated.branchId;
      } else {
        // For other roles (ADMIN_CABANG, ADMIN_LAYANAN, etc.), use their assigned branch
        targetBranchId = userBranchId;
      }

      if (!targetBranchId) {
        throw {
          status: 403,
          code: 'BRANCH_REQUIRED',
          message: 'Hanya staff cabang yang bisa mendaftarkan member',
        };
      }

      console.log('🔍 [Controller] Content-Type:', req.headers['content-type']);
      console.log('🔍 [Controller] req.files:', req.files);
      console.log('🔍 [Controller] req.body keys:', Object.keys(req.body));
      console.log('🔍 [Controller] req.body.psp type:', typeof req.body.psp);
      console.log('🔍 [Controller] req.body.photo type:', typeof req.body.photo);
      console.log('🔍 [Controller] Target branchId:', targetBranchId);
      console.log('🔍 [Controller] User role:', role);

      const filesObj = req.files as { [fieldname: string]: Express.Multer.File[] };
      const files = {
        psp: filesObj?.['psp']?.[0],
        photo: filesObj?.['photo']?.[0],
      };

      console.log('🔍 [Controller] Extracted files:', {
        psp: files.psp ? `${files.psp.originalname} (${files.psp.size} bytes)` : 'not found',
        photo: files.photo ? `${files.photo.originalname} (${files.photo.size} bytes)` : 'not found',
      });

      const result = await membersService.createMember(
        validated as any, // Type assertion since schema validation ensures correct types
        files, 
        targetBranchId, 
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
      const { userId, role, branchId } = req.user!;
      
      console.log('🎯 [Members Controller] getMemberById called');
      console.log('  - memberId:', memberId);
      console.log('  - userId:', userId);
      console.log('  - role:', role);
      console.log('  - branchId:', branchId);
      console.time('getMemberById-controller');

      const result = await membersService.getMemberById(memberId);

      console.timeEnd('getMemberById-controller');
      console.log('✅ [Members Controller] Sending response');
      sendSuccess(res, result);
    } catch (error) {
      console.error('❌ [Members Controller] Error in getMemberById:', error);
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

  // ============================================================
  // CONSENT DOCUMENTS METHODS
  // ============================================================

  async getConsentDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const documents = await membersService.getConsentDocuments(memberId);
      
      // Audit log for successful document access
      // Using VERIFY action as closest semantic match for document access verification
      await logAudit({
        userId: req.user.userId,
        branchId: req.user.branchId,
        action: 'VERIFY',
        resource: 'MemberConsentDocuments',
        resourceId: memberId,
        meta: {
          documentCount: documents.documents.length,
          action: 'view_consent_documents_list',
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      sendSuccess(res, documents);
    } catch (error) {
      // Audit log for failed document access attempts
      await logAudit({
        userId: req.user?.userId || 'unknown',
        branchId: req.user?.branchId || null,
        action: 'VERIFY',
        resource: 'MemberConsentDocuments',
        resourceId: req.params.memberId,
        meta: {
          action: 'view_consent_documents_list',
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any)?.code || 'UNKNOWN_ERROR',
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      next(error);
    }
  }

  async getReferralIncentives(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const incentives = await membersService.getReferralIncentives(memberId);
      
      // Audit log for successful incentive access
      await logAudit({
        userId: req.user.userId,
        branchId: req.user.branchId,
        action: 'VERIFY',
        resource: 'MemberReferralIncentives',
        resourceId: memberId,
        meta: {
          recordCount: incentives.records.length,
          totalIncentive: incentives.totalIncentive,
          action: 'view_referral_incentives',
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      sendSuccess(res, incentives);
    } catch (error) {
      // Audit log for failed incentive access attempts
      await logAudit({
        userId: req.user?.userId || 'unknown',
        branchId: req.user?.branchId || null,
        action: 'VERIFY',
        resource: 'MemberReferralIncentives',
        resourceId: req.params.memberId,
        meta: {
          action: 'view_referral_incentives',
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any)?.code || 'UNKNOWN_ERROR',
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
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

  async exportMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, format = 'xlsx' } = req.query;
      const { userId, branchId, role } = req.user!;
      const fields = req.body.fields || {
        basicInfo: true,
        contactInfo: true,
        medicalInfo: false,
        packages: false,
        sessions: false,
        diagnosis: false,
      };

      const data = await exportService.exportMembers(userId, role as Role, branchId, {
        fields,
        format: format as 'csv' | 'json' | 'xlsx',
        search: search as string,
        status: status as string,
      });

      if (format === 'csv') {
        const csv = exportService.generateCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=members-${Date.now()}.csv`);
        res.send(csv);
      } else if (format === 'xlsx') {
        const buffer = await exportService.generateXLSX(data);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=members-${Date.now()}.xlsx`);
        res.send(buffer);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=members-${Date.now()}.json`);
        res.json(data);
      }
    } catch (error) {
      next(error);
    }
  }
}
