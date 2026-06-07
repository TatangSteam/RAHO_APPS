import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { StockRequestController } from './stock-request.controller';
import { ShipmentController } from './shipment.controller';
import { OverstockController } from './overstock.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadPaymentProof } from '../../middleware/upload';
import { Role } from '@prisma/client';

const router = Router();
const inventoryController = new InventoryController();
const stockRequestController = new StockRequestController();
const shipmentController = new ShipmentController();
const overstockController = new OverstockController();

const ALLSTAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG];
const MANAGER_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER];

// ============================================================
// MASTER PRODUCTS (for inventory modal)
// ============================================================

// Get master products for inventory modal (accessible by ADMIN_ROLES)
router.get(
  '/master-products',
  authenticate,
  authorize(ADMIN_ROLES),
  inventoryController.getMasterProducts.bind(inventoryController)
);

// ============================================================
// INVENTORY ITEMS
// ============================================================

// Get available inventory items with stock info (for material usage form)
router.get(
  '/available/:branchId',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getAvailableItems.bind(inventoryController)
);

// Get all inventory items for a branch
router.get(
  '/items',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getInventoryItems.bind(inventoryController)
);

// Get inventory item by ID
router.get(
  '/items/:itemId',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getInventoryItemById.bind(inventoryController)
);

// Create new inventory item
router.post(
  '/items',
  authenticate,
  authorize(ADMIN_ROLES),
  inventoryController.createInventoryItem.bind(inventoryController)
);

// Batch create inventory items
router.post(
  '/items/batch',
  authenticate,
  authorize(ADMIN_ROLES),
  inventoryController.batchCreateInventoryItems.bind(inventoryController)
);

// Update inventory item
router.patch(
  '/items/:itemId',
  authenticate,
  authorize(ADMIN_ROLES),
  inventoryController.updateInventoryItem.bind(inventoryController)
);

// Delete inventory item
router.delete(
  '/items/:itemId',
  authenticate,
  authorize(ADMIN_ROLES),
  inventoryController.deleteInventoryItem.bind(inventoryController)
);

// Get low stock items for a branch
router.get(
  '/low-stock/:branchId',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getLowStockItems.bind(inventoryController)
);

// Adjust stock (SUPER_ADMIN, ADMIN_MANAGER, or ADMIN_CABANG)
router.patch(
  '/items/:itemId/adjust-stock',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG]),
  inventoryController.adjustStock.bind(inventoryController)
);

// Update master product conversion factor (ADMIN_CABANG only)
router.patch(
  '/master-products/:productId',
  authenticate,
  authorize([Role.ADMIN_CABANG]),
  inventoryController.updateMasterProduct.bind(inventoryController)
);

// ============================================================
// EXPORT INVENTORY
// ============================================================

// Export inventory to CSV
router.get(
  '/export/csv',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.exportToCSV.bind(inventoryController)
);

// Export inventory to Excel
router.get(
  '/export/excel',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.exportToExcel.bind(inventoryController)
);

// ============================================================
// STOCK MUTATIONS
// ============================================================

// Get stock mutations with filters
router.get(
  '/stock-mutations',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getStockMutations.bind(inventoryController)
);

// Export stock mutations to Excel
router.get(
  '/stock-mutations/export',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.exportStockMutations.bind(inventoryController)
);

// ============================================================
// STOCK REQUESTS
// ============================================================

// Get pending review requests (for dashboard) - must be before :requestId route
router.get(
  '/stock-requests/pending-review',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.getPendingReviewRequests.bind(stockRequestController)
);

// Create stock request (ADMIN_CABANG only)
router.post(
  '/stock-requests',
  authenticate,
  authorize([Role.ADMIN_CABANG]),
  stockRequestController.createRequest.bind(stockRequestController)
);

// Get stock requests
router.get(
  '/stock-requests',
  authenticate,
  authorize(ADMIN_ROLES),
  stockRequestController.getRequests.bind(stockRequestController)
);

// Get stock request by ID
router.get(
  '/stock-requests/:requestId',
  authenticate,
  authorize(ADMIN_ROLES),
  stockRequestController.getRequestById.bind(stockRequestController)
);

// Approve stock request for PREMIER branch
router.post(
  '/stock-requests/:requestId/approve-premier',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.approvePremierRequest.bind(stockRequestController)
);

// Create invoice for PARTNERSHIP branch
router.post(
  '/stock-requests/:requestId/create-invoice',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.createPartnershipInvoice.bind(stockRequestController)
);

// Upload payment proof (ADMIN_MANAGER / SUPER_ADMIN - receives proof from Admin Cabang externally)
router.post(
  '/stock-requests/:requestId/upload-payment-proof',
  authenticate,
  authorize(MANAGER_ROLES),
  uploadPaymentProof.single('paymentProof'),
  stockRequestController.uploadPaymentProof.bind(stockRequestController)
);

// Confirm payment (ADMIN_MANAGER / SUPER_ADMIN)
router.post(
  '/stock-requests/:requestId/confirm-payment',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.confirmPayment.bind(stockRequestController)
);

// Reject payment (ADMIN_MANAGER / SUPER_ADMIN)
router.post(
  '/stock-requests/:requestId/reject-payment',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.rejectPayment.bind(stockRequestController)
);

// Reject stock request
router.post(
  '/stock-requests/:requestId/reject',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.rejectRequest.bind(stockRequestController)
);

// Legacy approve endpoint (for backward compatibility)
router.post(
  '/stock-requests/:requestId/approve',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.approveRequest.bind(stockRequestController)
);

// ============================================================
// SHIPMENTS
// ============================================================

// Get shipments
router.get(
  '/shipments',
  authenticate,
  authorize(ADMIN_ROLES),
  shipmentController.getShipments.bind(shipmentController)
);

// Get shipment by ID
router.get(
  '/shipments/:shipmentId',
  authenticate,
  authorize(ADMIN_ROLES),
  shipmentController.getShipmentById.bind(shipmentController)
);

// Ship shipment (SUPER_ADMIN and ADMIN_MANAGER)
router.post(
  '/shipments/:shipmentId/ship',
  authenticate,
  authorize(MANAGER_ROLES),
  shipmentController.shipShipment.bind(shipmentController)
);

// Receive shipment (ADMIN_CABANG)
router.post(
  '/shipments/:shipmentId/receive',
  authenticate,
  authorize([Role.ADMIN_CABANG]),
  shipmentController.receiveShipment.bind(shipmentController)
);

// Legacy approve shipment endpoint (for backward compatibility)
router.post(
  '/shipments/:shipmentId/approve',
  authenticate,
  authorize(ADMIN_ROLES),
  shipmentController.approveShipment.bind(shipmentController)
);

// ============================================================
// OVERSTOCK
// ============================================================

// Get overstock for a branch
router.get(
  '/overstock',
  authenticate,
  authorize(ADMIN_ROLES),
  overstockController.getOverstock.bind(overstockController)
);

// Get overstock summary for a branch
router.get(
  '/overstock/summary',
  authenticate,
  authorize(ADMIN_ROLES),
  overstockController.getOverstockSummary.bind(overstockController)
);

// Preview overstock deduction for stock request items
router.post(
  '/overstock/preview',
  authenticate,
  authorize(ADMIN_ROLES),
  overstockController.previewOverstockDeduction.bind(overstockController)
);

// Get available overstock quantity for a specific product
router.get(
  '/overstock/available/:branchId/:masterProductId',
  authenticate,
  authorize(ADMIN_ROLES),
  overstockController.getAvailableOverstock.bind(overstockController)
);

export default router;
