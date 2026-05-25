import { prisma } from '../../../lib/prisma';
import { uploadFile, deleteFile } from '../../../config/minio';
import { env } from '../../../config/env';
import { v4 as uuidv4 } from 'uuid';
import { processFile, isImage } from '../../../utils/imageProcessor';

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

    // Process and compress image
    console.log(`[PhotoService] Processing session photo: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB)`);
    const processed = await processFile(file.buffer, file.mimetype, 'sessionPhoto');

    // Generate unique filename with correct extension
    const fileExtension = processed.mimeType === 'image/jpeg' ? 'jpg' : 
                          processed.mimeType === 'image/webp' ? 'webp' : 
                          processed.mimeType === 'image/png' ? 'png' : 
                          file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const key = `session-photos/${fileName}`;

    // Upload processed image to MinIO
    const uploadResult = await uploadFile(processed.buffer, key, processed.mimeType);

    // Use API endpoint URL instead of direct MinIO URL
    const apiUrl = `${env.API_URL}/api/v1/files/${key}`;

    // Save or update in database with processed file info
    const photoData = {
      fileUrl: apiUrl,
      fileName: file.originalname,
      fileSize: processed.buffer.length, // Use compressed size
      mimeType: processed.mimeType,
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
