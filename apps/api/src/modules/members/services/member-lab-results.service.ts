import { prisma } from '../../../lib/prisma';
import { uploadFile, deleteFileByUrl, extractKeyFromUrl } from '../../../config/minio';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';
import { env } from '../../../config/env';

export class MemberLabResultsService {
  async getMemberLabResults(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const labResults = await prisma.labResult.findMany({
      where: { memberId },
      include: {
        uploadedByUser: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return labResults.map((result) => ({
      ...result,
      fileUrl: result.fileUrl
        ? `${env.API_PREFIX}/files/${extractKeyFromUrl(result.fileUrl)}`
        : result.fileUrl,
    }));
  }

  async uploadLabResult(
    memberId: string,
    file: Express.Multer.File,
    data: { description?: string; labDate?: string },
    userId: string,
  ) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Upload file to MinIO
    const key = `lab-results/${memberId}/${Date.now()}-${file.originalname}`;
    const uploadResult = await uploadFile(file.buffer, key, file.mimetype);

    // Create lab result record
    const labResult = await prisma.labResult.create({
      data: {
        memberId,
        fileName: file.originalname,
        fileUrl: `${env.API_PREFIX}/files/${uploadResult.key}`,
        fileType: file.mimetype,
        fileSize: file.size,
        description: data.description || null,
        labDate: data.labDate ? new Date(data.labDate) : null,
        uploadedBy: userId,
      },
      include: {
        uploadedByUser: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Log audit
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'LabResult',
      resourceId: labResult.id,
      meta: { memberId, fileName: file.originalname },
    });

    return labResult;
  }

  async deleteLabResult(memberId: string, labResultId: string, userId: string) {
    const labResult = await prisma.labResult.findFirst({
      where: {
        id: labResultId,
        memberId,
      },
    });

    if (!labResult) {
      throw { status: 404, code: 'LAB_RESULT_NOT_FOUND', message: 'Hasil lab tidak ditemukan' };
    }

    // Delete file from MinIO
    try {
      await deleteFileByUrl(labResult.fileUrl);
    } catch (error) {
      console.error('Failed to delete file from MinIO:', error);
      // Continue with database deletion even if MinIO deletion fails
    }

    // Delete lab result record
    await prisma.labResult.delete({
      where: { id: labResultId },
    });

    // Log audit
    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'LabResult',
      resourceId: labResultId,
      meta: { memberId, fileName: labResult.fileName },
    });

    return { message: 'Hasil lab berhasil dihapus' };
  }
}
