import { Router } from 'express';
import { invoiceController } from './invoices.controller';
import { authenticate } from '../../middleware/authenticate';
import { uploadPaymentProof } from '../../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================
// INVOICE ROUTES
// ============================================================

// Get invoices (ADMIN, STAFF)
router.get(
  '/',
  invoiceController.getInvoices
);

// Create invoice (ADMIN, STAFF)
router.post(
  '/',
  invoiceController.createInvoice
);

// Get payment proof image (ADMIN, STAFF, MEMBER) - MUST BE BEFORE /:invoiceId
router.get(
  '/payment-proof/:paymentId',
  invoiceController.getPaymentProofImage
);

router.post('/payments/:paymentId/verify', invoiceController.verifyPayment);
router.post('/payments/:paymentId/reject', invoiceController.rejectPayment);

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
  invoiceController.getInvoiceById
);

// Update invoice (ADMIN, STAFF)
router.patch(
  '/:invoiceId',
  invoiceController.updateInvoice
);

// Finalize invoice (ADMIN, STAFF)
router.post(
  '/:invoiceId/finalize',
  invoiceController.finalizeInvoice
);

// Record payment (ADMIN, STAFF)
router.post(
  '/:invoiceId/payment',
  uploadPaymentProof.single('proof'),
  invoiceController.recordPayment
);

// Cancel invoice (ADMIN, STAFF)
router.post(
  '/:invoiceId/cancel',
  invoiceController.cancelInvoice
);

export default router;
