import { api } from '../api';

// ============================================================
// TYPES
// ============================================================

export interface StockRequestItem {
  masterProductId: string;
  requestedQty: number;
  unit?: string;
  notes?: string;
}

export interface CreateStockRequestInput {
  items: StockRequestItem[];
  notes?: string;
}

export interface UpdateStockRequestInput {
  notes?: string;
  items?: StockRequestItem[];
  invoiceItems?: InvoiceItemInput[];
  invoiceTotalAmount?: number;
}

export interface InvoiceItemInput {
  masterProductId: string;
  quantity: number;
  unit?: string;
  pricePerUnit: number;
}

export interface CreateInvoiceInput {
  items: InvoiceItemInput[];
  totalAmount?: number;
  notes?: string;
  paymentMode?: 'NORMAL' | 'DEBT';
  paymentAccountLabel?: string;
  paymentBankName?: string;
  paymentAccountNumber?: string;
  paymentAccountHolder?: string;
}

export interface ReceiveShipmentInput {
  idempotencyKey?: string;
  isFinal?: boolean;
  receivedItems?: Array<{
    masterProductId: string;
    receivedQty: number;
    quarantineQty?: number;
    stockLocationId?: string;
    unit?: string;
  }>;
  discrepancies?: Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';
    unit?: string;
    notes?: string;
    photoUrl?: string;
  }>;
  notes?: string;
  receiptFile: File;
}

export interface ShipShipmentInput {
  idempotencyKey?: string;
  notes?: string;
  shipmentPhotoUrl?: string;
  shipmentPhotoName?: string;
  items?: Array<{
    masterProductId: string;
    sentQty: number;
    unit?: string;
    overstockReason?: string;
  }>;
}

export interface UpdateShipmentInput {
  notes?: string;
  items?: Array<{
    masterProductId: string;
    sentQty: number;
    unit?: string;
    overstockReason?: string;
  }>;
}

export type ShipmentIssueDecision = 'SEND_SHORTAGE' | 'CLOSE_CASE' | 'COMPLETE_CASE';

export interface ReviewShipmentIssueInput {
  decision: ShipmentIssueDecision;
  notes?: string;
  shortageItems?: Array<{
    masterProductId: string;
    quantity: number;
    unit?: string;
  }>;
}

export interface OverstockPreviewItem {
  masterProductId: string;
  requestedQty: number;
  availableOverstock: number;
  deductedQty: number;
  finalQty: number;
  overstockDetails: Array<{
    quantity: number;
    reason: string;
    sourceShipmentCode: string;
    createdAt: string;
  }>;
}

export interface InventoryItemWithStock {
  id: string;
  masterProductId: string;
  branchId: string;
  stock: number;
  sku?: string;
  name?: string;
  quantity?: number;
  minThreshold: number;
  storageLocation: string | null;
  masterProduct: {
    id: string;
    name: string;
    sku?: string;
    category: string;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
    description: string | null;
  };
  stockInfo: {
    totalBaseStock: number;
    legacyMirrorStock: number;
    reservedBaseStock: number;
    quarantineBaseStock: number;
    requiresLedgerReconciliation: boolean;
    baseStock: number;
    baseUnit: string;
    usageStock: number;
    usageUnit: string;
    minThresholdBase: number;
    minThresholdUsage: number;
    isLowStock: boolean;
    displayText: string;
    displayShort: string;
  };
}

export interface BranchOverstock {
  id: string;
  branchId: string;
  masterProductId: string;
  productName: string;
  productCategory: string;
  unit: string;
  quantity: number;
  originalQty: number;
  reason: string;
  status: 'AVAILABLE' | 'PARTIALLY_USED' | 'FULLY_USED';
  sourceShipment: {
    id: string;
    shipmentCode: string;
    createdAt: string;
  } | null;
  usages: Array<{
    id: string;
    quantityUsed: number;
    stockRequestCode: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OverstockSummary {
  masterProductId: string;
  productName: string;
  productCategory: string;
  unit: string;
  totalQuantity: number;
  records: Array<{
    id: string;
    quantity: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface StockRequest {
  id: string;
  requestCode: string;
  branchId: string;
  branchName: string;
  branchType: 'PREMIER' | 'PARTNERSHIP' | 'PUSAT';
  status: string;
  notes?: string;
  itemCount: number;
  totalItems: number;
  items: Array<{
    id: string;
    masterProductId: string;
    productName: string;
    productCategory: string;
    requestedQty: number;
    approvedQty?: number;
    unit: string;
    notes?: string;
  }>;
  invoice?: {
    id: string;
    invoiceNumber: string;
    subtotal?: number;
    totalAmount: number;
    paidAmount?: number;
    remainingAmount?: number;
    status: string;
    paymentVerificationStatus: string;
    notes?: string | null;
    paymentProofUrl?: string;
    paymentUploadedAt?: string;
    paymentAccountLabel?: string | null;
    paymentBankName?: string | null;
    paymentAccountNumber?: string | null;
    paymentAccountHolder?: string | null;
    items?: Array<{
      id: string;
      masterProductId: string;
      sku?: string;
      productName: string;
      description?: string;
      quantity: number;
      unit?: string;
      pricePerUnit: number;
      subtotal: number;
    }>;
  };
  shipment?: {
    id: string;
    shipmentCode: string;
    status: string;
  };
  paymentProofUrl?: string;
  paymentUploadedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Shipment {
  id: string;
  shipmentCode: string;
  fromBranchId: string;
  fromBranchName: string;
  fromBranchCode?: string;
  fromBranchCity?: string | null;
  fromBranchAddress?: string | null;
  toBranchId: string;
  toBranchName: string;
  toBranchCode?: string;
  toBranchCity?: string | null;
  toBranchAddress?: string | null;
  toBranchType?: string;
  status: string;
  isLedgerManaged?: boolean;
  notes?: string;
  shipmentPhotoUrl?: string;
  shipmentPhotoName?: string;
  receiptFileUrl?: string;
  receiptFileName?: string;
  receiptFileSize?: number;
  receiptMimeType?: string;
  itemCount?: number;
  totalItems?: number;
  hasDiscrepancies?: boolean;
  discrepancyCount?: number;
  receiptCount?: number;
  items: Array<{
    id: string;
    masterProductId: string;
    productName: string;
    productCategory?: string;
    sentQty: number;
    requestedQty?: number;
    originalRequestedQty?: number; // Original request amount before overstock deduction
    overstockDeducted?: number; // Amount already deducted from overstock
    receivedQty?: number;
    stockBefore?: number | null;
    stockAfter?: number | null;
    quarantineQty?: number;
    overstockQty?: number;
    overstockReason?: string;
    unit: string;
  }>;
  discrepancies?: Array<{
    id: string;
    masterProductId: string;
    productName: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: string;
    quarantinedQty?: number;
    status?: 'OPEN' | 'RESOLVED';
    notes?: string;
    photoUrl?: string;
    photoFileName?: string;
    reportedBy?: string;
    createdAt?: string;
  }>;
  receipts?: Array<{
    id: string;
    receiptNumber: string;
    isFinal: boolean;
    totalQuantity: number;
    quarantinedQuantity: number;
    totalCost?: number;
    evidenceFileUrl?: string;
    evidenceFileName?: string;
    receivedBy?: string;
    receivedAt?: string;
    items?: Array<{
      masterProductId: string;
      productName: string;
      receivedQty: number;
      quarantineQty: number;
      unitCost: number;
      totalCost: number;
    }>;
  }>;
  stockRequest?: {
    id: string;
    requestCode: string;
    status: string;
    branchId?: string;
    branchName?: string;
    branchType?: string;
    items?: Array<{
      id: string;
      masterProductId: string;
      productName: string;
      requestedQty: number;
      approvedQty?: number | null;
      unit: string;
    }>;
    invoice?: {
      id: string;
      invoiceNumber: string;
      subtotal?: number;
      totalAmount: number;
      status: string;
      paymentVerificationStatus?: string;
      notes?: string | null;
      paymentProofUrl?: string | null;
      paymentProofFileName?: string | null;
      paymentAccountLabel?: string | null;
      paymentBankName?: string | null;
      paymentAccountNumber?: string | null;
      paymentAccountHolder?: string | null;
      paidAt?: string | null;
      items?: Array<{
        id: string;
        masterProductId: string;
        sku?: string;
        productName: string;
        description?: string;
        quantity: number;
        unit?: string;
        pricePerUnit: number;
        subtotal: number;
      }>;
    } | null;
  } | null;
  overstocksCreated?: Array<{
    masterProductId: string;
    productName: string;
    quantity: number;
    reason: string;
  }>;
  shippedBy?: string;
  shippedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMasterProduct {
  id: string;
  name: string;
  sku?: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description?: string;
  isActive: boolean;
  baseUomId?: string;
  usageUomId?: string;
  tracksBatch?: boolean;
  tracksExpiry?: boolean;
  baseUom?: { id: string; code: string; name: string };
  usageUom?: { id: string; code: string; name: string };
}

export interface HomecareProduct {
  id: string;
  sku?: string | null;
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  conversionFactor?: number;
  isActive: boolean;
  centralStockQty?: number;
  minThreshold?: number;
  storageLocation?: string | null;
}

export interface HomecareBranchOption {
  id: string;
  branchCode: string;
  name: string;
  type: 'PUSAT' | 'PREMIER' | 'PARTNERSHIP';
}

export interface HomecareStaffOption {
  userId: string;
  email: string;
  role: string;
  staffCode?: string | null;
  fullName: string;
  phone?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
}

export interface HomecareTeam {
  id: string;
  teamCode: string;
  name: string;
  branchId: string;
  branchName?: string | null;
  branchCode?: string | null;
  branchType?: string | null;
  description?: string | null;
  isActive: boolean;
  memberCount: number;
  bagCount: number;
  hasAdminLayanan: boolean;
  hasNakes: boolean;
  isOperational: boolean;
  missingRoles: Array<'ADMIN_LAYANAN' | 'NAKES'>;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    notes?: string | null;
    joinedAt?: string;
    fullName: string;
    staffCode?: string | null;
    userRole?: string | null;
  }>;
  bags: Array<{
    id: string;
    bagCode: string;
    name: string;
    status: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareBag {
  id: string;
  bagCode: string;
  name: string;
  teamId: string;
  teamCode?: string | null;
  teamName?: string | null;
  branchId: string;
  branchName?: string | null;
  branchCode?: string | null;
  branchType?: string | null;
  status: string;
  notes?: string | null;
  stockCount: number;
  lowStockCount: number;
  totalStockQty: number;
  recentRequests: Array<{
    id: string;
    requestCode: string;
    status: string;
    createdAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareBagStockDetail {
  id: string;
  bagCode: string;
  name: string;
  status: string;
  team: {
    id: string;
    teamCode: string;
    name: string;
  };
  stocks: Array<{
    id: string;
    masterProductId: string;
    productName?: string | null;
    sku?: string | null;
    category?: string | null;
    stock: number;
    minThreshold: number;
    baseUnit?: string | null;
    usageUnit?: string | null;
  }>;
}

export interface HomecareBagRequest {
  id: string;
  requestCode: string;
  teamId: string;
  teamName?: string;
  bagId: string;
  bagCode?: string;
  bagName?: string;
  branchId: string;
  status: string;
  priority: string;
  requestNotes: string;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  items: Array<{
    id: string;
    masterProductId: string;
    requestedQty: number;
    approvedQty?: number | null;
    finalQty?: number | null;
    notes?: string | null;
  }>;
  shipment?: {
    id: string;
    shipmentCode: string;
    status: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareBagShipment {
  id: string;
  shipmentCode: string;
  requestId: string;
  fromBranchId: string;
  toBagId: string;
  bagCode?: string;
  bagName?: string;
  status: string;
  notes?: string | null;
  shippedAt?: string | null;
  receivedAt?: string | null;
  shipmentPhotoUrl?: string | null;
  shipmentPhotoName?: string | null;
  receiptFileUrl?: string | null;
  receiptFileName?: string | null;
  items: Array<{
    id: string;
    masterProductId: string;
    sentQty: number;
    receivedQty?: number | null;
    discrepancyType?: string | null;
    discrepancyNotes?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareBagUsage {
  id: string;
  usageCode: string;
  bagId: string;
  bagCode?: string | null;
  bagName?: string | null;
  teamId: string;
  teamCode?: string | null;
  teamName?: string | null;
  treatmentSessionId?: string | null;
  usedBy: string;
  status: string;
  usageDate?: string;
  notes: string;
  items: Array<{
    id: string;
    masterProductId: string;
    quantity: number;
    unit?: string | null;
    notes?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareUsageHistoryItem {
  id: string;
  usageId: string;
  usageCode: string;
  usageDate: string;
  status: string;
  branchId: string;
  branchCode?: string | null;
  branchName?: string | null;
  teamId: string;
  teamCode: string;
  teamName: string;
  bagId: string;
  bagCode: string;
  bagName: string;
  masterProductId: string;
  sku?: string | null;
  productName: string;
  quantity: number;
  unit?: string | null;
  treatmentSessionId?: string | null;
  sessionCode?: string | null;
  memberNo?: string | null;
  memberName?: string | null;
  usedBy: string;
  usedByName: string;
  notes: string;
}

export interface HomecareUsageHistoryResponse {
  items: HomecareUsageHistoryItem[];
  total: number;
  page: number;
  limit: number;
  usageCount: number;
}

export interface HomecareBagReturn {
  id: string;
  returnCode: string;
  bagId: string;
  bagCode?: string | null;
  bagName?: string | null;
  teamId: string;
  teamCode?: string | null;
  teamName?: string | null;
  toBranchId: string;
  returnedBy: string;
  returnedAt?: string;
  receivedBy?: string | null;
  receivedAt?: string | null;
  notes: string;
  items: Array<{
    id: string;
    masterProductId: string;
    quantity: number;
    isReusable: boolean;
    condition?: string | null;
    notes?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareBagOpname {
  id: string;
  opnameCode: string;
  bagId: string;
  bagCode?: string | null;
  bagName?: string | null;
  teamId: string;
  teamCode?: string | null;
  teamName?: string | null;
  status: string;
  checkedBy: string;
  checkedAt?: string;
  notes: string;
  items: Array<{
    id: string;
    masterProductId: string;
    systemQty: number;
    physicalQty: number;
    difference: number;
    adjustmentCreated: boolean;
    notes?: string | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomecareStockItemInput {
  masterProductId: string;
  quantity: number;
  notes?: string;
}

export type GoodsReceiptCondition = 'GOOD' | 'DAMAGED' | 'EXPIRED' | 'OTHER';

export interface PurchaseOrderInventoryLine {
  id: string;
  lineNumber: number;
  orderedQty: string;
  receivedQty: string;
  remainingQty: string;
  unitCost: string;
  masterProduct: {
    id: string;
    sku?: string | null;
    name: string;
    tracksBatch: boolean;
    tracksExpiry: boolean;
  };
  destinationStockLocation?: {
    id: string;
    code: string;
    name: string;
    warehouse: { id: string; code: string; name: string };
  } | null;
}

export interface PurchaseOrderInventory {
  id: string;
  poNumber: string;
  status: 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';
  currency: string;
  orderDate: string;
  supplier: { id: string; supplierCode: string; name: string };
  branch: { id: string; branchCode: string; name: string };
  items: PurchaseOrderInventoryLine[];
  _count: { receipts: number };
}

export interface PostGoodsReceiptInput {
  idempotencyKey: string;
  receivedAt: string;
  supplierDeliveryNumber?: string;
  notes?: string;
  lines: Array<{
    purchaseOrderItemId: string;
    quantity: string;
    stockLocationId?: string;
    condition: GoodsReceiptCondition;
    batch?: { batchNumber: string; manufactureDate?: string; expiryDate?: string };
    notes?: string;
  }>;
}

// ============================================================
// INVENTORY API
// ============================================================

export const inventoryApi = {
  // ============================================================
  // INVENTORY ITEMS
  // ============================================================

  /**
   * Get available inventory items for a branch with stock info in both units
   */
  getAvailableItems: (branchId: string) => {
    // Add timestamp to prevent caching issues
    return api.get<{ success: boolean; data: InventoryItemWithStock[] }>(`/inventory/available/${branchId}`, {
      params: { _t: Date.now() }
    });
  },

  /**
   * Get inventory item details with conversion info
   */
  getItemDetails: (itemId: string) => {
    return api.get(`/inventory/items/${itemId}`);
  },

  /**
   * Get inventory items for a branch
   */
  getInventoryItems: (branchId: string, params?: { category?: string; search?: string }) => {
    return api.get(`/inventory/items`, { params: { branchId, ...params } });
  },

  /**
   * Get low stock items
   */
  getLowStockItems: (branchId: string) => {
    return api.get(`/inventory/low-stock/${branchId}`);
  },

  /**
   * Direct, audited quantity adjustment (Super Admin only).
   * Inventory price and valuation are handled by a separate finance flow.
   */
  adjustStock: (itemId: string, data: {
    idempotencyKey: string;
    adjustment: number;
    notes: string;
    stockLocationId?: string;
    batchId?: string;
    reasonCode?: string;
  }) => {
    return api.patch(`/inventory/items/${itemId}/adjust-stock`, data);
  },

  /**
   * Get master products for inventory modal
   */
  getMasterProducts: () => {
    return api.get<{ data: { products: InventoryMasterProduct[] } }>('/inventory/master-products');
  },

  createMasterProduct: (data: Record<string, unknown>) => {
    return api.post('/inventory/master-products', data);
  },

  updateMasterProduct: (productId: string, data: Record<string, unknown>) => {
    return api.patch(`/inventory/master-products/${productId}`, data);
  },

  getWarehouses: (params?: { branchId?: string; includeInactive?: boolean; search?: string }) => {
    return api.get('/inventory/warehouses', { params });
  },

  createWarehouse: (data: { branchId: string; code: string; name: string; isDefault?: boolean }) => {
    return api.post('/inventory/warehouses', data);
  },

  updateWarehouse: (id: string, data: Record<string, unknown>) => {
    return api.patch(`/inventory/warehouses/${id}`, data);
  },

  deactivateWarehouse: (id: string) => {
    return api.delete(`/inventory/warehouses/${id}`);
  },

  getStockLocations: (warehouseId: string, includeInactive = false) => {
    return api.get('/inventory/stock-locations', { params: { warehouseId, includeInactive } });
  },

  createStockLocation: (data: { warehouseId: string; code: string; name: string; isDefault?: boolean }) => {
    return api.post('/inventory/stock-locations', data);
  },

  getUoms: (includeInactive = false) => {
    return api.get('/inventory/uoms', { params: { includeInactive } });
  },

  createUom: (data: { code: string; name: string; category?: string; precision?: number }) => {
    return api.post('/inventory/uoms', data);
  },

  previewConversion: (data: {
    quantity: string;
    factor: string;
    direction: 'BASE_TO_USAGE' | 'USAGE_TO_BASE';
  }) => {
    return api.post('/inventory/conversions/preview', data);
  },

  getBatches: (params?: { masterProductId?: string; includeBlocked?: boolean }) => {
    return api.get('/inventory/batches', { params });
  },

  createBatch: (data: Record<string, unknown>) => {
    return api.post('/inventory/batches', data);
  },

  getLedgerBalances: (params?: Record<string, string | number | undefined>) => {
    return api.get('/inventory/ledger/balances', { params });
  },

  getPurchaseOrdersForReceipt: (params?: Record<string, string | number | undefined>) => {
    return api.get('/inventory/purchase-orders', { params });
  },

  getGoodsReceipts: (params?: Record<string, string | number | undefined>) => {
    return api.get('/inventory/goods-receipts', { params });
  },

  getGoodsReceipt: (receiptId: string) => {
    return api.get(`/inventory/goods-receipts/${receiptId}`);
  },

  postGoodsReceipt: (purchaseOrderId: string, data: PostGoodsReceiptInput) => {
    return api.post(`/inventory/purchase-orders/${purchaseOrderId}/goods-receipts`, data);
  },

  getLedgerPostings: (params?: Record<string, string | number | undefined>) => {
    return api.get('/inventory/ledger/postings', { params });
  },

  receiveInventory: (data: Record<string, unknown>) => {
    return api.post('/inventory/ledger/receipts', data);
  },

  postOpeningStock: (data: Record<string, unknown>) => {
    return api.post('/inventory/ledger/opening-stock', data);
  },

  issueInventory: (data: Record<string, unknown>) => {
    return api.post('/inventory/ledger/issues', data);
  },

  reverseInventoryPosting: (postingId: string, data: Record<string, unknown>) => {
    return api.post(`/inventory/ledger/postings/${postingId}/reverse`, data);
  },

  reconcileInventory: (branchId: string) => {
    return api.get('/inventory/ledger/reconciliation', { params: { branchId } });
  },

  // ============================================================
  // STOCK REQUESTS
  // ============================================================

  /**
   * Create stock request (Admin Cabang only)
   */
  createStockRequest: (data: CreateStockRequestInput) => {
    return api.post('/inventory/stock-requests', data);
  },

  /**
   * Get stock requests with filtering
   */
  getStockRequests: (params?: { 
    branchId?: string; 
    status?: string;
    statuses?: string;
    page?: number;
    limit?: number;
  }) => {
    return api.get('/inventory/stock-requests', { params });
  },

  /**
   * Get pending review requests (for Admin Manager dashboard)
   */
  getPendingReviewRequests: () => {
    return api.get('/inventory/stock-requests/pending-review');
  },

  /**
   * Get stock request by ID
   */
  getStockRequestById: (requestId: string) => {
    return api.get(`/inventory/stock-requests/${requestId}`);
  },

  /**
   * Update pending stock request (Admin Manager / Super Admin)
   */
  updateStockRequest: (requestId: string, data: UpdateStockRequestInput) => {
    return api.patch(`/inventory/stock-requests/${requestId}`, data);
  },

  /**
   * Approve stock request for PREMIER branch
   */
  approvePremierRequest: (requestId: string, reviewNotes?: string) => {
    return api.post(`/inventory/stock-requests/${requestId}/approve-premier`, { reviewNotes });
  },

  /**
   * Create invoice for PARTNERSHIP branch
   */
  createPartnershipInvoice: (requestId: string, data: CreateInvoiceInput) => {
    return api.post(`/inventory/stock-requests/${requestId}/create-invoice`, data);
  },

  /**
   * Mark stock request invoice as debt and continue flow
   */
  markPaymentAsDebt: (requestId: string, notes?: string) => {
    return api.post(`/inventory/stock-requests/${requestId}/mark-debt`, { notes });
  },

  /**
   * Upload payment proof (Admin Manager / Super Admin)
   */
  uploadPaymentProof: (requestId: string, file: File, amount?: number, notes?: string) => {
    const formData = new FormData();
    if (amount !== undefined) {
      formData.append('amount', String(amount));
    }
    if (notes) {
      formData.append('notes', notes);
    }
    formData.append('paymentProof', file);

    return api.post(`/inventory/stock-requests/${requestId}/upload-payment-proof`, formData, {
      // Keep the amount in the multipart body and query string. Some browser /
      // proxy combinations have dropped text fields from multipart requests,
      // while the uploaded file still arrives successfully.
      params: amount !== undefined ? { amount } : undefined,
    });
  },

  /**
   * Confirm payment (Admin Manager)
   */
  confirmPayment: (requestId: string, verificationNotes?: string) => {
    return api.post(`/inventory/stock-requests/${requestId}/confirm-payment`, { verificationNotes });
  },

  /**
   * Reject payment (Admin Manager)
   */
  rejectPayment: (requestId: string, rejectionReason: string) => {
    return api.post(`/inventory/stock-requests/${requestId}/reject-payment`, { rejectionReason });
  },

  /**
   * Reject stock request
   */
  rejectRequest: (requestId: string, reviewNotes: string) => {
    return api.post(`/inventory/stock-requests/${requestId}/reject`, { reviewNotes });
  },

  /**
   * Legacy approve endpoint (for backward compatibility)
   */
  approveRequest: (requestId: string, data?: { reviewNotes?: string; invoiceItems?: InvoiceItemInput[] }) => {
    return api.post(`/inventory/stock-requests/${requestId}/approve`, data);
  },

  approveAndReserveStockRequest: (requestId: string, data: Record<string, unknown>) => {
    return api.post(`/inventory/stock-requests/${requestId}/reservations/approve`, data);
  },

  releaseStockRequestReservations: (requestId: string, data: Record<string, unknown>) => {
    return api.post(`/inventory/stock-requests/${requestId}/reservations/release`, data);
  },

  getStockReservations: (params?: {
    sourceBranchId?: string;
    destinationBranchId?: string;
    status?: 'ACTIVE' | 'RELEASED';
    page?: number;
    limit?: number;
  }) => {
    return api.get('/inventory/stock-reservations', { params });
  },

  // ============================================================
  // SHIPMENTS
  // ============================================================

  /**
   * Get shipments
   */
  getShipments: (params?: { branchId?: string; status?: string; startDate?: string; endDate?: string }) => {
    return api.get<{ data: Shipment[] }>('/inventory/shipments', { params });
  },

  /**
   * Get shipment by ID
   */
  getShipmentById: (shipmentId: string) => {
    return api.get(`/inventory/shipments/${shipmentId}`);
  },

  /**
   * Update preparing shipment (Admin Manager / Super Admin)
   */
  updateShipment: (shipmentId: string, data: UpdateShipmentInput) => {
    return api.patch(`/inventory/shipments/${shipmentId}`, data);
  },

  /**
   * Ship shipment (Admin Manager / Super Admin)
   * Supports sending more items than requested (overstock)
   */
  shipShipment: (shipmentId: string, data?: ShipShipmentInput) => {
    const idempotencyKey = data?.idempotencyKey || `SHIP-${shipmentId}-${crypto.randomUUID()}`;
    return api.post(
      `/inventory/shipments/${shipmentId}/ship`,
      { ...data, idempotencyKey },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  },

  /**
   * Receive shipment (Admin Cabang)
   */
  receiveShipment: (shipmentId: string, data: ReceiveShipmentInput) => {
    const formData = new FormData();
    const idempotencyKey = data.idempotencyKey || `RECEIPT-${shipmentId}-${crypto.randomUUID()}`;
    formData.append('receiptFile', data.receiptFile);
    formData.append('idempotencyKey', idempotencyKey);
    formData.append('isFinal', String(data.isFinal ?? true));

    if (data.receivedItems) {
      formData.append('receivedItems', JSON.stringify(data.receivedItems));
    }

    if (data.discrepancies) {
      formData.append('discrepancies', JSON.stringify(data.discrepancies));
    }

    if (data.notes) {
      formData.append('notes', data.notes);
    }

    return api.post(`/inventory/shipments/${shipmentId}/receive`, formData, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  /**
   * Review shipment issue (Admin Manager / Super Admin)
   */
  reviewShipmentIssue: (shipmentId: string, data: ReviewShipmentIssueInput) => {
    return api.post(`/inventory/shipments/${shipmentId}/review-issue`, data);
  },

  /**
   * Legacy approve shipment endpoint (for backward compatibility)
   */
  approveShipment: (shipmentId: string, notes?: string) => {
    return api.post(`/inventory/shipments/${shipmentId}/approve`, { notes });
  },

  // ============================================================
  // HOMECARE TEAM / BAG LOGISTICS
  // ============================================================

  getHomecareProducts: (params?: { search?: string; category?: string; includeInactive?: boolean }) => {
    return api.get('/inventory/logistics/central-stock', { params });
  },

  getHomecareBranches: () => {
    return api.get('/inventory/logistics/homecare-branches');
  },

  getHomecareStaff: (params?: { branchId?: string; search?: string }) => {
    return api.get('/inventory/logistics/homecare-staff', { params });
  },

  getHomecareTeams: (params?: { branchId?: string; search?: string; includeInactive?: boolean }) => {
    return api.get('/inventory/logistics/homecare-teams', { params });
  },

  createHomecareTeam: (data: {
    teamCode?: string;
    name: string;
    branchId: string;
    adminLayananUserId: string;
    nakesUserId: string;
    description?: string;
  }) => {
    return api.post('/inventory/logistics/homecare-teams', data);
  },

  addHomecareTeamMember: (teamId: string, data: {
    userId: string;
    role: 'ADMIN_LAYANAN' | 'DOCTOR' | 'NURSE' | 'DRIVER' | 'OTHER';
    notes?: string;
  }) => {
    return api.post(`/inventory/logistics/homecare-teams/${teamId}/members`, data);
  },

  removeHomecareTeamMember: (teamId: string, userId: string, notes?: string) => {
    return api.delete(`/inventory/logistics/homecare-teams/${teamId}/members/${userId}`, { data: { notes } });
  },

  deleteHomecareTeam: (teamId: string) => {
    return api.delete(`/inventory/logistics/homecare-teams/${teamId}`);
  },

  getHomecareBags: (params?: { teamId?: string; branchId?: string; status?: string; search?: string }) => {
    return api.get('/inventory/logistics/homecare-bags', { params });
  },

  createHomecareBag: (data: {
    bagCode?: string;
    name: string;
    teamId: string;
    branchId?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'IN_CHECKING' | 'DAMAGED' | 'LOST';
    notes?: string;
  }) => {
    return api.post('/inventory/logistics/homecare-bags', data);
  },

  updateHomecareTeam: (teamId: string, data: { name?: string; description?: string; isActive?: boolean }) => {
    return api.patch(`/inventory/logistics/homecare-teams/${teamId}`, data);
  },

  updateHomecareBag: (bagId: string, data: { name?: string; status?: string; notes?: string; isActive?: boolean }) => {
    return api.patch(`/inventory/logistics/homecare-bags/${bagId}`, data);
  },

  assignHomecareBag: (bagId: string, data: {
    teamId: string;
    notes?: string;
  }) => {
    return api.patch(`/inventory/logistics/homecare-bags/${bagId}/assign`, data);
  },

  deleteHomecareBag: (bagId: string) => {
    return api.delete(`/inventory/logistics/homecare-bags/${bagId}`);
  },

  getHomecareBagStock: (bagId: string) => {
    return api.get(`/inventory/logistics/homecare-bags/${bagId}/stock`);
  },

  getHomecareBagRequests: (params?: { status?: string; teamId?: string; bagId?: string }) => {
    return api.get('/inventory/logistics/homecare-bag-requests', { params });
  },

  createHomecareBagRequest: (data: {
    teamId: string;
    bagId: string;
    priority?: string;
    requestNotes: string;
    items: Array<{ masterProductId: string; requestedQty: number; notes?: string }>;
  }) => {
    return api.post('/inventory/logistics/homecare-bag-requests', data);
  },

  approveHomecareBagRequest: (
    requestId: string,
    data: {
      items?: Array<{ masterProductId: string; approvedQty: number; notes?: string }>;
      reviewNotes?: string;
      sourceBranchId?: string;
    }
  ) => {
    return api.post(`/inventory/logistics/homecare-bag-requests/${requestId}/approve`, data);
  },

  rejectHomecareBagRequest: (requestId: string, reviewNotes: string) => {
    return api.post(`/inventory/logistics/homecare-bag-requests/${requestId}/reject`, { reviewNotes });
  },

  getHomecareBagShipments: (params?: { status?: string; bagId?: string }) => {
    return api.get('/inventory/logistics/homecare-bag-shipments', { params });
  },

  getHomecareBagUsages: (params?: { status?: string; bagId?: string; teamId?: string }) => {
    return api.get('/inventory/logistics/homecare-bag-usages', { params });
  },

  getHomecareUsageHistory: (params?: {
    branchId?: string; teamId?: string; bagId?: string; masterProductId?: string;
    startDate?: string; endDate?: string; search?: string; page?: number; limit?: number;
  }) => api.get<{ data: HomecareUsageHistoryResponse }>('/inventory/logistics/homecare-usage-history', { params }),

  exportHomecareUsageHistory: async (params?: {
    branchId?: string; teamId?: string; bagId?: string; masterProductId?: string;
    startDate?: string; endDate?: string; search?: string;
  }): Promise<Blob> => {
    const response = await api.get('/inventory/logistics/homecare-usage-history/export', { params, responseType: 'blob' });
    return response.data;
  },

  shipHomecareBagShipment: (shipmentId: string, data: { notes: string; shipmentPhotoUrl?: string; shipmentPhotoName?: string }) => {
    return api.post(`/inventory/logistics/homecare-bag-shipments/${shipmentId}/ship`, data);
  },

  receiveHomecareBagShipment: (
    shipmentId: string,
    data: {
      receivedItems?: Array<{ masterProductId: string; receivedQty: number }>;
      discrepancies?: Array<{
        masterProductId: string;
        expectedQty: number;
        receivedQty: number;
        discrepancyType: 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';
        notes: string;
      }>;
      notes: string;
    }
  ) => {
    return api.post(`/inventory/logistics/homecare-bag-shipments/${shipmentId}/receive`, data);
  },

  useHomecareBagStock: (data: {
    bagId: string;
    teamId?: string;
    treatmentSessionId?: string;
    status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    usageDate?: string;
    notes: string;
    allowNegativeStock?: boolean;
    items: Array<HomecareStockItemInput & { unit?: string }>;
  }) => {
    return api.post('/inventory/logistics/homecare-bag-usages', data);
  },

  returnHomecareBagStock: (data: {
    bagId: string;
    teamId?: string;
    toBranchId: string;
    returnedAt?: string;
    notes: string;
    allowNegativeStock?: boolean;
    items: Array<HomecareStockItemInput & { isReusable?: boolean; condition?: string }>;
  }) => {
    return api.post('/inventory/logistics/homecare-bag-returns', data);
  },

  getHomecareBagReturns: (params?: { bagId?: string; teamId?: string }) => {
    return api.get('/inventory/logistics/homecare-bag-returns', { params });
  },

  createHomecareBagOpname: (data: {
    bagId: string;
    teamId?: string;
    status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
    checkedAt?: string;
    notes: string;
    createAdjustments?: boolean;
    items: Array<{ masterProductId: string; physicalQty: number; notes?: string }>;
  }) => {
    return api.post('/inventory/logistics/homecare-bag-opnames', data);
  },

  getHomecareBagOpnames: (params?: { status?: string; bagId?: string; teamId?: string }) => {
    return api.get('/inventory/logistics/homecare-bag-opnames', { params });
  },

  // ============================================================
  // SPRINT 9 INVENTORY CONTROL
  // ============================================================

  getAdjustmentReasons: () => api.get('/inventory/controls/adjustment-reasons'),

  getAdjustments: (params?: { branchId?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/inventory/controls/adjustments', { params }),

  createAdjustment: (data: Record<string, unknown>) => api.post('/inventory/controls/adjustments', data),
  submitAdjustment: (id: string) => api.post(`/inventory/controls/adjustments/${id}/submit`),
  decideAdjustment: (id: string, decision: 'APPROVE' | 'REJECT', note: string) =>
    api.post(`/inventory/controls/adjustments/${id}/decision`, { decision, note }),
  postAdjustment: (id: string) => api.post(`/inventory/controls/adjustments/${id}/post`),

  getStockOpnames: (params?: { branchId?: string; status?: string; page?: number; limit?: number }) =>
    api.get('/inventory/controls/stock-opnames', { params }),
  startStockOpname: (data: { branchId: string; stockLocationId?: string; notes?: string }) =>
    api.post('/inventory/controls/stock-opnames', data),
  countStockOpname: (id: string, lines: Array<Record<string, unknown>>) =>
    api.patch(`/inventory/controls/stock-opnames/${id}/count`, { lines }),
  submitStockOpname: (id: string) => api.post(`/inventory/controls/stock-opnames/${id}/submit`),
  decideStockOpname: (id: string, decision: 'APPROVE' | 'REJECT', note: string) =>
    api.post(`/inventory/controls/stock-opnames/${id}/decision`, { decision, note }),
  postStockOpname: (id: string) => api.post(`/inventory/controls/stock-opnames/${id}/post`),
  cancelStockOpname: (id: string, note: string) => api.post(`/inventory/controls/stock-opnames/${id}/cancel`, { note }),

  resolveShipmentDiscrepancy: (id: string, data: Record<string, unknown>) =>
    api.post(`/inventory/shipment-discrepancies/${id}/resolve`, data),
  completeMultiBagUsage: (data: Record<string, unknown>) =>
    api.post('/inventory/homecare-multi-bag-usages/complete', data),

  // ============================================================
  // EXPORT
  // ============================================================

  /**
   * Export inventory to CSV
   */
  exportToCSV: (branchId: string) => {
    return api.get('/inventory/export/csv', { 
      params: { branchId },
      responseType: 'blob',
    });
  },

  /**
   * Export inventory to Excel
   */
  exportToExcel: (branchId: string) => {
    return api.get('/inventory/export/excel', { 
      params: { branchId },
      responseType: 'blob',
    });
  },

  // ============================================================
  // OVERSTOCK
  // ============================================================

  /**
   * Get overstock for a branch
   */
  getOverstock: (params: { branchId?: string; masterProductId?: string; status?: string }) => {
    return api.get('/inventory/overstock', { params });
  },

  /**
   * Get overstock summary for a branch (grouped by product)
   */
  getOverstockSummary: (branchId: string) => {
    return api.get('/inventory/overstock/summary', { params: { branchId } });
  },

  /**
   * Preview overstock deduction for stock request items
   */
  previewOverstockDeduction: (branchId: string, items: Array<{ masterProductId: string; requestedQty: number; unit?: string }>) => {
    return api.post('/inventory/overstock/preview', { branchId, items });
  },

  /**
   * Get available overstock quantity for a specific product
   */
  getAvailableOverstock: (branchId: string, masterProductId: string) => {
    return api.get(`/inventory/overstock/available/${branchId}/${masterProductId}`);
  },

  // ============================================================
  // STOCK MUTATIONS
  // ============================================================

  /**
   * Get stock mutations with filters
   */
  getStockMutations: (filters: {
    inventoryItemId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters]) {
        params.append(key, String(filters[key as keyof typeof filters]));
      }
    });
    
    return api.get(`/inventory/stock-mutations?${params}`);
  },

  /**
   * Get inventory item by ID
   */
  getItem: (itemId: string) => {
    return api.get(`/inventory/items/${itemId}`);
  },
};
