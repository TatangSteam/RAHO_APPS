import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/minio';
import { env } from '../../config/env';
import { prisma } from '@lib/prisma';
import { Readable } from 'stream';

type AuthUser = {
  userId: string;
  role: string;
  branchId: string | null;
};

export class FilesService {
  /**
   * Get file from MinIO and return as stream after authorization.
   */
  async getFile(filePath: string, user: AuthUser) {
    try {
      const key = this.normalizeFileKey(filePath);
      await this.authorizeFileAccess(key, user);

      const command = new GetObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw {
          status: 404,
          code: 'FILE_NOT_FOUND',
          message: 'File tidak ditemukan',
        };
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
        etag: response.ETag || '',
      };
    } catch (error: any) {
      // Handle S3/MinIO errors
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw {
          status: 404,
          code: 'FILE_NOT_FOUND',
          message: 'File tidak ditemukan',
        };
      }

      throw {
        status: 500,
        code: 'FILE_RETRIEVAL_ERROR',
        message: 'Gagal mengambil file',
        details: error.message,
      };
    }
  }

  private normalizeFileKey(filePath: string): string {
    const trimmed = filePath.replace(/^\/+/, '');

    if (trimmed.startsWith('api/v1/files/')) {
      return trimmed.replace(/^api\/v1\/files\//, '');
    }

    if (trimmed.startsWith('files/')) {
      return trimmed.replace(/^files\//, '');
    }

    if (trimmed.startsWith(`${env.MINIO_BUCKET}/`)) {
      return trimmed.replace(new RegExp(`^${env.MINIO_BUCKET}/`), '');
    }

    return trimmed;
  }

  private isPrivilegedRole(role: string): boolean {
    return role === 'SUPER_ADMIN' || role === 'ADMIN_MANAGER';
  }

  private async getAccessibleBranchIds(user: AuthUser): Promise<string[] | null> {
    if (this.isPrivilegedRole(user.role)) {
      return null;
    }

    const branchIds = new Set<string>();

    if (user.branchId) {
      branchIds.add(user.branchId);
    }

    const staffBranches = await prisma.staffBranch.findMany({
      where: { userId: user.userId },
      select: { branchId: true },
    });

    staffBranches.forEach((item) => branchIds.add(item.branchId));
    return Array.from(branchIds);
  }

  private async authorizeFileAccess(key: string, user: AuthUser): Promise<void> {
    if (this.isPrivilegedRole(user.role)) {
      return;
    }

    if (key.startsWith('session-photos/')) {
      await this.authorizeSessionPhotoAccess(key, user);
      return;
    }

    if (key.startsWith('uploads/members/')) {
      await this.authorizeMemberDocumentAccess(key, user);
      return;
    }

    if (key.startsWith('uploads/payment-proofs/')) {
      await this.authorizePaymentProofAccess(key, user);
      return;
    }

    throw {
      status: 403,
      code: 'FILE_ACCESS_DENIED',
      message: 'Anda tidak memiliki akses ke file ini',
    };
  }

  private async authorizeSessionPhotoAccess(key: string, user: AuthUser): Promise<void> {
    const sessionPhoto = await prisma.sessionPhoto.findFirst({
      where: {
        OR: [
          { fileUrl: key },
          { fileUrl: `${env.API_PREFIX}/files/${key}` },
          { fileUrl: `${env.API_URL}${env.API_PREFIX}/files/${key}` },
          { fileUrl: `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}` },
          { fileUrl: { endsWith: key } },
        ],
      },
      select: {
        fileUrl: true,
        session: {
          select: {
            branchId: true,
            encounter: {
              select: {
                member: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sessionPhoto) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    if (user.role === 'MEMBER') {
      if (sessionPhoto.session.encounter.member.userId !== user.userId) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
      return;
    }

    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (!accessibleBranchIds || !accessibleBranchIds.includes(sessionPhoto.session.branchId)) {
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }
  }

  private async authorizeMemberDocumentAccess(key: string, user: AuthUser): Promise<void> {
    const document = await prisma.memberDocument.findFirst({
      where: {
        OR: [
          { fileUrl: key },
          { fileUrl: `${env.API_PREFIX}/files/${key}` },
          { fileUrl: `${env.API_URL}${env.API_PREFIX}/files/${key}` },
          { fileUrl: `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}` },
          { fileUrl: { endsWith: key } },
        ],
      },
      select: {
        fileUrl: true,
        member: {
          select: {
            userId: true,
            registrationBranchId: true,
            branchAccesses: {
              select: {
                branchId: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    if (user.role === 'MEMBER') {
      if (document.member.userId !== user.userId) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
      return;
    }

    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (!accessibleBranchIds) {
      return;
    }

    const memberBranchIds = [
      document.member.registrationBranchId,
      ...document.member.branchAccesses.map((access) => access.branchId),
    ];

    const hasAccess = memberBranchIds.some((branchId) => accessibleBranchIds.includes(branchId));
    if (!hasAccess) {
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }
  }

  private async authorizePaymentProofAccess(key: string, user: AuthUser): Promise<void> {
    const payment = await prisma.invoicePayment.findFirst({
      where: {
        OR: [
          { proofFileUrl: key },
          { proofFileUrl: `${env.API_PREFIX}/files/${key}` },
          { proofFileUrl: `${env.API_URL}${env.API_PREFIX}/files/${key}` },
          { proofFileUrl: `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}` },
          { proofFileUrl: { endsWith: key } },
        ],
      },
      select: {
        proofFileUrl: true,
        invoice: {
          select: {
            branchId: true,
            member: {
              select: {
                userId: true,
                registrationBranchId: true,
                branchAccesses: {
                  select: {
                    branchId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    if (user.role === 'MEMBER') {
      if (payment.invoice.member.userId !== user.userId) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
      return;
    }

    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (!accessibleBranchIds) {
      return;
    }

    const invoiceBranchIds = [
      payment.invoice.branchId,
      payment.invoice.member.registrationBranchId,
      ...payment.invoice.member.branchAccesses.map((access) => access.branchId),
    ];

    const hasAccess = invoiceBranchIds.some((branchId) => accessibleBranchIds.includes(branchId));
    if (!hasAccess) {
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }
  }
}
