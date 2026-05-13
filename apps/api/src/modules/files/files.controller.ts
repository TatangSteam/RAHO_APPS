import { Request, Response, NextFunction } from 'express';
import { FilesService } from './files.service';
import { extractKeyFromUrl } from '../../config/minio';

export class FilesController {
  private filesService: FilesService;

  constructor() {
    this.filesService = new FilesService();
  }

  /**
   * GET /files/*
   * Serve file from MinIO through API (proxy)
   */
  async serveFile(req: Request, res: Response, next: NextFunction) {
    try {
      // Get the full path after /files/
      let filePath = req.params[0]; // This captures everything after /files/

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_PATH',
            message: 'File path is required',
          },
        });
      }

      // Decode the file path in case it was URL-encoded
      filePath = decodeURIComponent(filePath);

      // If the filePath is a full URL (starts with http:// or https://), extract the key
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        console.log('🔍 [Files] Extracting key from full URL:', filePath);
        filePath = extractKeyFromUrl(filePath);
        console.log('🔍 [Files] Extracted key:', filePath);
      }

      const result = await this.filesService.getFile(filePath);

      // Set appropriate headers
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Length', result.contentLength);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('ETag', result.etag);

      // Stream the file
      result.stream.pipe(res);
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * GET /files/presign/*
   * Return a short-lived presigned URL for an object in MinIO.
   * This endpoint requires authentication — the client must call it
   * using their Bearer token and then set the returned URL on the
   * <img> element or use it directly.
   */
  async presignFile(req: Request, res: Response, next: NextFunction) {
    try {
      // req.params[0] will contain the path after /presign/
      let key = req.params[0];

      if (!key) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE_PATH', message: 'File path is required' },
        });
      }

      // Decode the key in case it was URL-encoded by the client
      key = decodeURIComponent(key);

      // If the key is a full URL (starts with http:// or https://), extract the key
      if (key.startsWith('http://') || key.startsWith('https://')) {
        console.log('🔍 [Files] Extracting key from full URL:', key);
        key = extractKeyFromUrl(key);
        console.log('🔍 [Files] Extracted key:', key);
      }

      // Optional: allow client to request a custom expiry via query, capped
      const expires = Math.min(3600, Math.max(10, Number(req.query.expires) || 60));

      const url = await this.filesService.getPresignedUrl(key, expires);

      return res.json({ success: true, data: { url } });
    } catch (err: any) {
      next(err);
    }
  }
}
