import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '@lib/logger';
import { sendError } from '@utils/response';

/**
 * Global Express error handler.
 * Maps known error types to standard API error responses.
 * Must be registered LAST in the middleware chain.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Already responded
  if (res.headersSent) return;

  // ── Zod Validation Error ─────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Data yang dikirimkan tidak valid.', details);
    return;
  }

  // ── Prisma Known Request Errors ──────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[]) ?? [];
      sendError(
        res,
        409,
        'DUPLICATE_ENTRY',
        `Data duplikat pada field: ${fields.join(', ')}.`,
      );
      return;
    }
    // Record not found
    if (err.code === 'P2025') {
      sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Data tidak ditemukan.');
      return;
    }
    // Foreign key constraint
    if (err.code === 'P2003') {
      sendError(res, 400, 'FOREIGN_KEY_VIOLATION', 'Referensi data tidak valid.');
      return;
    }
  }

  // ── Application-level errors (thrown with code+status) ──
  if (isAppError(err)) {
    sendError(res, err.status, err.code, err.message);
    return;
  }

  // ── Unknown / Unexpected Errors ──────────────────────────
  logger.error('[Unhandled Error]', {
    error: err,
    url: req.url,
    method: req.method,
    body: req.body,
  });

  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'Terjadi kesalahan pada server. Silakan coba lagi.',
  );
}

// ── AppError class ───────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function isAppError(err: unknown): err is AppError {
  return (
    err instanceof AppError ||
    (typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      'code' in err &&
      'message' in err)
  );
}

// ── Error Factories ──────────────────────────────────────────

export const errors = {
  notFound: (msg = 'Data tidak ditemukan.') =>
    new AppError(404, 'RESOURCE_NOT_FOUND', msg),

  forbidden: (msg = 'Anda tidak memiliki akses.') =>
    new AppError(403, 'AUTH_FORBIDDEN', msg),

  conflict: (code: string, msg: string) => new AppError(409, code, msg),

  unprocessable: (code: string, msg: string) => new AppError(422, code, msg),

  badRequest: (code: string, msg: string) => new AppError(400, code, msg),
} as const;
