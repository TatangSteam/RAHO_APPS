import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { StockRequestController } from './stock-request.controller';
import { ShipmentController } from './shipment.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();
const inventoryController = new InventoryController();
const stockRequestController = new StockRequestController();
const shipmentController = new ShipmentController();

const ALLSTAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_CABANG];

// ============================================================
// INVENTORY ITEMS
// ============================================================

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

// ============================================================
// STOCK REQUESTS
// ============================================================

// Create stock request
router.post(
  '/stock-requests',
  authenticate,
  authorize(ADMIN_ROLES),
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

// Approve stock request
router.post(
  '/stock-requests/:requestId/approve',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  stockRequestController.approveRequest.bind(stockRequestController)
);

// Reject stock request
router.post(
  '/stock-requests/:requestId/reject',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  stockRequestController.rejectRequest.bind(stockRequestController)
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

// Ship shipment (SUPER_ADMIN only)
router.post(
  '/shipments/:shipmentId/ship',
  authenticate,
  authorize([Role.SUPER_ADMIN]),
  shipmentController.shipShipment.bind(shipmentController)
);

// Receive shipment (ADMIN_CABANG or higher)
router.post(
  '/shipments/:shipmentId/receive',
  authenticate,
  authorize(ADMIN_ROLES),
  shipmentController.receiveShipment.bind(shipmentController)
);

// Approve shipment (ADMIN_CABANG or higher)
router.post(
  '/shipments/:shipmentId/approve',
  authenticate,
  authorize(ADMIN_ROLES),
  shipmentController.approveShipment.bind(shipmentController)
);

export default router;
