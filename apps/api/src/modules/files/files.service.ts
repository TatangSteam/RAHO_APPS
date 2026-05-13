import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/minio';
import { env } from '../../config/env';
import { Readable } from 'stream';

export class FilesService {
  /**
   * Get file from MinIO and return as stream
   */
  async getFile(key: string) {
    try {
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
}
