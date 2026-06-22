import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/minio';
import { env } from '../../config/env';
import { prisma } from '@lib/prisma';
import { Readable } from 'stream';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';

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
      // Re-throw errors that already have a status code (from authorization)
      if (error.status) {
        throw error;
      }

      const localFile = this.getLocalFile(filePath);
      if (localFile) {
        return localFile;
      }

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

  private getLocalFile(filePath: string) {
    const key = this.normalizeFileKey(filePath);
    const cwd = path.resolve(process.cwd());
    const localPath = path.resolve(cwd, key);

    if (!localPath.startsWith(cwd) || !existsSync(localPath)) {
      return null;
    }

    const stat = statSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
    };

    return {
      stream: createReadStream(localPath) as unknown as Readable,
      contentType: contentTypes[ext] || 'application/octet-stream',
      contentLength: stat.size,
      etag: `"${stat.mtimeMs}-${stat.size}"`,
    };
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

    if (key.startsWith('session-supporting-photos/')) {
      await this.authorizeSessionSupportingPhotoAccess(key, user);
      return;
    }

    if (key.startsWith('uploads/members/')) {
      await this.authorizeMemberDocumentAccess(key, user);
      return;
    }

    if (key.startsWith('uploads/profiles/')) {
      await this.authorizeProfilePhotoAccess(key, user);
      return;
    }

    if (key.startsWith('uploads/payment-proofs/')) {
      await this.authorizePaymentProofAccess(key, user);
      return;
    }

    if (key.startsWith('uploads/stock-requests/')) {
      await this.authorizeStockRequestPaymentProofAccess(key, user);
      return;
    }

    if (key.startsWith('lab-results/')) {
      await this.authorizeLabResultAccess(key, user);
      return;
    }

    throw {
      status: 403,
      code: 'FILE_ACCESS_DENIED',
      message: 'Anda tidak memiliki akses ke file ini',
    };
  }

  private async authorizeProfilePhotoAccess(key: string, user: AuthUser): Promise<void> {
    // Profile photos are stored as: uploads/profiles/{userId}/avatar-xxx.ext
    // Extract userId from the path
    const match = key.match(/uploads\/profiles\/([^/]+)\//);
    if (!match) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    const fileOwnerId = match[1];

    // User can access their own profile photo
    if (user.userId === fileOwnerId) {
      return;
    }

    // Check if the profile photo exists in database
    const profile = await prisma.userProfile.findFirst({
      where: {
        userId: fileOwnerId,
        OR: [
          { avatarUrl: key },
          { avatarUrl: `${env.API_PREFIX}/files/${key}` },
          { avatarUrl: `${env.API_URL}${env.API_PREFIX}/files/${key}` },
          { avatarUrl: `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}` },
          { avatarUrl: { endsWith: key } },
        ],
      },
      select: {
        userId: true,
        user: {
          select: {
            role: true,
            branchId: true,
            member: {
              select: {
                registrationBranchId: true,
                branchAccesses: {
                  select: { branchId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    // MEMBER can only access their own profile photo (already checked above)
    if (user.role === 'MEMBER') {
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }

    // Staff can access profile photos of members in their branch
    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (!accessibleBranchIds) {
      return; // Privileged role has access to all
    }

    // If the profile owner is a member, check branch access
    if (profile.user.member) {
      const memberBranchIds = [
        profile.user.member.registrationBranchId,
        ...profile.user.member.branchAccesses.map((access) => access.branchId),
      ];

      const hasAccess = memberBranchIds.some((branchId) => accessibleBranchIds.includes(branchId));
      if (hasAccess) {
        return;
      }
    }

    // If the profile owner is staff, check if they share a branch
    if (profile.user.branchId && accessibleBranchIds.includes(profile.user.branchId)) {
      return;
    }

    throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
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

  private async authorizeSessionSupportingPhotoAccess(key: string, user: AuthUser): Promise<void> {
    const supportingPhoto = await prisma.sessionSupportingPhoto.findFirst({
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

    if (!supportingPhoto) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    if (user.role === 'MEMBER') {
      if (supportingPhoto.session.encounter.member.userId !== user.userId) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
      return;
    }

    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (!accessibleBranchIds || !accessibleBranchIds.includes(supportingPhoto.session.branchId)) {
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

  private async authorizeStockRequestPaymentProofAccess(key: string, user: AuthUser): Promise<void> {
    // Extract requestId from key: uploads/stock-requests/{requestId}/payment-proof-xxx.jpg
    const match = key.match(/uploads\/stock-requests\/([^/]+)\//);
    if (!match) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    const requestId = match[1];

    // Find stock request by ID and verify the payment proof URL matches
    const stockRequest = await prisma.stockRequest.findFirst({
      where: {
        id: requestId,
      },
      select: {
        id: true,
        branchId: true,
        paymentProofUrl: true,
      },
    });

    if (!stockRequest) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    // Verify the key matches the stored payment proof URL
    const storedUrl = stockRequest.paymentProofUrl;
    if (!storedUrl) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    // Check if the key matches the stored URL (handle various URL formats)
    const keyMatches = 
      storedUrl === key ||
      storedUrl === `${env.API_PREFIX}/files/${key}` ||
      storedUrl === `${env.API_URL}${env.API_PREFIX}/files/${key}` ||
      storedUrl.endsWith(key) ||
      storedUrl.includes(key);

    if (!keyMatches) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    // Members cannot access stock request files
    if (user.role === 'MEMBER') {
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }

    // SUPER_ADMIN has access to all files
    if (user.role === 'SUPER_ADMIN') {
      return;
    }

    // For ADMIN_MANAGER, check if they manage this branch
    if (user.role === 'ADMIN_MANAGER') {
      const managerBranch = await prisma.managerBranch.findFirst({
        where: {
          userId: user.userId,
          branchId: stockRequest.branchId,
        },
      });

      if (managerBranch) {
        return; // Manager has access to branches they manage
      }
      
      // Admin Manager doesn't manage this branch
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }

    // For ADMIN_CABANG, check if it's their branch
    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (accessibleBranchIds && accessibleBranchIds.includes(stockRequest.branchId)) {
      return;
    }

    throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
  }

  private async authorizeLabResultAccess(key: string, user: AuthUser): Promise<void> {
    // Lab results are stored as: lab-results/{memberId}/{timestamp}-{filename}
    // Extract memberId from the path
    const match = key.match(/lab-results\/([^/]+)\//);
    if (!match) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    const memberId = match[1];

    // Find lab result by memberId and verify the file URL matches
    const labResult = await prisma.labResult.findFirst({
      where: {
        memberId,
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

    if (!labResult) {
      throw { status: 404, code: 'FILE_NOT_FOUND', message: 'File tidak ditemukan' };
    }

    // Members can only access their own lab results
    if (user.role === 'MEMBER') {
      if (labResult.member.userId !== user.userId) {
        throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
      }
      return;
    }

    // Staff can access lab results of members in their accessible branches
    const accessibleBranchIds = await this.getAccessibleBranchIds(user);
    if (!accessibleBranchIds) {
      return; // Privileged role has access to all
    }

    const memberBranchIds = [
      labResult.member.registrationBranchId,
      ...labResult.member.branchAccesses.map((access) => access.branchId),
    ];

    const hasAccess = memberBranchIds.some((branchId) => accessibleBranchIds.includes(branchId));
    if (!hasAccess) {
      throw { status: 403, code: 'FILE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke file ini' };
    }
  }
}
