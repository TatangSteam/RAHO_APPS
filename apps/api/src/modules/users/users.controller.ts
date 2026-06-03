import { Request, Response, NextFunction } from 'express';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  resetPasswordSchema,
  listUsersQuerySchema,
} from './users.schema';
import {
  listUsersService,
  getUserService,
  createUserService,
  updateUserService,
  changePasswordService,
  resetPasswordService,
  updateAvatarService,
  getStaffByRoleService,
  getMedicalStaffNotInBranchService,
  getUserBranchesService,
  assignUserToBranchService,
  removeUserFromBranchService,
  getAvailableBranchesForUserService,
  setPrimaryBranchService,
  getUserCredentialsService,
  updateUserEmailService,
} from './users.service';
import {
  getStaffPerformanceSummaryService,
  getStaffSessionHistoryService,
} from './services/staff-performance.service';
import { sendSuccess, sendCreated, sendNoContent, buildPaginationMeta } from '@utils/response';
import { logAudit } from '@utils/auditLog';
import { uploadFile, deleteFileByUrl } from '@config/minio';
import { AuditAction, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listUsersQuerySchema.parse(req.query);
    const { users, total, page, limit } = await listUsersService(
      query,
      req.user.role as Role,
      req.user.branchId,
    );
    sendSuccess(res, users, 200, buildPaginationMeta(total, page, limit));
  } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getUserService(req.params.userId);
    sendSuccess(res, user);
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('🔍 [UsersController] Create user request body:', req.body);
    console.log('🔍 [UsersController] Caller role:', req.user.role);
    console.log('🔍 [UsersController] Caller branchId:', req.user.branchId);
    
    const input = createUserSchema.parse(req.body);
    console.log('🔍 [UsersController] Parsed input:', input);
    
    const user = await createUserService(input, req.user.role as Role, req.user.branchId);

    // Create audit log for user creation (fire-and-forget)
    logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'CREATE',
      resource: 'User',
      resourceId: user.id,
      meta: { 
        email: user.email, 
        role: user.role,
        createdUserEmail: user.email,
        createdUserRole: user.role,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => {
      console.error('❌ Failed to create user CREATE audit log:', error);
    });

    console.log('✅ [UsersController] User created successfully:', user.id);
    sendCreated(res, user);
  } catch (err) { 
    console.error('❌ [UsersController] Error creating user:', err);
    next(err); 
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('🔍 [UsersController] Update user request:', req.params.userId);
    console.log('🔍 [UsersController] Update body:', req.body);
    
    const input = updateUserSchema.parse(req.body);
    console.log('🔍 [UsersController] Parsed input:', input);
    
    const user = await updateUserService(req.params.userId, input);

    // Create audit log for user update (fire-and-forget)
    logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: user.id,
      meta: { 
        changes: input,
        updatedUserEmail: user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => {
      console.error('❌ Failed to create user UPDATE audit log:', error);
    });

    console.log('✅ [UsersController] User updated successfully:', user.id);
    sendSuccess(res, user);
  } catch (err) { 
    console.error('❌ [UsersController] Error updating user:', err);
    next(err); 
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('🔍 [UsersController] Deactivate user request:', req.params.userId);
    console.log('🔍 [UsersController] Caller role:', req.user.role);
    
    // Get target user to check their role
    const targetUser = await getUserService(req.params.userId);
    
    // ADMIN_CABANG cannot deactivate other ADMIN_CABANG
    if (req.user.role === Role.ADMIN_CABANG && targetUser.role === Role.ADMIN_CABANG) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin Cabang tidak dapat menonaktifkan Admin Cabang lain.'
        }
      });
      return;
    }
    
    const user = await updateUserService(req.params.userId, { isActive: false });
    
    // Create audit log for user deactivation (fire-and-forget)
    logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'DELETE',
      resource: 'User',
      resourceId: user.id,
      meta: { 
        action: 'deactivate',
        deactivatedUserEmail: user.email,
        deactivatedUserRole: user.role,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => {
      console.error('❌ Failed to create user DELETE audit log:', error);
    });
    
    console.log('✅ [UsersController] User deactivated successfully:', user.id);
    sendNoContent(res);
  } catch (err) { 
    console.error('❌ [UsersController] Error deactivating user:', err);
    next(err); 
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = changePasswordSchema.parse(req.body);
    await changePasswordService(req.user.userId, input);
    
    // Create audit log for PASSWORD_CHANGE (fire-and-forget)
    logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'PASSWORD_CHANGE' as AuditAction,
      resource: 'User',
      resourceId: req.user.userId,
      meta: { 
        action: 'self_password_change',
        email: req.user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => {
      console.error('❌ Failed to create PASSWORD_CHANGE audit log:', error);
    });
    
    sendSuccess(res, { message: 'Password berhasil diubah.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await resetPasswordService(req.params.userId, input);
    
    // Create audit log for PASSWORD_RESET (fire-and-forget)
    logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'PASSWORD_RESET' as AuditAction,
      resource: 'User',
      resourceId: req.params.userId,
      meta: { 
        action: 'admin_password_reset',
        resetByUserId: req.user.userId,
        resetByEmail: req.user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => {
      console.error('❌ Failed to create PASSWORD_RESET audit log:', error);
    });
    
    sendSuccess(res, { message: 'Password berhasil di-reset.' });
  } catch (err) { next(err); }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'FILE_REQUIRED', message: 'File avatar diperlukan.' } });
      return;
    }

    // Get current avatar URL to delete old file
    const currentProfile = await prisma.userProfile.findUnique({
      where: { userId: req.user.userId },
      select: { avatarUrl: true },
    });

    // Delete old avatar if exists
    if (currentProfile?.avatarUrl) {
      await deleteFileByUrl(currentProfile.avatarUrl);
      console.log(`[Avatar] Deleted old avatar for user ${req.user.userId}`);
    }

    // Add timestamp to filename to prevent browser caching
    const timestamp = Date.now();
    const extension = req.file.mimetype.split('/')[1];
    const key = `uploads/profiles/${req.user.userId}/avatar-${timestamp}.${extension}`;
    const { url } = await uploadFile(req.file.buffer, key, req.file.mimetype);

    const profile = await updateAvatarService(req.user.userId, url);
    sendSuccess(res, profile);
  } catch (err) { next(err); }
}

export async function getStaffByRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.params;
    const { branchId } = req.query;

    // Validate role
    if (!['DOCTOR', 'NURSE', 'ADMIN_LAYANAN'].includes(role)) {
      res.status(400).json({ 
        success: false, 
        error: { code: 'INVALID_ROLE', message: 'Role harus DOCTOR, NURSE, atau ADMIN_LAYANAN.' } 
      });
      return;
    }

    const staff = await getStaffByRoleService(
      role as Role,
      branchId as string | undefined,
    );

    sendSuccess(res, staff);
  } catch (err) { next(err); }
}

/**
 * List staff for a specific branch (used by /branches/:branchId/staff endpoint)
 * This properly uses req.params.branchId instead of req.user.branchId
 */
export async function listBranchStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { branchId } = req.params;
    const query = listUsersQuerySchema.parse(req.query);
    
    // Override branchId from URL params
    const { users, total, page, limit } = await listUsersService(
      { ...query, branchId },
      req.user.role as Role,
      null, // Pass null for callerBranchId since we're explicitly filtering by branchId param
    );
    
    // Return full user data including staffCode and profile for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      staffCode: user.staffCode || '-',
      role: user.role,
      isActive: user.isActive,
      profile: {
        fullName: user.profile?.fullName || '-',
        phone: user.profile?.phone || '-',
        avatarUrl: user.profile?.avatarUrl || null,
      },
      branch: user.branch,
    }));
    
    sendSuccess(res, { users: transformedUsers, total, page, limit });
  } catch (err) { next(err); }
}

// ══════════════════════════════════════════════════════════════
// STAFF BRANCH MANAGEMENT (Multi-Branch Assignment)
// ══════════════════════════════════════════════════════════════

/**
 * Get medical staff (DOCTOR/NURSE) not assigned to a specific branch
 * GET /users/medical-staff?excludeBranchId={branchId}
 */
export async function getMedicalStaffNotInBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { excludeBranchId } = req.query;
    
    if (!excludeBranchId || typeof excludeBranchId !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'BRANCH_ID_REQUIRED', message: 'excludeBranchId query parameter is required.' }
      });
      return;
    }

    const staff = await getMedicalStaffNotInBranchService(excludeBranchId);
    sendSuccess(res, staff);
  } catch (err) { next(err); }
}

/**
 * Get all branches assigned to a user (DOCTOR/NURSE)
 * GET /users/:userId/branches
 */
export async function getUserBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const result = await getUserBranchesService(userId);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

/**
 * Assign a user (DOCTOR/NURSE) to a branch
 * POST /users/:userId/branches
 */
export async function assignUserToBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const { branchId } = req.body;

    if (!branchId) {
      res.status(400).json({
        success: false,
        error: { code: 'BRANCH_ID_REQUIRED', message: 'branchId is required in request body.' }
      });
      return;
    }

    const result = await assignUserToBranchService(userId, branchId);

    await logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'CREATE',
      resource: 'StaffBranch',
      resourceId: result.staffBranchId,
      meta: { targetUserId: userId, assignedBranchId: branchId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendCreated(res, result);
  } catch (err) { next(err); }
}

/**
 * Remove a user (DOCTOR/NURSE) from a branch
 * DELETE /users/:userId/branches/:branchId
 */
export async function removeUserFromBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, branchId } = req.params;

    const result = await removeUserFromBranchService(userId, branchId);

    await logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'DELETE',
      resource: 'StaffBranch',
      resourceId: `${userId}_${branchId}`,
      meta: { targetUserId: userId, removedBranchId: branchId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, result);
  } catch (err) { next(err); }
}

/**
 * Get available branches for a user (branches not yet assigned)
 * GET /users/:userId/branches/available
 */
export async function getAvailableBranchesForUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const branches = await getAvailableBranchesForUserService(userId);
    sendSuccess(res, branches);
  } catch (err) { next(err); }
}

/**
 * Set a branch as the primary branch for a user (DOCTOR/NURSE)
 * PATCH /users/:userId/branches/:branchId/set-primary
 */
export async function setPrimaryBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, branchId } = req.params;

    const result = await setPrimaryBranchService(userId, branchId);

    await logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: userId,
      meta: { 
        action: 'set_primary_branch',
        oldPrimaryBranch: result.oldPrimaryBranch,
        newPrimaryBranch: result.newPrimaryBranch,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, result);
  } catch (err) { next(err); }
}

// ══════════════════════════════════════════════════════════════
// STAFF PERFORMANCE (Kinerja Staff)
// ══════════════════════════════════════════════════════════════

/**
 * Get staff performance summary for a branch
 * GET /users/performance/summary
 */
export async function getStaffPerformanceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { branchId, startDate, endDate, page, limit } = req.query;
    
    const result = await getStaffPerformanceSummaryService(
      {
        branchId: branchId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      },
      req.user.role as Role,
      req.user.branchId,
      req.user.userId, // Pass userId for ADMIN_MANAGER branch validation
    );

    sendSuccess(res, result, 200, buildPaginationMeta(result.total, result.page, result.limit));
  } catch (err) { next(err); }
}

/**
 * Get detailed session history for a specific staff member
 * GET /users/performance/:staffId/history
 */
export async function getStaffSessionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { staffId } = req.params;
    const { position, startDate, endDate, page, limit } = req.query;
    
    const result = await getStaffSessionHistoryService(
      staffId,
      {
        position: position as 'doctor' | 'nurse' | 'adminLayanan' | 'all' | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      },
      req.user.role as Role,
      req.user.branchId,
    );

    sendSuccess(res, result, 200, buildPaginationMeta(result.total, result.page, result.limit));
  } catch (err) { next(err); }
}

// ══════════════════════════════════════════════════════════════
// CREDENTIAL MANAGEMENT (Super Admin Only)
// ══════════════════════════════════════════════════════════════

/**
 * Get user credentials (email, role, etc.) - Super Admin only
 * GET /users/:userId/credentials
 */
export async function getUserCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const credentials = await getUserCredentialsService(userId);
    sendSuccess(res, credentials);
  } catch (err) { next(err); }
}

/**
 * Update user email - Super Admin only
 * PATCH /users/:userId/email
 */
export async function updateUserEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'EMAIL_REQUIRED', message: 'Email baru diperlukan.' }
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Format email tidak valid.' }
      });
      return;
    }

    // Get old email before update for audit log
    const oldUser = await getUserService(userId);
    const oldEmail = oldUser.email;

    const result = await updateUserEmailService(userId, email);

    // Create audit log for email change (fire-and-forget)
    logAudit({
      userId: req.user.userId,
      branchId: req.user.branchId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: userId,
      meta: { 
        action: 'email_change', 
        oldEmail,
        newEmail: email,
        changedByUserId: req.user.userId,
        changedByEmail: req.user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error) => {
      console.error('❌ Failed to create email change audit log:', error);
    });

    sendSuccess(res, result);
  } catch (err) { next(err); }
}
