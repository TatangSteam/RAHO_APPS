import { api } from '../api';

export const inventoryApi = {
  /**
   * Get available inventory items for a branch with stock info in both units
   */
  getAvailableItems: (branchId: string) => {
    return api.get(`/inventory/available/${branchId}`);
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
   * Get stock mutations history
   */
  getStockMutations: (inventoryItemId: string, params?: { limit?: number; offset?: number }) => {
    return api.get(`/inventory/mutations/${inventoryItemId}`, { params });
  },

  /**
   * Get low stock items
   */
  getLowStockItems: (branchId: string) => {
    return api.get(`/inventory/low-stock/${branchId}`);
  },

  /**
   * Create stock request
   */
  createStockRequest: (data: {
    branchId: string;
    items: Array<{ inventoryItemId: string; requestedQty: number; notes?: string }>;
    notes?: string;
  }) => {
    return api.post('/inventory/stock-requests', data);
  },

  /**
   * Get stock requests
   */
  getStockRequests: (params?: { branchId?: string; status?: string }) => {
    return api.get('/inventory/stock-requests', { params });
  },

  /**
   * Adjust stock (Admin Pusat only)
   */
  adjustStock: (itemId: string, data: { adjustment: number; reason: string }) => {
    return api.patch(`/inventory/items/${itemId}/adjust-stock`, data);
  },
};
