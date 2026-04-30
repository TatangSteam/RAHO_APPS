import { api } from './api';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string | null;
  stock: number;
  minThreshold: number;
  storageLocation: string | null;
  isLowStock: boolean;
  masterProductId: string;
  branchId: string;
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

export const inventoryApi = {
  getInventoryItems: async (branchId?: string): Promise<InventoryItem[]> => {
    const params = branchId ? `?branchId=${branchId}` : '';
    const response = await api.get(`/inventory/items${params}`);
    return response.data.data;
  },

  getInventoryItemById: async (itemId: string): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/items/${itemId}`);
    return response.data.data;
  },

  getAvailableItems: async (branchId: string) => {
    const response = await api.get(`/inventory/available/${branchId}`);
    return response.data;
  },
};
