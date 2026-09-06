import { Router } from 'express';
import { PackagesController } from './packages.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadPaymentProof } from '../../middleware/upload';
import { requirePermission } from '../../middleware/requirePermission';
import { PERMISSIONS } from '../iam/permission-catalog';

const router = Router();
const controller = new PackagesController();

// NOTE: Authentication is applied per-route below, not globally
// This prevents double authentication when mounted at root path

// Upload payment proof (ONLY JPEG/JPG)
router.post(
  '/packages/payment-proof/upload',
  authenticate,
  requirePermission(PERMISSIONS.INVOICE_PAYMENT),
  uploadPaymentProof.single('file'),
  controller.uploadPaymentProof.bind(controller)
);

// Package refund (ACTIVE → CANCELLED)
router.post(
  '/packages/:packageId/refund',
  authenticate,
  requirePermission(PERMISSIONS.INVOICE_CANCEL),
  uploadPaymentProof.single('refundProof'),
  controller.refundPackage.bind(controller)
);

// Package cancel (PENDING_PAYMENT → CANCELLED)
router.post(
  '/packages/:packageId/cancel',
  authenticate,
  requirePermission(PERMISSIONS.INVOICE_CANCEL),
  controller.cancelPackage.bind(controller)
);

// Package edit (Super Admin/Admin Manager can also edit waiting/active packages)
router.put(
  '/packages/:packageId',
  authenticate,
  requirePermission(PERMISSIONS.INVOICE_UPDATE),
  controller.editPackage.bind(controller)
);

// Administrative BASIC/BOOSTER voucher balance adjustment
router.patch(
  '/packages/:packageId/voucher-balance',
  authenticate,
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  requirePermission(PERMISSIONS.INVOICE_UPDATE),
  controller.adjustVoucherBalance.bind(controller)
);

// Package payment verification
router.patch(
  '/packages/:packageId/verify',
  authenticate,
  requirePermission(PERMISSIONS.INVOICE_PAYMENT),
  controller.verifyPayment.bind(controller)
);

// Package payment rejection
router.patch(
  '/packages/:packageId/reject',
  authenticate,
  requirePermission(PERMISSIONS.INVOICE_PAYMENT),
  controller.rejectPayment.bind(controller)
);

// Package pricing management (ADMIN_MANAGER+)
router.get(
  '/package-pricings',
  authenticate,
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  controller.getPackagePricings.bind(controller)
);

router.post(
  '/package-pricings',
  authenticate,
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.createPackagePricing.bind(controller)
);

router.patch(
  '/package-pricings/:pricingId',
  authenticate,
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.updatePackagePricing.bind(controller)
);

router.delete(
  '/package-pricings/:pricingId',
  authenticate,
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.deletePackagePricing.bind(controller)
);

export default router;
