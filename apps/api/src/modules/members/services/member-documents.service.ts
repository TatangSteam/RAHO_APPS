import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, DocumentType } from '@prisma/client';
import { uploadFile, deleteFileByUrl } from '../../../config/minio';

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
    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if document of this type already exists
    const existingDocument = await prisma.memberDocument.findFirst({
      where: {
        memberId,
        documentType,
      },
    });

    // If exists, delete old file from MinIO
    if (existingDocument && existingDocument.fileUrl) {
      console.log(`[MemberDocuments] Deleting old ${documentType} file: ${existingDocument.fileUrl}`);
      await deleteFileByUrl(existingDocument.fileUrl);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.mimetype.split('/')[1] || 'bin';
    const docTypeSlug = documentType.toLowerCase().replace(/_/g, '-');
    const key = `uploads/members/${memberId}/documents/${docTypeSlug}-${timestamp}.${fileExt}`;

    // Upload to MinIO
    console.log(`[MemberDocuments] Uploading ${documentType} to MinIO: ${key}`);
    const uploadResult = await uploadFile(file.buffer, key, file.mimetype);

    // Save or update in database
    const documentData = {
      fileUrl: uploadResult.url,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: userId,
    };

    let document;
    if (existingDocument) {
      document = await prisma.memberDocument.update({
        where: { id: existingDocument.id },
        data: documentData,
      });
      console.log(`[MemberDocuments] Updated existing document: ${document.id}`);
    } else {
      document = await prisma.memberDocument.create({
        data: {
          ...documentData,
          memberId,
          documentType,
        },
      });
      console.log(`[MemberDocuments] Created new document: ${document.id}`);
    }

    // Audit log
    await logAudit({
      userId,
      branchId: member.registrationBranchId,
      action: existingDocument ? AuditAction.UPDATE : AuditAction.CREATE,
      resource: 'MemberDocument',
      resourceId: document.id,
      meta: {
        memberId,
        documentType,
        fileName: file.originalname,
        previousFileUrl: existingDocument?.fileUrl || null,
      },
    });

    return document;
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
