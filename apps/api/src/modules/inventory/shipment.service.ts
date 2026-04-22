// @ts-nocheck
import { ShipmentStatus } from '@prisma/client';
import { ShipmentProcessingService } from './services/shipment-processing.service';
import { ShipmentRetrievalService } from './services/shipment-retrieval.service';

/**
 * Main Shipment Service - Orchestrates shipment operations
 */
export class ShipmentService {
  private processingService: ShipmentProcessingService;
  private retrievalService: ShipmentRetrievalService;

  constructor() {
    this.processingService = new ShipmentProcessingService();
    this.retrievalService = new ShipmentRetrievalService();
  }

  /**
   * Ship shipment (mark as shipped)
   */
  async shipShipment(shipmentId: string, userId: string, notes?: string) {
    return await this.processingService.shipShipment(shipmentId, userId, notes);
  }

  /**
   * Receive shipment (mark as received)
   */
  async receiveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    return await this.processingService.receiveShipment(shipmentId, userId, branchId, notes);
  }

  /**
   * Approve shipment (add stock to destination)
   */
  async approveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    return await this.processingService.approveShipment(shipmentId, userId, branchId, notes);
  }

  /**
   * Get shipments
   */
  async getShipments(branchId?: string, status?: ShipmentStatus) {
    return await this.retrievalService.getShipments(branchId, status);
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string) {
    return await this.retrievalService.getShipmentById(shipmentId);
  }
}
