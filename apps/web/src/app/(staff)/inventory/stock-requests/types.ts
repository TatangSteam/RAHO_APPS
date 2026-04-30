export interface StockRequest {
  id: string;
  requestCode: string;
  branchName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  itemCount: number;
  items: Array<{
    id: string;
    productName: string;
    requestedQty: number;
    unit: string;
    notes?: string;
  }>;
  notes?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

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

export interface RequestItem {
  inventoryItemId: string;
  productName: string;
  requestedQty: number;
  unit: string;
  notes?: string;
}

export type FilterType = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type StockFilterType = 'ALL' | 'LOW_STOCK' | 'IN_STOCK';