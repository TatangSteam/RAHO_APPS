import { Router } from 'express';
import { invoiceController } from './invoices.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================
// INVOICE ROUTES
// ============================================================

// Create invoice (ADMIN, STAFF)
router.post(
  '/',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  invoiceController.createInvoice
);

// Get invoice by package ID (ADMIN, STAFF, MEMBER) - MUST BE BEFORE /:invoiceId
router.get(
  '/package/:packageId',
  invoiceController.getInvoiceByPackageId
);

// Get member's invoices (ADMIN, STAFF, MEMBER) - MUST BE BEFORE /:invoiceId
router.get(
  '/member/:memberId',
  invoiceController.getMemberInvoices
);

// Get invoice by ID (ADMIN, STAFF) - MUST BE AFTER specific routes
router.get(
  '/:invoiceId',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  invoiceController.getInvoiceById
);

// Update invoice (ADMIN, STAFF)
router.patch(
  '/:invoiceId',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  invoiceController.updateInvoice
);

// Finalize invoice (ADMIN, STAFF)
router.post(
  '/:invoiceId/finalize',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  invoiceController.finalizeInvoice
);

// Record payment (ADMIN, STAFF)
router.post(
  '/:invoiceId/payment',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  invoiceController.recordPayment
);

// Cancel invoice (ADMIN, STAFF)
router.post(
  '/:invoiceId/cancel',
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG, Role.ADMIN_LAYANAN]),
  invoiceController.cancelInvoice
);

export default router;
