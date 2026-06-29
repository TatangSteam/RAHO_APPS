import multer from 'multer';
import { Request } from 'express';
import { AppError } from './errorHandler';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp'] as const;
const DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp', 'application/pdf'] as const; // For PSP documents (images + PDF) and profile photos
const PAYMENT_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/bmp'] as const; // Accept all common image formats
const LAB_RESULT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'] as const; // PDF and images for lab results
const SHIPMENT_RECEIPT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg'] as const; // PDF and JPG/JPEG for shipment receipts
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PAYMENT_PROOF_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_LAB_RESULT_SIZE = 10 * 1024 * 1024; // 10 MB for lab results
const MAX_SHIPMENT_RECEIPT_SIZE = 10 * 1024 * 1024; // 10 MB for shipment receipts

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

function documentFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  // Allow images for profile photos, and images + PDF for PSP documents
  if (!DOCUMENT_MIME_TYPES.includes(file.mimetype as (typeof DOCUMENT_MIME_TYPES)[number])) {
    cb(new AppError(400, 'FILE_INVALID_TYPE', 'Hanya file gambar (JPG, PNG, WebP, GIF, BMP) atau PDF yang diizinkan untuk PSP dan foto profil.'));
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

function labResultFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!LAB_RESULT_MIME_TYPES.includes(file.mimetype as (typeof LAB_RESULT_MIME_TYPES)[number])) {
    cb(new AppError(400, 'FILE_INVALID_TYPE', 'Hasil lab hanya menerima format PDF, JPG, atau PNG.'));
    return;
  }
  cb(null, true);
}

function shipmentReceiptFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (!SHIPMENT_RECEIPT_MIME_TYPES.includes(file.mimetype as (typeof SHIPMENT_RECEIPT_MIME_TYPES)[number])) {
    cb(new AppError(400, 'FILE_INVALID_TYPE', 'Tanda terima hanya menerima format PDF atau JPG.'));
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
 * Multer instance for member documents (PSP + profile photo) — stores files in memory (as Buffer).
 * Enforces: max 5 MB, accepts images (JPG, PNG, WebP, GIF, BMP) and PDF for PSP documents.
 */
export const uploadMemberDocuments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: documentFileFilter,
});

/**
 * Multer instance for payment proof — stores files in memory (as Buffer).
 * Enforces: max 5 MB, accepts all common image formats (JPG, PNG, WebP, GIF, BMP).
 */
export const uploadPaymentProof = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PAYMENT_PROOF_SIZE },
  fileFilter: paymentProofFileFilter,
});

/**
 * Multer instance for lab results — stores files in memory (as Buffer).
 * Enforces: max 10 MB, accepts PDF, JPG, PNG.
 */
export const uploadLabResult = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LAB_RESULT_SIZE },
  fileFilter: labResultFileFilter,
});

export const uploadShipmentReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SHIPMENT_RECEIPT_SIZE },
  fileFilter: shipmentReceiptFileFilter,
});

/**
 * Multer error handler — maps MulterError to AppError for consistent response.
 */
export function handleMulterError(err: unknown): never {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      throw new AppError(400, 'FILE_TOO_LARGE', 'Ukuran file melebihi batas maksimal.');
    }
    throw new AppError(400, 'UPLOAD_ERROR', `Upload error: ${err.message}`);
  }
  throw err;
}
