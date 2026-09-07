import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, DocumentType } from '@prisma/client';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../../middleware/errorHandler';
import { deleteFileByUrl, safeDeleteFile, uploadFile } from '../../../config/minio';
import { processFile } from '../../../utils/imageProcessor';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'bin';
}

async function validateDocumentContents(
  file: Express.Multer.File,
  documentType: DocumentType,
): Promise<void> {
  if (!file.buffer.length) {
    throw new AppError(400, 'EMPTY_DOCUMENT', 'File dokumen kosong.');
  }

  if (file.mimetype === 'application/pdf') {
    if (documentType === DocumentType.FOTO_PROFIL) {
      throw new AppError(
        400,
        'INVALID_PROFILE_PHOTO_TYPE',
        'Foto profil hanya menerima file gambar.',
      );
    }

    if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new AppError(
        400,
        'INVALID_DOCUMENT_CONTENT',
        'Isi file tidak sesuai dengan format PDF.',
      );
    }
    return;
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      400,
      'INVALID_DOCUMENT_TYPE',
      'Dokumen hanya menerima file gambar atau PDF.',
    );
  }

  try {
    const metadata = await sharp(file.buffer).metadata();
    if (!metadata.format || !metadata.width || !metadata.height) {
      throw new Error('Image metadata is incomplete');
    }
  } catch {
    throw new AppError(
      400,
      'INVALID_DOCUMENT_CONTENT',
      'Isi file gambar tidak valid atau rusak.',
    );
  }
}

/**
 * Service for managing member documents (PSP, profile photos, etc.)
 * Handles file uploads to MinIO and cleanup of old files when updating
 */
export class MemberDocumentsService {
  /**
   * Upload or update a member document
   * If a document of the same type already exists, the old file is deleted from MinIO
   */
  async uploadDocument(
    memberId: string,
    documentType: DocumentType,
    file: Express.Multer.File,
    userId: string
  ) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    await validateDocumentContents(file, documentType);

    const processType = documentType === DocumentType.FOTO_PROFIL ? 'profilePhoto' : 'document';
    const processed = await processFile(file.buffer, file.mimetype, processType);
    const fileExt = extensionForMimeType(processed.mimeType);
    const docTypeSlug = documentType.toLowerCase().replace(/_/g, '-');
    const key = `uploads/members/${memberId}/documents/${docTypeSlug}-${randomUUID()}.${fileExt}`;

    console.log(`[MemberDocuments] Uploading ${documentType} to MinIO: ${key}`);
    let uploadResult;
    try {
      uploadResult = await uploadFile(processed.buffer, key, processed.mimeType);
    } catch (error) {
      console.error(`[MemberDocuments] Failed to upload ${documentType}:`, error);
      throw new AppError(
        503,
        'DOCUMENT_STORAGE_UNAVAILABLE',
        'Penyimpanan dokumen sedang tidak tersedia. Silakan coba lagi.',
      );
    }

    const documentData = {
      fileUrl: uploadResult.url,
      fileName: file.originalname,
      fileSize: processed.buffer.length,
      mimeType: processed.mimeType,
      uploadedBy: userId,
    };

    let storedDocument;
    let previousFileUrl: string | null = null;
    try {
      const stored = await prisma.$transaction(async (tx) => {
        const lockKey = `member-document:${memberId}:${documentType}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const existingDocument = await tx.memberDocument.findUnique({
          where: {
            memberId_documentType: { memberId, documentType },
          },
        });

        const document = await tx.memberDocument.upsert({
          where: {
            memberId_documentType: { memberId, documentType },
          },
          create: {
            ...documentData,
            memberId,
            documentType,
          },
          update: documentData,
        });

        return { document, previousFileUrl: existingDocument?.fileUrl ?? null };
      });
      storedDocument = stored.document;
      previousFileUrl = stored.previousFileUrl;
    } catch (error) {
      await safeDeleteFile(uploadResult.key);
      throw error;
    }

    if (previousFileUrl && previousFileUrl !== uploadResult.url) {
      await deleteFileByUrl(previousFileUrl);
    }

    await logAudit({
      userId,
      branchId: member.registrationBranchId,
      action: previousFileUrl ? AuditAction.UPDATE : AuditAction.CREATE,
      resource: 'MemberDocument',
      resourceId: storedDocument.id,
      meta: {
        memberId,
        documentType,
        fileName: file.originalname,
        previousFileUrl,
      },
    });

    return storedDocument;
  }

  /**
   * Delete a member document and its file from MinIO
   */
  async deleteDocument(documentId: string, userId: string) {
    const document = await prisma.memberDocument.findUnique({
      where: { id: documentId },
      include: {
        member: true,
      },
    });

    if (!document) {
      throw { status: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Dokumen tidak ditemukan' };
    }

    // Delete file from MinIO
    if (document.fileUrl) {
      console.log(`[MemberDocuments] Deleting file from MinIO: ${document.fileUrl}`);
      await deleteFileByUrl(document.fileUrl);
    }

    // Delete from database
    await prisma.memberDocument.delete({
      where: { id: documentId },
    });

    // Audit log
    await logAudit({
      userId,
      branchId: document.member.registrationBranchId,
      action: AuditAction.DELETE,
      resource: 'MemberDocument',
      resourceId: documentId,
      meta: {
        memberId: document.memberId,
        documentType: document.documentType,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
      },
    });

    return { message: 'Dokumen berhasil dihapus' };
  }

  /**
   * Delete all documents for a member and their files from MinIO
   * Used when hard-deleting a member
   */
  async deleteAllMemberDocuments(memberId: string, _userId: string) {
    const documents = await prisma.memberDocument.findMany({
      where: { memberId },
    });

    console.log(`[MemberDocuments] Deleting ${documents.length} documents for member ${memberId}`);

    let deletedCount = 0;
    for (const doc of documents) {
      if (doc.fileUrl) {
        const deleted = await deleteFileByUrl(doc.fileUrl);
        if (deleted) deletedCount++;
      }
    }

    // Delete all documents from database
    await prisma.memberDocument.deleteMany({
      where: { memberId },
    });

    console.log(`[MemberDocuments] Deleted ${deletedCount} files from MinIO`);

    return {
      message: `${documents.length} dokumen berhasil dihapus`,
      filesDeleted: deletedCount,
    };
  }

  /**
   * Get all documents for a member
   */
  async getMemberDocuments(memberId: string) {
    const documents = await prisma.memberDocument.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map(doc => ({
      id: doc.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      fileUrl: doc.fileUrl,
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.createdAt.toISOString(),
    }));
  }
}
