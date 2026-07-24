import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { StockRequestController } from './stock-request.controller';
import { ShipmentController } from './shipment.controller';
import { OverstockController } from './overstock.controller';
import { LogisticsController } from './logistics.controller';
import { InventoryMasterController } from './inventory-master.controller';
import { InventoryLedgerController } from './inventory-ledger.controller';
import { StockReservationController } from './stock-reservation.controller';
import { GoodsReceiptController } from './goods-receipt.controller';
import { TreatmentBomController } from './treatment-bom.controller';
import { InventoryControlController } from './inventory-control.controller';
import { LogisticsReportController } from './logistics-report.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate, validateQuery } from '../../middleware/validate';
import { uploadPaymentProof, uploadShipmentReceipt } from '../../middleware/upload';
import { Role } from '@prisma/client';
import { requirePermission } from '../../middleware/requirePermission';
import { PERMISSIONS } from '../iam/permission-catalog';
import {
  canManageCentralStock,
  canReceiveBranchStock,
  canRequestBagStock,
  canShipStock,
  logisticStaffRoles,
  superAdminOnly,
} from './logistics.access';
import {
  addHomecareTeamMemberSchema,
  assignHomecareBagSchema,
  approveBagStockRequestSchema,
  approveStockRequestSchema,
  createBagOpnameSchema,
  createBagStockRequestSchema,
  createBranchStockRequestSchema,
  createHomecareBagSchema,
  createHomecareTeamSchema,
  getCentralStockQuerySchema,
  receiveBagShipmentSchema,
  receiveShipmentSchema,
  rejectBagStockRequestSchema,
  rejectStockRequestSchema,
  removeHomecareTeamMemberSchema,
  returnBagStockSchema,
  shipBagStockSchema,
  shipStockSchema,
  useBagStockSchema,
} from './logistics.schema';
import {
  goodsReceiptListQuerySchema,
  postGoodsReceiptSchema,
  purchaseOrderListQuerySchema,
} from './goods-receipt.schema';

const router = Router();
const inventoryController = new InventoryController();
const stockRequestController = new StockRequestController();
const shipmentController = new ShipmentController();
const overstockController = new OverstockController();
const logisticsController = new LogisticsController();
const inventoryMasterController = new InventoryMasterController();
const inventoryLedgerController = new InventoryLedgerController();
const stockReservationController = new StockReservationController();
const goodsReceiptController = new GoodsReceiptController();
const treatmentBomController = new TreatmentBomController();
const inventoryControlController = new InventoryControlController();
const logisticsReportController = new LogisticsReportController();

const ALLSTAFF: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_MANAGER,
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.ADMIN_LOGISTIK,
  Role.DOCTOR,
  Role.NURSE,
];

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_LOGISTIK, Role.ADMIN_CABANG];
const MANAGER_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_MANAGER, Role.ADMIN_LOGISTIK];

// Sprint 9 inventory control: approval-based adjustment and locked stock opname.
router.get('/controls/adjustment-reasons', authenticate, requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_READ), inventoryControlController.reasons.bind(inventoryControlController));
router.get('/controls/adjustments', authenticate, requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_READ), inventoryControlController.listAdjustments.bind(inventoryControlController));
router.post('/controls/adjustments', authenticate, requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE), inventoryControlController.createAdjustment.bind(inventoryControlController));
router.post('/controls/adjustments/:id/submit', authenticate, requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE), inventoryControlController.submitAdjustment.bind(inventoryControlController));
router.post('/controls/adjustments/:id/decision', authenticate, requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_APPROVE), inventoryControlController.decideAdjustment.bind(inventoryControlController));
router.post('/controls/adjustments/:id/post', authenticate, requirePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_POST), inventoryControlController.postAdjustment.bind(inventoryControlController));
router.get('/controls/stock-opnames', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_READ), inventoryControlController.listOpnames.bind(inventoryControlController));
router.post('/controls/stock-opnames', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_COUNT), inventoryControlController.startOpname.bind(inventoryControlController));
router.patch('/controls/stock-opnames/:id/count', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_COUNT), inventoryControlController.countOpname.bind(inventoryControlController));
router.post('/controls/stock-opnames/:id/submit', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_COUNT), inventoryControlController.submitOpname.bind(inventoryControlController));
router.post('/controls/stock-opnames/:id/decision', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_APPROVE), inventoryControlController.decideOpname.bind(inventoryControlController));
router.post('/controls/stock-opnames/:id/post', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_POST), inventoryControlController.postOpname.bind(inventoryControlController));
router.post('/controls/stock-opnames/:id/cancel', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPNAME_COUNT), inventoryControlController.cancelOpname.bind(inventoryControlController));
router.post('/shipment-discrepancies/:id/resolve', authenticate, requirePermission(PERMISSIONS.INVENTORY_DISCREPANCY_RESOLVE), inventoryControlController.resolveDiscrepancy.bind(inventoryControlController));
router.post('/homecare-multi-bag-usages/complete', authenticate, requirePermission(PERMISSIONS.HOMECARE_MULTI_BAG_COMPLETE), inventoryControlController.completeMultiBagUsage.bind(inventoryControlController));

// ============================================================
// MASTER PRODUCTS (for inventory modal)
// ============================================================

// Reading master products is operational access; mutations require manage access.
router.get(
  '/master-products',
  authenticate,
  requirePermission(PERMISSIONS.INVENTORY_READ),
  inventoryController.getMasterProducts.bind(inventoryController)
);

router.post(
  '/master-products',
  authenticate,
  requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE),
  inventoryMasterController.createProduct.bind(inventoryMasterController)
);

router.patch(
  '/master-products/:productId',
  authenticate,
  requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE),
  inventoryMasterController.updateProduct.bind(inventoryMasterController)
);

// ============================================================
// INVENTORY MASTER DATA
// ============================================================

router.get('/warehouses', authenticate, authorize(ALLSTAFF), inventoryMasterController.listWarehouses.bind(inventoryMasterController));
router.post('/warehouses', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.createWarehouse.bind(inventoryMasterController));
router.patch('/warehouses/:id', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.updateWarehouse.bind(inventoryMasterController));
router.delete('/warehouses/:id', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.deactivateWarehouse.bind(inventoryMasterController));

router.get('/stock-locations', authenticate, authorize(ALLSTAFF), inventoryMasterController.listLocations.bind(inventoryMasterController));
router.post('/stock-locations', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.createLocation.bind(inventoryMasterController));
router.patch('/stock-locations/:id', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.updateLocation.bind(inventoryMasterController));
router.delete('/stock-locations/:id', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.deactivateLocation.bind(inventoryMasterController));

router.get('/uoms', authenticate, authorize(ALLSTAFF), inventoryMasterController.listUoms.bind(inventoryMasterController));
router.post('/uoms', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.createUom.bind(inventoryMasterController));
router.patch('/uoms/:id', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.updateUom.bind(inventoryMasterController));
router.post('/conversions/preview', authenticate, authorize(ALLSTAFF), inventoryMasterController.previewConversion.bind(inventoryMasterController));

router.get('/batches', authenticate, authorize(ALLSTAFF), inventoryMasterController.listBatches.bind(inventoryMasterController));
router.post('/batches', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.createBatch.bind(inventoryMasterController));
router.patch('/batches/:id', authenticate, requirePermission(PERMISSIONS.INVENTORY_MASTER_MANAGE), inventoryMasterController.updateBatch.bind(inventoryMasterController));

// ============================================================
// TREATMENT BOM
// ============================================================

router.get('/treatment-boms', authenticate, requirePermission(PERMISSIONS.TREATMENT_BOM_READ), treatmentBomController.list.bind(treatmentBomController));
router.get('/treatment-boms/:bomId', authenticate, requirePermission(PERMISSIONS.TREATMENT_BOM_READ), treatmentBomController.get.bind(treatmentBomController));
router.post('/treatment-boms', authenticate, requirePermission(PERMISSIONS.TREATMENT_BOM_MANAGE), treatmentBomController.create.bind(treatmentBomController));
router.patch('/treatment-boms/:bomId', authenticate, requirePermission(PERMISSIONS.TREATMENT_BOM_MANAGE), treatmentBomController.update.bind(treatmentBomController));
router.post('/treatment-boms/:bomId/activate', authenticate, requirePermission(PERMISSIONS.TREATMENT_BOM_MANAGE), treatmentBomController.activate.bind(treatmentBomController));

// ============================================================
// INVENTORY LEDGER AND FIFO
// ============================================================

router.get('/reports/logistics-dashboard', authenticate, requirePermission(PERMISSIONS.INVENTORY_READ), logisticsReportController.dashboard.bind(logisticsReportController));
router.get('/reports/stock-card', authenticate, requirePermission(PERMISSIONS.INVENTORY_READ), logisticsReportController.stockCard.bind(logisticsReportController));
router.get('/reports/valuation', authenticate, requirePermission(PERMISSIONS.INVENTORY_READ), logisticsReportController.valuation.bind(logisticsReportController));
router.get('/ledger/balances', authenticate, authorize(ALLSTAFF), inventoryLedgerController.balances.bind(inventoryLedgerController));
router.get('/ledger/postings', authenticate, authorize(ALLSTAFF), inventoryLedgerController.postings.bind(inventoryLedgerController));
router.get('/ledger/reconciliation', authenticate, authorize(ADMIN_ROLES), inventoryLedgerController.reconcile.bind(inventoryLedgerController));
router.post('/ledger/opening-stock', authenticate, requirePermission(PERMISSIONS.INVENTORY_OPENING_POST), inventoryLedgerController.opening.bind(inventoryLedgerController));
router.post('/ledger/receipts', authenticate, authorize(ADMIN_ROLES), inventoryLedgerController.receive.bind(inventoryLedgerController));
router.post('/ledger/issues', authenticate, authorize(ADMIN_ROLES), inventoryLedgerController.issue.bind(inventoryLedgerController));
router.post('/ledger/postings/:postingId/reverse', authenticate, authorize(MANAGER_ROLES), inventoryLedgerController.reverse.bind(inventoryLedgerController));

// ============================================================
// PURCHASE GOODS RECEIPT
// ============================================================

router.get(
  '/purchase-orders',
  authenticate,
  authorize(ADMIN_ROLES),
  validateQuery(purchaseOrderListQuerySchema),
  goodsReceiptController.purchaseOrders.bind(goodsReceiptController),
);
router.get(
  '/goods-receipts',
  authenticate,
  authorize(ADMIN_ROLES),
  validateQuery(goodsReceiptListQuerySchema),
  goodsReceiptController.list.bind(goodsReceiptController),
);
router.get(
  '/goods-receipts/:receiptId',
  authenticate,
  authorize(ADMIN_ROLES),
  goodsReceiptController.get.bind(goodsReceiptController),
);
router.post(
  '/purchase-orders/:purchaseOrderId/goods-receipts',
  authenticate,
  authorize(ADMIN_ROLES),
  validate(postGoodsReceiptSchema),
  goodsReceiptController.post.bind(goodsReceiptController),
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
  authorize(MANAGER_ROLES),
  inventoryController.createInventoryItem.bind(inventoryController)
);

// Batch create inventory items
router.post(
  '/items/batch',
  authenticate,
  authorize(MANAGER_ROLES),
  inventoryController.batchCreateInventoryItems.bind(inventoryController)
);

// Update inventory item
router.patch(
  '/items/:itemId',
  authenticate,
  authorize(MANAGER_ROLES),
  inventoryController.updateInventoryItem.bind(inventoryController)
);

// Delete inventory item
router.delete(
  '/items/:itemId',
  authenticate,
  authorize(MANAGER_ROLES),
  inventoryController.deleteInventoryItem.bind(inventoryController)
);

// Get low stock items for a branch
router.get(
  '/low-stock/:branchId',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getLowStockItems.bind(inventoryController)
);

// Adjust stock (SUPER_ADMIN or ADMIN_MANAGER)
router.patch(
  '/items/:itemId/adjust-stock',
  authenticate,
  authorize(MANAGER_ROLES),
  inventoryController.adjustStock.bind(inventoryController)
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
// LOGISTICS - CENTRAL STOCK, BRANCH REQUESTS, HOMECARE BAGS
// ============================================================

router.get(
  '/logistics/central-stock',
  authenticate,
  authorize(logisticStaffRoles),
  validateQuery(getCentralStockQuerySchema),
  logisticsController.getCentralStock.bind(logisticsController)
);

router.get(
  '/logistics/homecare-branches',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listHomecareBranches.bind(logisticsController)
);

router.get(
  '/logistics/homecare-staff',
  authenticate,
  authorize(canManageCentralStock),
  logisticsController.listHomecareStaff.bind(logisticsController)
);

router.post(
  '/logistics/branch-requests',
  authenticate,
  authorize([Role.ADMIN_CABANG]),
  validate(createBranchStockRequestSchema),
  logisticsController.createBranchStockRequest.bind(logisticsController)
);

router.post(
  '/logistics/branch-requests/:requestId/approve',
  authenticate,
  authorize(canManageCentralStock),
  validate(approveStockRequestSchema),
  logisticsController.approveBranchStockRequest.bind(logisticsController)
);

router.post(
  '/logistics/branch-requests/:requestId/reject',
  authenticate,
  authorize(canManageCentralStock),
  validate(rejectStockRequestSchema),
  logisticsController.rejectBranchStockRequest.bind(logisticsController)
);

router.post(
  '/logistics/branch-shipments/:shipmentId/ship',
  authenticate,
  authorize(canShipStock),
  validate(shipStockSchema),
  logisticsController.shipBranchShipment.bind(logisticsController)
);

router.post(
  '/logistics/branch-shipments/:shipmentId/receive',
  authenticate,
  authorize(canReceiveBranchStock),
  validate(receiveShipmentSchema),
  logisticsController.receiveBranchShipment.bind(logisticsController)
);

router.get(
  '/logistics/homecare-teams',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listHomecareTeams.bind(logisticsController)
);

router.post(
  '/logistics/homecare-teams',
  authenticate,
  authorize(canManageCentralStock),
  validate(createHomecareTeamSchema),
  logisticsController.createHomecareTeam.bind(logisticsController)
);

router.post(
  '/logistics/homecare-teams/:teamId/members',
  authenticate,
  authorize(canManageCentralStock),
  validate(addHomecareTeamMemberSchema),
  logisticsController.addHomecareTeamMember.bind(logisticsController)
);

router.delete(
  '/logistics/homecare-teams/:teamId/members/:userId',
  authenticate,
  authorize(canManageCentralStock),
  validate(removeHomecareTeamMemberSchema),
  logisticsController.removeHomecareTeamMember.bind(logisticsController)
);

router.delete(
  '/logistics/homecare-teams/:teamId',
  authenticate,
  authorize(canManageCentralStock),
  logisticsController.deleteHomecareTeam.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bags',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listHomecareBags.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bags',
  authenticate,
  authorize(superAdminOnly),
  validate(createHomecareBagSchema),
  logisticsController.createHomecareBag.bind(logisticsController)
);

router.patch(
  '/logistics/homecare-bags/:bagId/assign',
  authenticate,
  authorize(canManageCentralStock),
  validate(assignHomecareBagSchema),
  logisticsController.assignHomecareBag.bind(logisticsController)
);

router.delete(
  '/logistics/homecare-bags/:bagId',
  authenticate,
  authorize(canManageCentralStock),
  logisticsController.deleteHomecareBag.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bags/:bagId/stock',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.getBagStock.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bag-requests',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listBagStockRequests.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-requests',
  authenticate,
  authorize(canRequestBagStock),
  validate(createBagStockRequestSchema),
  logisticsController.createBagStockRequest.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-requests/:requestId/approve',
  authenticate,
  authorize(canManageCentralStock),
  validate(approveBagStockRequestSchema),
  logisticsController.approveBagStockRequest.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-requests/:requestId/reject',
  authenticate,
  authorize(canManageCentralStock),
  validate(rejectBagStockRequestSchema),
  logisticsController.rejectBagStockRequest.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bag-shipments',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listBagShipments.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-shipments/:shipmentId/ship',
  authenticate,
  authorize(canShipStock),
  validate(shipBagStockSchema),
  logisticsController.shipBagShipment.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-shipments/:shipmentId/receive',
  authenticate,
  authorize(logisticStaffRoles),
  validate(receiveBagShipmentSchema),
  logisticsController.receiveBagShipment.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-usages',
  authenticate,
  authorize(logisticStaffRoles),
  validate(useBagStockSchema),
  logisticsController.useBagStock.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bag-usages',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listBagUsages.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-returns',
  authenticate,
  authorize(logisticStaffRoles),
  validate(returnBagStockSchema),
  logisticsController.returnBagStock.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bag-returns',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listBagReturns.bind(logisticsController)
);

router.post(
  '/logistics/homecare-bag-opnames',
  authenticate,
  authorize(logisticStaffRoles),
  validate(createBagOpnameSchema),
  logisticsController.createBagOpname.bind(logisticsController)
);

router.get(
  '/logistics/homecare-bag-opnames',
  authenticate,
  authorize(logisticStaffRoles),
  logisticsController.listBagOpnames.bind(logisticsController)
);

// ============================================================
// MATERIAL USAGE HISTORY
// ============================================================

// Get material usage history with filters
router.get(
  '/material-usage-history',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getMaterialUsageHistory.bind(inventoryController)
);

// Get staff list for filter dropdown
router.get(
  '/material-usage-history/staff',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getStaffListForFilter.bind(inventoryController)
);

// Get branch groups for filter dropdown
router.get(
  '/material-usage-history/branch-groups',
  authenticate,
  authorize(ALLSTAFF),
  inventoryController.getBranchGroupsForFilter.bind(inventoryController)
);

// ============================================================
// STOCK REQUESTS
// ============================================================

router.get(
  '/stock-reservations',
  authenticate,
  authorize(ADMIN_ROLES),
  stockReservationController.list.bind(stockReservationController)
);

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

// Update stock request (SUPER_ADMIN and ADMIN_MANAGER)
router.patch(
  '/stock-requests/:requestId',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.updateRequest.bind(stockRequestController)
);

router.post(
  '/stock-requests/:requestId/reservations/approve',
  authenticate,
  authorize(MANAGER_ROLES),
  stockReservationController.approve.bind(stockReservationController)
);

router.post(
  '/stock-requests/:requestId/reservations/release',
  authenticate,
  authorize(MANAGER_ROLES),
  stockReservationController.release.bind(stockReservationController)
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

// Mark invoice as debt and continue flow (ADMIN_MANAGER / SUPER_ADMIN)
router.post(
  '/stock-requests/:requestId/mark-debt',
  authenticate,
  authorize(MANAGER_ROLES),
  stockRequestController.markPaymentAsDebt.bind(stockRequestController)
);

// Upload payment proof (ADMIN_MANAGER / SUPER_ADMIN)
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

// Update shipment before shipping (SUPER_ADMIN and ADMIN_MANAGER)
router.patch(
  '/shipments/:shipmentId',
  authenticate,
  authorize(MANAGER_ROLES),
  shipmentController.updateShipment.bind(shipmentController)
);

// Ship shipment (SUPER_ADMIN and ADMIN_MANAGER)
router.post(
  '/shipments/:shipmentId/ship',
  authenticate,
  authorize(MANAGER_ROLES),
  shipmentController.shipShipment.bind(shipmentController)
);

// Receive shipment according to permission and branch scope.
router.post(
  '/shipments/:shipmentId/receive',
  authenticate,
  authorize(canReceiveBranchStock),
  uploadShipmentReceipt.single('receiptFile'),
  shipmentController.receiveShipment.bind(shipmentController)
);

// Review shipment issue (SUPER_ADMIN and ADMIN_MANAGER)
router.post(
  '/shipments/:shipmentId/review-issue',
  authenticate,
  authorize(MANAGER_ROLES),
  shipmentController.reviewShipmentIssue.bind(shipmentController)
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
