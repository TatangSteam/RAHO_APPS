import { Router } from 'express';
import { FilesController } from './files.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
const controller = new FilesController();

/**
 * Files routes
 * - GET /files/* (authenticated) -> proxy/stream file from private MinIO
 */

router.get('/*', authenticate, controller.serveFile.bind(controller));

export default router;
