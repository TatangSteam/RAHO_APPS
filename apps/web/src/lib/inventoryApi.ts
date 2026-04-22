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
};
