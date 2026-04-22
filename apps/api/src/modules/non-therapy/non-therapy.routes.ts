import { Router } from 'express';
import { NonTherapyController } from './non-therapy.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();
const controller = new NonTherapyController();

// ============================================================
// PRODUCT MANAGEMENT ROUTES
// ============================================================

// Get all products (all staff can view)
router.get(
  '/products',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE']),
  controller.getAllProducts.bind(controller)
);

// Get product by ID
router.get(
  '/products/:productId',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE']),
  controller.getProductById.bind(controller)
);

// Create product (admin only)
router.post(
  '/products',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  controller.createProduct.bind(controller)
);

// Update product (admin only)
router.patch(
  '/products/:productId',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  controller.updateProduct.bind(controller)
);

// Delete product (admin only)
router.delete(
  '/products/:productId',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER']),
  controller.deleteProduct.bind(controller)
);

// ============================================================
// MEMBER PURCHASE ROUTES
// ============================================================

// Assign product to member
router.post(
  '/members/:memberId/purchases',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  controller.assignToMember.bind(controller)
);

// Get member's purchases
router.get(
  '/members/:memberId/purchases',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE']),
  controller.getMemberPurchases.bind(controller)
);

// Verify purchase payment
router.patch(
  '/purchases/:purchaseId/verify',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN']),
  controller.verifyPurchase.bind(controller)
);

export default router;
