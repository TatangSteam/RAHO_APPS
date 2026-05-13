import { Router } from 'express';
import { PackagesController } from './packages.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadPaymentProof } from '../../middleware/upload';

const router = Router();
const controller = new PackagesController();

// All routes require authentication
router.use(authenticate);

// Upload payment proof (ONLY JPEG/JPG)
router.post(
  '/packages/payment-proof/upload',
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  uploadPaymentProof.single('file'),
  controller.uploadPaymentProof.bind(controller)
);

// Package refund (ACTIVE → CANCELLED)
router.post(
  '/packages/:packageId/refund',
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  uploadPaymentProof.single('refundProof'),
  controller.refundPackage.bind(controller)
);

// Package cancel (PENDING_PAYMENT → CANCELLED)
router.post(
  '/packages/:packageId/cancel',
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.cancelPackage.bind(controller)
);

// Package edit (PENDING_PAYMENT only)
router.put(
  '/packages/:packageId',
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.editPackage.bind(controller)
);

// Package payment verification
router.patch(
  '/packages/:packageId/verify',
  authorize(['ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.verifyPayment.bind(controller)
);

// Package pricing management (ADMIN_MANAGER+)
router.get(
  '/package-pricings',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  controller.getPackagePricings.bind(controller)
);

router.post(
  '/package-pricings',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.createPackagePricing.bind(controller)
);

router.patch(
  '/package-pricings/:pricingId',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.updatePackagePricing.bind(controller)
);

router.delete(
  '/package-pricings/:pricingId',
  authorize(['ADMIN_MANAGER', 'SUPER_ADMIN']),
  controller.deletePackagePricing.bind(controller)
);

export default router;
