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
} from './users.service';
import { sendSuccess, sendCreated, sendNoContent, buildPaginationMeta } from '@utils/response';
import { logAudit } from '@utils/auditLog';
import { uploadFile } from '@config/minio';
import { Role } from '@prisma/client';

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
    const input = createUserSchema.parse(req.body);
    const user = await createUserService(input, req.user.role as Role, req.user.branchId);

    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      resource: 'User',
      resourceId: user.id,
      meta: { email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendCreated(res, user);
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateUserSchema.parse(req.body);
    const user = await updateUserService(req.params.userId, input);

    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: user.id,
      meta: { changes: input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, user);
  } catch (err) { next(err); }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await updateUserService(req.params.userId, { isActive: false });
    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      resource: 'User',
      resourceId: user.id,
      meta: { action: 'deactivate' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendNoContent(res);
  } catch (err) { next(err); }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = changePasswordSchema.parse(req.body);
    await changePasswordService(req.user.userId, input);
    sendSuccess(res, { message: 'Password berhasil diubah.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await resetPasswordService(req.params.userId, input);
    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      resource: 'User',
      resourceId: req.params.userId,
      meta: { action: 'password_reset' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
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

    const key = `uploads/profiles/${req.user.userId}/avatar.${req.file.mimetype.split('/')[1]}`;
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
