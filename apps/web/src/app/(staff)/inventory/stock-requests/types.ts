// ============================================================
// STOCK REQUEST TYPES
// ============================================================

export type StockRequestStatus = 
  | 'PENDING' 
  | 'APPROVED' 
  | 'WAITING_PAYMENT' 
  | 'PAYMENT_UPLOADED' 
  | 'PAYMENT_CONFIRMED' 
  | 'REJECTED' 
  | 'SHIPPED' 
  | 'COMPLETED' 
  | 'COMPLETED_WITH_ISSUE';

export type BranchType = 'PREMIER' | 'PARTNERSHIP' | 'PUSAT';

export interface StockRequestItem {
  id: string;
  masterProductId: string;
  productName: string;
  productCategory: string;
  requestedQty: number;
  approvedQty?: number;
  overstockDeducted?: number;
  finalQty?: number;
  unit: string;
  notes?: string;
  overstockUsages?: Array<{
    id: string;
    quantityUsed: number;
    reason?: string;
    sourceShipmentCode?: string;
  }>;
}

export interface StockRequestInvoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  totalAmount: number;
  status: string;
  paymentVerificationStatus: string;
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  verifiedAt?: string;
  paidAt?: string;
  rejectionReason?: string;
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
  createdAt?: string;
}

export interface StockRequestShipment {
  id: string;
  shipmentCode: string;
  fromBranchId?: string;
  fromBranchName?: string;
  toBranchId?: string;
  toBranchName?: string;
  status: string;
  notes?: string;
  items?: Array<{
    id: string;
    masterProductId: string;
    productName: string;
    sentQty: number;
    receivedQty?: number;
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
  }>;
  shippedAt?: string;
  shippedBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  createdAt?: string;
}

export interface StockRequest {
  id: string;
  requestCode: string;
  branchId: string;
  branchName: string;
  branchType: BranchType;
  status: StockRequestStatus;
  notes?: string;
  itemCount: number;
  totalItems?: number;
  items: StockRequestItem[];
  
  // Invoice (for Partnership)
  invoice?: StockRequestInvoice;
  
  // Shipment
  shipment?: StockRequestShipment;
  
  // Payment info
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofFileSize?: number;
  paymentProofMimeType?: string;
  paymentUploadedAt?: string;
  paymentUploadedBy?: string;
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: string;
  paymentVerificationNotes?: string;
  paymentRejectionReason?: string;
  
  // Review info
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  
  // Shipping info
  shippedBy?: string;
  shippedAt?: string;
  
  // Receiving info
  receivedBy?: string;
  receivedAt?: string;
  receivingNotes?: string;
  
  createdAt: string;
  updatedAt?: string;
}

// ============================================================
// INVENTORY ITEM TYPES
// ============================================================

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string; // Legacy field
  baseUnit: string; // Storage unit (botol, box, pack)
  usageUnit: string; // Usage unit (ml, tablet, gram)
  conversionFactor: number; // How many usage units per base unit
  description?: string;
  
  // Stock in base unit (storage)
  stock: number;
  minThreshold: number;
  
  // Stock in usage unit (consumption)
  usageStock: number;
  minThresholdUsage: number;
  
  // Display strings
  stockDisplay: string; // "10 botol (5000 ml)"
  thresholdDisplay: string; // "2 botol (1000 ml)"
  
  storageLocation?: string;
  isLowStock: boolean;
  masterProductId: string;
  branchId: string;
}

export interface MasterProduct {
  id: string;
  name: string;
  sku?: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description?: string;
  isActive: boolean;
}

// ============================================================
// REQUEST ITEM (for creating requests)
// ============================================================

export interface RequestItem {
  masterProductId: string;
  productName: string;
  requestedQty: number;
  unit: string;
  notes?: string;
  // Legacy support - some components may still use this
  inventoryItemId?: string;
}

// Legacy support
export interface LegacyRequestItem {
  inventoryItemId: string;
  productName: string;
  requestedQty: number;
  unit: string;
  notes?: string;
}

// ============================================================
// INVOICE ITEM (for creating invoices)
// ============================================================

export interface InvoiceItemInput {
  masterProductId: string;
  quantity: number;
  pricePerUnit: number;
}

// ============================================================
// DISCREPANCY TYPES
// ============================================================

export type DiscrepancyType = 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';

export interface DiscrepancyItem {
  masterProductId: string;
  expectedQty: number;
  receivedQty: number;
  discrepancyType: DiscrepancyType;
  notes?: string;
  photoUrl?: string;
}

// ============================================================
// FILTER TYPES
// ============================================================

export type FilterType = 'ALL' | 'PENDING' | 'APPROVED' | 'WAITING_PAYMENT' | 'PAYMENT_UPLOADED' | 'SHIPPED' | 'COMPLETED' | 'REJECTED';
export type StockFilterType = 'ALL' | 'LOW_STOCK' | 'IN_STOCK';

// ============================================================
// STATUS HELPERS
// ============================================================

export const STATUS_LABELS: Record<StockRequestStatus, string> = {
  PENDING: 'Menunggu Review',
  APPROVED: 'Disetujui',
  WAITING_PAYMENT: 'Menunggu Pembayaran',
  PAYMENT_UPLOADED: 'Bukti Pembayaran Diupload',
  PAYMENT_CONFIRMED: 'Pembayaran Dikonfirmasi',
  REJECTED: 'Ditolak',
  SHIPPED: 'Dikirim',
  COMPLETED: 'Selesai',
  COMPLETED_WITH_ISSUE: 'Selesai (Ada Masalah)',
};

export const STATUS_COLORS: Record<StockRequestStatus, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  WAITING_PAYMENT: '#8b5cf6',
  PAYMENT_UPLOADED: '#3b82f6',
  PAYMENT_CONFIRMED: '#06b6d4',
  REJECTED: '#ef4444',
  SHIPPED: '#6366f1',
  COMPLETED: '#22c55e',
  COMPLETED_WITH_ISSUE: '#f97316',
};

export const STATUS_ICONS: Record<StockRequestStatus, string> = {
  PENDING: '⏳',
  APPROVED: '✅',
  WAITING_PAYMENT: '💳',
  PAYMENT_UPLOADED: '📤',
  PAYMENT_CONFIRMED: '✓',
  REJECTED: '❌',
  SHIPPED: '🚚',
  COMPLETED: '✔️',
  COMPLETED_WITH_ISSUE: '⚠️',
};
