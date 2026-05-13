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
}
