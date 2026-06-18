// @ts-nocheck
import { InventoryItemsService } from './services/inventory-items.service';
import { prisma } from '../../lib/prisma';
import { StockMutationType } from '@prisma/client';

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

  /**
   * Get stock mutations with filters
   * Now supports filtering by multiple branches (for Admin Manager)
   */
  async getStockMutations(filters: {
    inventoryItemId?: string;
    type?: StockMutationType;
    startDate?: string;
    endDate?: string;
    branchIds?: string[];
    page?: number;
    limit?: number;
  }) {
    const { 
      inventoryItemId, 
      type, 
      startDate, 
      endDate, 
      branchIds,
      page = 1, 
      limit = 50 
    } = filters;

    const where: any = {};

    // Filter by item
    if (inventoryItemId) {
      where.inventoryItemId = inventoryItemId;
    }

    // Filter by type
    if (type) {
      where.type = type;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Filter by branches (via inventoryItem)
    // If branchIds is provided, filter by multiple branches
    // If not provided (undefined), show all branches (for Super Admin)
    if (branchIds && branchIds.length > 0) {
      if (branchIds.length === 1) {
        // Single branch - use simple filter
        where.inventoryItem = { branchId: branchIds[0] };
      } else {
        // Multiple branches - use IN filter
        where.inventoryItem = { 
          branchId: { in: branchIds } 
        };
      }
    }

    // Get total count
    const total = await prisma.stockMutation.count({ where });

    // Get mutations with relations
    const mutations = await prisma.stockMutation.findMany({
      where,
      include: {
        inventoryItem: {
          include: {
            masterProduct: true,
            branch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Format response with reference info
    const formattedMutations = await Promise.all(
      mutations.map(async (mutation) => {
        let referenceInfo = null;

        // Get reference details based on referenceType
        if (mutation.referenceType === 'MaterialUsage' && mutation.referenceId) {
          const materialUsage = await prisma.materialUsage.findUnique({
            where: { id: mutation.referenceId },
            include: {
              treatmentSession: {
                include: {
                  member: { include: { profile: true } },
                },
              },
            },
          });

          if (materialUsage) {
            referenceInfo = {
              type: 'session',
              id: materialUsage.treatmentSessionId,
              sessionCode: materialUsage.treatmentSession.sessionCode,
              memberName: materialUsage.treatmentSession.member.profile.fullName,
              treatmentDate: materialUsage.treatmentSession.treatmentDate,
            };
          }
        } else if (mutation.referenceType === 'Shipment' && mutation.referenceId) {
          const shipment = await prisma.shipment.findUnique({
            where: { id: mutation.referenceId },
            select: {
              shipmentCode: true,
              branchFrom: { select: { name: true } },
              branchTo: { select: { name: true } },
            },
          });

          if (shipment) {
            referenceInfo = {
              type: 'shipment',
              id: mutation.referenceId,
              shipmentCode: shipment.shipmentCode,
              from: shipment.branchFrom.name,
              to: shipment.branchTo.name,
            };
          }
        }

        // Get user name
        const user = await prisma.user.findUnique({
          where: { id: mutation.createdBy },
          select: { profile: { select: { fullName: true } } },
        });

        return {
          ...mutation,
          referenceInfo,
          createdByName: user?.profile?.fullName || 'Unknown',
        };
      })
    );

    return {
      data: formattedMutations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export stock mutations to Excel
   */
  async exportStockMutations(filters: any) {
    const { data } = await this.getStockMutations({ ...filters, limit: 10000 });

    // Use ExcelJS to create workbook
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Mutations');

    // Add headers
    worksheet.columns = [
      { header: 'Tanggal', key: 'createdAt', width: 20 },
      { header: 'Item', key: 'itemName', width: 30 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Stock Before', key: 'stockBefore', width: 12 },
      { header: 'Stock After', key: 'stockAfter', width: 12 },
      { header: 'Reference', key: 'reference', width: 25 },
      { header: 'User', key: 'user', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Add data
    data.forEach((mutation: any) => {
      worksheet.addRow({
        createdAt: new Date(mutation.createdAt).toLocaleString('id-ID'),
        itemName: mutation.inventoryItem.masterProduct.name,
        sku: mutation.inventoryItem.masterProduct.sku,
        type: mutation.type,
        quantity: Number(mutation.quantity),
        stockBefore: Number(mutation.stockBefore),
        stockAfter: Number(mutation.stockAfter),
        reference: mutation.referenceInfo
          ? mutation.referenceInfo.type === 'session'
            ? `Session: ${mutation.referenceInfo.sessionCode}`
            : `Shipment: ${mutation.referenceInfo.shipmentCode}`
          : '-',
        user: mutation.createdByName,
        notes: mutation.notes || '-',
      });
    });

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD4A853' },
    };

    return workbook;
  }
}
