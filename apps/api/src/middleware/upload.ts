import multer from 'multer';
import { Request } from 'express';
import { AppError } from './errorHandler';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp'] as const;
const PAYMENT_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp'] as const; // Accept all common image formats
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
    cb(new AppError(400, 'FILE_INVALID_TYPE', 'Hanya JPG, PNG, dan WebP yang diizinkan.'));
    return;
  }
  cb(null, true);
}

function paymentProofFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!PAYMENT_PROOF_MIME_TYPES.includes(file.mimetype as (typeof PAYMENT_PROOF_MIME_TYPES)[number])) {
    cb(new AppError(400, 'FILE_INVALID_TYPE', 'Bukti pembayaran hanya menerima format gambar (JPG, PNG, WebP, GIF, BMP).'));
    return;
  }
  cb(null, true);
}

/**
 * Multer instance — stores files in memory (as Buffer).
 * Enforces: max 5 MB, only image/jpeg | image/png | image/webp.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Multer instance for payment proof — stores files in memory (as Buffer).
 * Enforces: max 5 MB, accepts all common image formats (JPG, PNG, WebP, GIF, BMP).
 */
export const uploadPaymentProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: paymentProofFileFilter,
});

/**
 * Multer error handler — maps MulterError to AppError for consistent response.
 */
export function handleMulterError(err: unknown): never {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran file maksimal 5MB.');
    }
    throw new AppError(400, 'UPLOAD_ERROR', `Upload error: ${err.message}`);
  }
  throw err;
}
