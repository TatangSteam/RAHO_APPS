import { Router } from 'express';
import { FilesController } from './files.controller';

const router = Router();
const controller = new FilesController();

/**
 * GET /files/*
 * Serve any file from MinIO
 * Public endpoint - no authentication required for file serving
 * 
 * Examples:
 * - GET /files/session-photos/abc123.jpg
 * - GET /files/payment-proofs/xyz789.pdf
 * - GET /files/member-photos/def456.png
 */
router.get('/*', controller.serveFile.bind(controller));

export default router;
