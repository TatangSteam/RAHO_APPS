import { api } from '../api';

// ============================================================
// TYPES
// ============================================================

export interface StockRequestItem {
  masterProductId: string;
  requestedQty: number;
  notes?: string;
}

export interface CreateStockRequestInput {
  items: StockRequestItem[];
  notes?: string;
}

export interface UpdateStockRequestInput {
  notes?: string;
  items?: StockRequestItem[];
}

export interface InvoiceItemInput {
  masterProductId: string;
  quantity: number;
  pricePerUnit: number;
}

export interface CreateInvoiceInput {
  items: InvoiceItemInput[];
  notes?: string;
  paymentMode?: 'NORMAL' | 'DEBT';
}

export interface ReceiveShipmentInput {
  receivedItems?: Array<{
    masterProductId: string;
    receivedQty: number;
  }>;
  discrepancies?: Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';
    notes?: string;
    photoUrl?: string;
  }>;
  notes?: string;
  receiptFile: File;
}

export interface ShipShipmentInput {
  notes?: string;
  shipmentPhotoUrl?: string;
  shipmentPhotoName?: string;
  items?: Array<{
    masterProductId: string;
    sentQty: number;
    overstockReason?: string;
  }>;
}

export interface UpdateShipmentInput {
  notes?: string;
  items?: Array<{
    masterProductId: string;
    sentQty: number;
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
  minThreshold: number;
  storageLocation: string | null;
  masterProduct: {
    id: string;
    name: string;
    category: string;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
    description: string | null;
  };
  stockInfo: {
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
    totalAmount: number;
    status: string;
    paymentVerificationStatus: string;
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
  toBranchId: string;
  toBranchName: string;
  toBranchCode?: string;
  toBranchType?: string;
  status: string;
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
    notes?: string;
    photoUrl?: string;
    photoFileName?: string;
    reportedBy?: string;
    createdAt?: string;
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
      items?: Array<{
        id: string;
        masterProductId: string;
        sku?: string;
        productName: string;
        description?: string;
        quantity: number;
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
    return api.get(`/inventory/available/${branchId}`, {
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
   * Adjust stock (Admin Cabang / Admin Manager / Super Admin)
   */
  adjustStock: (itemId: string, data: { adjustment: number; notes: string }) => {
    return api.patch(`/inventory/items/${itemId}/adjust-stock`, data);
  },

  /**
   * Get master products for inventory modal
   */
  getMasterProducts: () => {
    return api.get('/inventory/master-products');
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

  // ============================================================
  // SHIPMENTS
  // ============================================================

  /**
   * Get shipments
   */
  getShipments: (params?: { branchId?: string; status?: string; startDate?: string; endDate?: string }) => {
    return api.get('/inventory/shipments', { params });
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
    return api.post(`/inventory/shipments/${shipmentId}/ship`, data);
  },

  /**
   * Receive shipment (Admin Cabang)
   */
  receiveShipment: (shipmentId: string, data: ReceiveShipmentInput) => {
    const formData = new FormData();
    formData.append('receiptFile', data.receiptFile);

    if (data.receivedItems) {
      formData.append('receivedItems', JSON.stringify(data.receivedItems));
    }

    if (data.discrepancies) {
      formData.append('discrepancies', JSON.stringify(data.discrepancies));
    }

    if (data.notes) {
      formData.append('notes', data.notes);
    }

    return api.post(`/inventory/shipments/${shipmentId}/receive`, formData);
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
  previewOverstockDeduction: (branchId: string, items: Array<{ masterProductId: string; requestedQty: number }>) => {
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
