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
}
