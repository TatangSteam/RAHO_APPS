import { Router } from 'express';
import { authenticate } from '@middleware/authenticate';
import { authorize } from '@middleware/authorize';
import { upload } from '@middleware/upload';
import { getMemberDashboard, getMemberSessions, getMemberSessionDetail, getMemberDiagnoses, getMemberPackages,  getMemberProfile,
  getMemberInvoices, getMemberInvoiceDetail, uploadPaymentProof } from './me.controller';

const router = Router();

/**
 * @route  GET /me/dashboard
 * @desc   Dashboard untuk MEMBER (read-only)
 * @access Bearer (MEMBER only)
 */
router.get(
  '/dashboard',
  authenticate,
  authorize(['MEMBER']),
  getMemberDashboard,
);

/**
 * @route  GET /me/sessions
 * @desc   List sesi terapi member
 * @access Bearer (MEMBER only)
 */
router.get(
  '/sessions',
  authenticate,
  authorize(['MEMBER']),
  getMemberSessions,
);

/**
 * @route  GET /me/sessions/:sessionId
 * @desc   Detail sesi terapi member (read-only)
 * @access Bearer (MEMBER only)
 */
router.get(
  '/sessions/:sessionId',
  authenticate,
  authorize(['MEMBER']),
  getMemberSessionDetail,
);

/**
 * @route  GET /me/diagnoses
 * @desc   List diagnosa member
 * @access Bearer (MEMBER only)
 */
router.get(
  '/diagnoses',
  authenticate,
  authorize(['MEMBER']),
  getMemberDiagnoses,
);

/**
 * @route  GET /me/vouchers
 * @desc   List paket member
 * @access Bearer (MEMBER only)
 */
router.get(
  '/vouchers',
  authenticate,
  authorize(['MEMBER']),
  getMemberPackages,
);
router.get(
    '/profile',   
    authenticate, 
    authorize(['MEMBER']), 
    getMemberProfile)
router.get(
    '/invoices',   
    authenticate, 
    authorize(['MEMBER']), 
    getMemberInvoices)

/**
 * @route  GET /me/invoices/:invoiceId
 * @desc   Detail invoice member (full data for PDF)
 * @access Bearer (MEMBER only)
 */
router.get(
    '/invoices/:invoiceId',   
    authenticate, 
    authorize(['MEMBER']), 
    getMemberInvoiceDetail)

/**
 * @route  POST /me/packages/:packageId/upload-payment-proof
 * @desc   Upload bukti pembayaran untuk paket
 * @access Bearer (MEMBER only)
 */
router.post(
    '/packages/:packageId/upload-payment-proof',
    authenticate,
    authorize(['MEMBER']),
    upload.single('paymentProof'),
    uploadPaymentProof
);

export { router as meRouter };