import { Request, Response, NextFunction } from 'express';
import { FilesService } from './files.service';

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
      const filePath = req.params[0]; // This captures everything after /files/

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_PATH',
            message: 'File path is required',
          },
        });
      }

      const result = await this.filesService.getFile(filePath, req.user!);

      // Set appropriate headers
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Length', result.contentLength);
      res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
      res.setHeader('ETag', result.etag);
      
      // CORS headers for blob/stream responses (needed for cross-origin fetch with responseType: blob)
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Stream the file
      result.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}
