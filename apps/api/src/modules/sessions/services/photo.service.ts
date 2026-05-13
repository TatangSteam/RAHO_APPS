import { prisma } from '../../../lib/prisma';
import { uploadFile, deleteFile } from '../../../config/minio';
import { env } from '../../../config/env';
import { v4 as uuidv4 } from 'uuid';

export class PhotoService {
  async uploadPhoto(
    sessionId: string,
    file: Express.Multer.File,
    uploadedBy: string
  ) {
    // Verify session exists
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    // Check if photo already exists
    const existingPhoto = await prisma.sessionPhoto.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    // If exists, delete old file from MinIO
    if (existingPhoto) {
      try {
        // Extract key from URL
        // Old format: http://minio:9000/raho-uploads/session-photos/abc.jpg
        // New format: http://localhost:4000/api/v1/files/session-photos/abc.jpg
        let oldKey: string;
        
        if (existingPhoto.fileUrl.includes('/api/v1/files/')) {
          // New format - extract everything after /files/
          oldKey = existingPhoto.fileUrl.split('/api/v1/files/')[1];
        } else {
          // Old format - extract from MinIO URL
          oldKey = existingPhoto.fileUrl.replace(`${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/`, '');
        }
        
        await deleteFile(oldKey);
      } catch (error) {
        console.error('Error deleting old photo from MinIO:', error);
      }
    }

    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const key = `session-photos/${fileName}`;

    // Upload to MinIO using the minio config helper
    const uploadResult = await uploadFile(file.buffer, key, file.mimetype);

    // Use API endpoint URL instead of direct MinIO URL
    const apiUrl = `${env.API_URL}/api/v1/files/${key}`;

    // Save or update in database
    const photoData = {
      fileUrl: apiUrl, // Use API URL instead of MinIO URL
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy,
    };

    if (existingPhoto) {
      return await prisma.sessionPhoto.update({
        where: { id: existingPhoto.id },
        data: photoData,
      });
    } else {
      return await prisma.sessionPhoto.create({
        data: {
          ...photoData,
          treatmentSessionId: sessionId,
        },
      });
    }
  }

  async deletePhoto(sessionId: string) {
    const photo = await prisma.sessionPhoto.findUnique({
      where: { treatmentSessionId: sessionId },
    });

    if (!photo) {
      throw { status: 404, code: 'PHOTO_NOT_FOUND', message: 'Foto tidak ditemukan' };
    }

    // Delete from MinIO
    try {
      // Extract key from URL
      let key: string;
      
      if (photo.fileUrl.includes('/api/v1/files/')) {
        // New format - extract everything after /files/
        key = photo.fileUrl.split('/api/v1/files/')[1];
      } else {
        // Old format - extract from MinIO URL
        key = photo.fileUrl.replace(`${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/`, '');
      }
      
      await deleteFile(key);
    } catch (error) {
      console.error('Error deleting photo from MinIO:', error);
    }

    // Delete from database
    await prisma.sessionPhoto.delete({
      where: { id: photo.id },
    });

    return { message: 'Foto berhasil dihapus' };
  }

  async getPhoto(sessionId: string) {
    return await prisma.sessionPhoto.findUnique({
      where: { treatmentSessionId: sessionId },
    });
  }
}
