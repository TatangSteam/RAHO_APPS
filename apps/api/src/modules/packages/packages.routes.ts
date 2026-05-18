import { Router } from 'express';
import { PackagesController } from './packages.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadPaymentProof } from '../../middleware/upload';

const router = Router();
const controller = new PackagesController();

// NOTE: Authentication is applied per-route below, not globally
// This prevents double authentication when mounted at root path

// Upload payment proof (ONLY JPEG/JPG)
router.post(
  '/packages/payment-proof/upload',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  uploadPaymentProof.single('file'),
  controller.uploadPaymentProof.bind(controller)
);

// Package refund (ACTIVE → CANCELLED)
router.post(
  '/packages/:packageId/refund',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  uploadPaymentProof.single('refundProof'),
  controller.refundPackage.bind(controller)
);

// Package cancel (PENDING_PAYMENT → CANCELLED)
router.post(
  '/packages/:packageId/cancel',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.cancelPackage.bind(controller)
);

// Package edit (PENDING_PAYMENT only)
router.put(
  '/packages/:packageId',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.editPackage.bind(controller)
);

// Package payment verification
router.patch(
  '/packages/:packageId/verify',
  authenticate,
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.verifyPayment.bind(controller)
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
