import { Router } from 'express';
import { PackagesController } from './packages.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();
const controller = new PackagesController();

// All routes require authentication
router.use(authenticate);

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
