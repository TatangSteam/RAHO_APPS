import { prisma } from '../../../lib/prisma';
import { uploadFile, deleteFileByUrl } from '../../../config/minio';
import { env } from '../../../config/env';
import { v4 as uuidv4 } from 'uuid';
import { processFile } from '../../../utils/imageProcessor';
import type { SessionSupportingPhoto } from '@prisma/client';

export interface UploadSupportingPhotoDto {
  file: Express.Multer.File;
  description?: string;
  uploadedBy: string;
}

export interface SupportingPhotoResponse {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  uploadedBy: string;
  createdAt: Date;
  session: {
    sessionCode: string;
    infusKe: number;
    treatmentDate: Date;
  };
}

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getFileExtension(mimeType: string, originalName: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  return originalName.split('.').pop() || 'jpg';
}

export class SupportingPhotosService {
  async uploadSupportingPhoto(
    sessionId: string,
    dto: UploadSupportingPhotoDto,
  ): Promise<SessionSupportingPhoto> {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(dto.file.mimetype)) {
      throw {
        status: 400,
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Tipe file tidak didukung. Gunakan JPG, PNG, atau WEBP',
      };
    }

    if (dto.file.size > MAX_FILE_SIZE) {
      throw {
        status: 400,
        code: 'FILE_TOO_LARGE',
        message: 'Ukuran file maksimal 10MB',
      };
    }

    const processed = await processFile(dto.file.buffer, dto.file.mimetype, 'sessionPhoto');
    const fileExtension = getFileExtension(processed.mimeType, dto.file.originalname);
    const key = `session-supporting-photos/${uuidv4()}.${fileExtension}`;
    const uploadResult = await uploadFile(processed.buffer, key, processed.mimeType);
    const fileUrl = `${env.API_URL}${env.API_PREFIX}/files/${uploadResult.key}`;

    return prisma.sessionSupportingPhoto.create({
      data: {
        treatmentSessionId: sessionId,
        fileUrl,
        fileName: dto.file.originalname,
        fileSize: processed.buffer.length,
        mimeType: processed.mimeType,
        description: dto.description || null,
        uploadedBy: dto.uploadedBy,
      },
    });
  }

  async getSupportingPhotosBySession(sessionId: string): Promise<SupportingPhotoResponse[]> {
    return prisma.sessionSupportingPhoto.findMany({
      where: { treatmentSessionId: sessionId },
      include: {
        session: {
          select: {
            sessionCode: true,
            infusKe: true,
            treatmentDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSupportingPhotosByMember(memberId: string): Promise<SupportingPhotoResponse[]> {
    return prisma.sessionSupportingPhoto.findMany({
      where: {
        session: {
          encounter: {
            memberId,
          },
        },
      },
      include: {
        session: {
          select: {
            sessionCode: true,
            infusKe: true,
            treatmentDate: true,
          },
        },
      },
      orderBy: [
        { session: { infusKe: 'desc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async getSupportingPhotoById(photoId: string): Promise<SupportingPhotoResponse> {
    const photo = await prisma.sessionSupportingPhoto.findUnique({
      where: { id: photoId },
      include: {
        session: {
          select: {
            sessionCode: true,
            infusKe: true,
            treatmentDate: true,
          },
        },
      },
    });

    if (!photo) {
      throw {
        status: 404,
        code: 'SUPPORTING_PHOTO_NOT_FOUND',
        message: 'Foto penunjang tidak ditemukan',
      };
    }

    return photo;
  }

  async deleteSupportingPhoto(photoId: string, _userId: string): Promise<void> {
    const photo = await prisma.sessionSupportingPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw {
        status: 404,
        code: 'SUPPORTING_PHOTO_NOT_FOUND',
        message: 'Foto penunjang tidak ditemukan',
      };
    }

    try {
      await deleteFileByUrl(photo.fileUrl);
    } catch (error) {
      console.error('Failed to delete supporting photo from MinIO:', error);
    }

    await prisma.sessionSupportingPhoto.delete({
      where: { id: photoId },
    });
  }

  async updateSupportingPhotoDescription(
    photoId: string,
    description: string,
  ): Promise<SessionSupportingPhoto> {
    const photo = await prisma.sessionSupportingPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw {
        status: 404,
        code: 'SUPPORTING_PHOTO_NOT_FOUND',
        message: 'Foto penunjang tidak ditemukan',
      };
    }

    return prisma.sessionSupportingPhoto.update({
      where: { id: photoId },
      data: { description: description || null },
    });
  }
}
