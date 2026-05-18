// @ts-nocheck
import { InventoryItemsService } from './services/inventory-items.service';

/**
 * Main Inventory Service - Orchestrates inventory items operations
 */
export class InventoryService {
  private itemsService: InventoryItemsService;

  constructor() {
    this.itemsService = new InventoryItemsService();
  }

  /**
   * Get inventory items for a branch
   */
  async getInventoryItems(branchId: string) {
    return await this.itemsService.getInventoryItems(branchId);
  }

  /**
   * Get inventory item by ID
   */
  async getInventoryItemById(itemId: string) {
    return await this.itemsService.getInventoryItemById(itemId);
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(branchId?: string) {
    return await this.itemsService.getLowStockItems(branchId);
  }

  /**
   * Adjust stock (for Admin Cabang Pusat only)
   */
  async adjustStock(itemId: string, adjustment: number, notes: string | undefined, userId: string) {
    return await this.itemsService.adjustStock(itemId, adjustment, notes, userId);
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(data: {
    name?: string;
    category?: string;
    baseUnit?: string;
    usageUnit?: string;
    conversionFactor?: number;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
    masterProductId?: string;
    usageStock?: number;
    minThresholdUsage?: number;
  }, branchId: string, userId: string) {
    return await this.itemsService.createInventoryItem(data, branchId, userId);
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(itemId: string, data: {
    name?: string;
    category?: string;
    baseUnit?: string;
    usageUnit?: string;
    conversionFactor?: number;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
  }, userId: string) {
    return await this.itemsService.updateInventoryItem(itemId, data, userId);
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(itemId: string, userId: string) {
    return await this.itemsService.deleteInventoryItem(itemId, userId);
  }

  /**
   * Batch create inventory items
   */
  async batchCreateInventoryItems(items: Array<{
    masterProductId: string;
    stock?: number;
    minThreshold?: number;
    storageLocation?: string;
  }>, branchId: string, userId: string) {
    return await this.itemsService.batchCreateInventoryItems(items, branchId, userId);
  }
}
