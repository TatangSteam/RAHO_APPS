import type { Request, Response, NextFunction } from 'express';
import { MembersService } from './members.service';
import {
  createMemberSchema,
  updateMemberSchema,
  grantAccessSchema,
  sendNotificationSchema,
  memberUsernameSchema,
} from './members.schema';
import { sendSuccess } from '../../utils/response';
import { Role } from '@prisma/client';
import { MemberExportService } from './services/member-export.service';
import { MemberLabResultsService } from './services/member-lab-results.service';
import { MemberAccountImportService } from './services/member-account-import.service';
import { SupportingPhotosService } from '../sessions/services/supporting-photos.service';
import { logAudit } from '../../utils/auditLog';
import { prisma } from '../../lib/prisma';

const membersService = new MembersService();
const exportService = new MemberExportService();
const labResultsService = new MemberLabResultsService();
const accountImportService = new MemberAccountImportService();
const supportingPhotosService = new SupportingPhotosService();

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'UNKNOWN_ERROR';
}

export class MembersController {
  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, branchCode, page, limit } = req.query;
      const { branchId, role, userId } = req.user!;

      console.log('📊 [Members Controller] getMembers called');
      console.log('  - User:', { userId, role, branchId });
      console.log('  - Filters:', { search, status, branchCode, page, limit });

      const result = await membersService.getMembers(branchId, role as Role, {
        search: search as string,
        status: status as string,
        branchCode: branchCode as string,
        userId, // Pass userId for ADMIN_MANAGER
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      console.log('✅ [Members Controller] Found', result.members.length, 'members, total:', result.pagination.total);

      sendSuccess(res, result);
    } catch (error) {
      console.error('❌ [Members Controller] Error:', error);
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
      
      // SUPER_ADMIN and ADMIN_MANAGER create members for an explicitly
      // selected branch because neither role is tied to one branch account.
      if (role === Role.SUPER_ADMIN || role === Role.ADMIN_MANAGER) {
        if (!validated.branchId) {
          throw {
            status: 400,
            code: 'BRANCH_SELECTION_REQUIRED',
            message: 'Pilih cabang terlebih dahulu',
          };
        }

        if (role === Role.ADMIN_MANAGER) {
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
        } else {
          const branch = await prisma.branch.findFirst({
            where: {
              id: validated.branchId,
              isActive: true,
            },
            select: { id: true },
          });

          if (!branch) {
            throw {
              status: 404,
              code: 'BRANCH_NOT_FOUND',
              message: 'Cabang tidak ditemukan atau sudah tidak aktif',
            };
          }
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
        validated as Parameters<MembersService['createMember']>[0],
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
      const { userId, role } = req.user!;

      const result = await membersService.updateMember(memberId, validated, userId, role as Role);

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

  async updateMemberDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, diagnosisId } = req.params;
      const { userId } = req.user!;

      const result = await membersService.updateMemberDiagnosis(memberId, diagnosisId, req.body, userId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async deleteMemberDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, diagnosisId } = req.params;
      const { userId } = req.user!;

      const result = await membersService.deleteMemberDiagnosis(memberId, diagnosisId, userId);

      sendSuccess(res, result);
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

  async createMemberTherapyPlan(_req: Request, _res: Response, next: NextFunction) {
    next({
      status: 410,
      code: 'THERAPY_PLAN_BULK_ONLY',
      message: 'Therapy plan hanya bisa dibuat melalui bulk sebagai satu set. Gunakan endpoint /members/:memberId/therapy-plans/bulk.',
    });
  }

  // Bulk Therapy Plan Methods
  async getMemberPackageSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const summary = await membersService.getMemberPackageSummary(memberId);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  async bulkCreateTherapyPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const userId = req.user!.userId;
      const result = await membersService.bulkCreateTherapyPlans(memberId, req.body, userId);

      // Audit log
      await logAudit({
        userId,
        action: 'CREATE',
        resource: 'TherapyPlan',
        resourceId: memberId,
        meta: { 
          type: 'bulk_creation',
          count: result.data.created,
          details: `Bulk created therapy plan set with ${result.data.created} rows`
        },
      });

      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  // Edit Therapy Plan - creates a new version for the whole set
  async editTherapyPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, therapyPlanId } = req.params;
      const userId = req.user!.userId;
      const result = await membersService.editTherapyPlan(therapyPlanId, req.body, userId);

      await logAudit({
        userId,
        action: 'UPDATE',
        resource: 'TherapyPlanSet',
        resourceId: result.data.setId,
        meta: {
          type: 'therapy_plan_set_versioning',
          memberId,
          therapyPlanId,
          version: result.data.version,
          copiedPlans: result.data.copiedPlans,
          details: `Created therapy plan set version ${result.data.version}`,
        },
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Bulk Edit Therapy Plan Set (edit multiple plans at once, creates new set version)
  async bulkEditTherapyPlanSet(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, setId } = req.params;
      const userId = req.user!.userId;
      const result = await membersService.bulkEditTherapyPlanSet(setId, req.body, userId);

      await logAudit({
        userId,
        action: 'UPDATE',
        resource: 'TherapyPlanSet',
        resourceId: result.data.setId,
        meta: {
          type: 'therapy_plan_set_bulk_edit',
          memberId,
          originalSetId: result.data.originalSetId,
          version: result.data.version,
          totalPlans: result.data.totalPlans,
          editedPlans: result.data.editedPlans,
          details: `Bulk edited therapy plan set, created version ${result.data.version}`,
        },
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async deleteTherapyPlanSet(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, setId } = req.params;
      const userId = req.user!.userId;
      const result = await membersService.deleteTherapyPlanSet(memberId, setId, userId);

      await logAudit({
        userId,
        action: 'DELETE',
        resource: 'TherapyPlanSet',
        resourceId: setId,
        meta: {
          type: 'therapy_plan_set_delete',
          memberId,
          deletedPlans: result.data.deletedPlans,
          details: `Deleted unused therapy plan set with ${result.data.deletedPlans} plans`,
        },
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Get Therapy Plan History (all versions)
  async getTherapyPlanHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { therapyPlanId } = req.params;
      const result = await membersService.getTherapyPlanHistory(therapyPlanId);
      return sendSuccess(res, result);
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
          errorCode: getErrorCode(error),
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
          errorCode: getErrorCode(error),
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

      if (req.user!.role === Role.ADMIN_MANAGER) {
        const assignment = await prisma.managerBranch.findUnique({
          where: {
            userId_branchId: {
              userId: req.user!.userId,
              branchId,
            },
          },
          select: { id: true },
        });

        if (!assignment) {
          throw {
            status: 403,
            code: 'BRANCH_ACCESS_DENIED',
            message: 'Anda tidak memiliki akses ke cabang ini',
          };
        }
      }

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
      const { userId, branchId, role } = req.user!;
      const { filters, options, format = 'xlsx' } = req.body;

      // Default columns if not specified
      const exportOptions = {
        columns: options?.columns || ['memberNo', 'fullName', 'phone', 'email', 'registrationBranch', 'status'],
        groupBy: options?.groupBy || 'none',
        sortBy: options?.sortBy || 'memberNo',
        sortOrder: options?.sortOrder || 'asc',
        includeSubtotals: options?.includeSubtotals || false,
        includeGrandTotal: options?.includeGrandTotal || false,
      };

      const data = await exportService.exportMembers(userId, role as Role, branchId, {
        filters: filters || {},
        options: exportOptions,
        format: format as 'csv' | 'xlsx',
      });

      const timestamp = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csv = exportService.generateCSV(data, exportOptions);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=members-export-${timestamp}.csv`);
        res.send(csv);
      } else {
        const buffer = await exportService.generateXLSX(data, exportOptions);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=members-export-${timestamp}.xlsx`);
        res.send(buffer);
      }
    } catch (error) {
      next(error);
    }
  }

  async getExportPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, branchId, role } = req.user!;
      const { filters } = req.body;

      const count = await exportService.getPreviewCount(userId, role as Role, branchId, filters || {});

      sendSuccess(res, { count });
    } catch (error) {
      next(error);
    }
  }

  async dryRunAccountImport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw { status: 400, code: 'FILE_REQUIRED', message: 'File Excel wajib diupload' };
      }

      const result = await accountImportService.dryRun({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        actor: {
          userId: req.user!.userId,
          role: req.user!.role,
          branchId: req.user!.branchId,
          branches: req.user!.branches,
        },
        branchId: req.body.branchId,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async executeAccountImport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw { status: 400, code: 'FILE_REQUIRED', message: 'File Excel wajib diupload' };
      }

      const result = await accountImportService.execute({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        actor: {
          userId: req.user!.userId,
          role: req.user!.role,
          branchId: req.user!.branchId,
          branches: req.user!.branches,
        },
        branchId: req.body.branchId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // CREDENTIAL MANAGEMENT METHODS (Super Admin Only)
  // ============================================================

  async getMemberCredentials(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const result = await membersService.getMemberCredentials(memberId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateMemberEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { email } = req.body;
      const { userId } = req.user!;

      if (!email || typeof email !== 'string') {
        throw { status: 400, code: 'VALIDATION_ERROR', message: 'Email wajib diisi' };
      }

      const result = await membersService.updateMemberEmail(memberId, email, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async updateMemberUsername(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const username = memberUsernameSchema.parse(req.body.username);
      const { userId } = req.user!;

      const result = await membersService.updateMemberUsername(memberId, username, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async resetMemberPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { newPassword } = req.body;
      const { userId } = req.user!;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        throw { status: 400, code: 'VALIDATION_ERROR', message: 'Password minimal 6 karakter' };
      }

      const result = await membersService.resetMemberPassword(memberId, newPassword, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // DOCUMENT UPLOAD METHODS (After Registration)
  // ============================================================

  /**
   * Upload member documents (PSP or Profile Photo)
   * POST /api/v1/members/:memberId/documents
   */
  async uploadMemberDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { documentType } = req.body;
      const userId = req.user!.userId;
      const file = req.file;

      if (!file) {
        throw { status: 400, code: 'FILE_REQUIRED', message: 'File is required' };
      }

      if (!documentType) {
        throw { status: 400, code: 'DOCUMENT_TYPE_REQUIRED', message: 'Document type is required' };
      }

      // Validate document type
      const validTypes = ['PERSETUJUAN_SETELAH_PENJELASAN', 'FOTO_PROFIL'];
      if (!validTypes.includes(documentType)) {
        throw { status: 400, code: 'INVALID_DOCUMENT_TYPE', message: 'Invalid document type' };
      }

      if (documentType === 'FOTO_PROFIL' && !file.mimetype.startsWith('image/')) {
        throw {
          status: 400,
          code: 'INVALID_PROFILE_PHOTO_TYPE',
          message: 'Foto profil hanya menerima file gambar.',
        };
      }

      const result = await membersService.uploadMemberDocument(
        memberId,
        file,
        documentType,
        userId
      );

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // ============================================================
  // LAB RESULTS METHODS
  // ============================================================

  async getMemberLabResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const result = await labResultsService.getMemberLabResults(memberId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getMemberSupportingPhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const result = await supportingPhotosService.getSupportingPhotosByMember(memberId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async uploadLabResult(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { userId } = req.user!;
      const file = req.file;

      if (!file) {
        throw { status: 400, code: 'FILE_REQUIRED', message: 'File wajib diupload' };
      }

      const result = await labResultsService.uploadLabResult(
        memberId,
        file,
        req.body,
        userId
      );

      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async deleteLabResult(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, labResultId } = req.params;
      const { userId } = req.user!;

      const result = await labResultsService.deleteLabResult(memberId, labResultId, userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
