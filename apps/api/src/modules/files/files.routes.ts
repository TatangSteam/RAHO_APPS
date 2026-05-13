import { Router } from 'express';
import { FilesController } from './files.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
const controller = new FilesController();

/**
 * Files routes
 * - GET /files/presign/* (authenticated) -> returns presigned URL
 * - GET /files/* (authenticated) -> proxy/stream file from MinIO
 */

// Presign endpoint — authenticated users only. Example: GET /files/presign/session-photos/abc.jpg
router.get('/presign/*', authenticate, controller.presignFile.bind(controller));

// Serve file via API (require authentication). Keep this after the presign route.
router.get('/*', authenticate, controller.serveFile.bind(controller));

export default router;
