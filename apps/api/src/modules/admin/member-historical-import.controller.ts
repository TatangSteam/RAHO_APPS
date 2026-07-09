import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@utils/response';
import { errors } from '@middleware/errorHandler';
import { MemberHistoricalImportService } from './services/member-historical-import.service';

const importService = new MemberHistoricalImportService();

function getUploadedFile(req: Request) {
  const file = req.file;
  if (!file) {
    throw errors.badRequest('FILE_REQUIRED', 'File Excel wajib diupload.');
  }
  return file;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

export async function dryRunMemberHistoricalImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = getUploadedFile(req);
    const result = await importService.dryRun({
      buffer: file.buffer,
      fileName: file.originalname,
      branchId: req.body.branchId,
      actor: req.user,
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function executeMemberHistoricalImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = getUploadedFile(req);
    const result = await importService.execute({
      buffer: file.buffer,
      fileName: file.originalname,
      branchId: req.body.branchId,
      actor: req.user,
      options: {
        markSessionsCompleted: parseBoolean(req.body.markSessionsCompleted, true),
        createPlaceholderStaff: parseBoolean(req.body.createPlaceholderStaff, true),
        skipMaterialUsage: parseBoolean(req.body.skipMaterialUsage, true),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
}
