// @ts-nocheck
import { ShipmentStatus, DiscrepancyType } from '@prisma/client';
import { ShipmentProcessingService } from './services/shipment-processing.service';
import { ShipmentRetrievalService } from './services/shipment-retrieval.service';

interface ReceiveShipmentInput {
  receivedItems?: Array<{
    masterProductId: string;
    receivedQty: number;
  }>;
  discrepancies?: Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: DiscrepancyType;
    notes?: string;
    photoUrl?: string;
    photoFileName?: string;
  }>;
  notes?: string;
}

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
   * Ship shipment (mark as shipped by Admin Manager)
   */
  async shipShipment(
    shipmentId: string, 
    userId: string, 
    data?: { 
      notes?: string;
      shipmentPhotoUrl?: string;
      shipmentPhotoName?: string;
    }
  ) {
    return await this.processingService.shipShipment(shipmentId, userId, data);
  }

  /**
   * Receive shipment (by Admin Cabang)
   * Supports receiving with discrepancy reporting
   */
  async receiveShipment(shipmentId: string, userId: string, input: ReceiveShipmentInput = {}) {
    return await this.processingService.receiveShipment(shipmentId, userId, input);
  }

  /**
   * Get shipments
   */
  async getShipments(branchIds?: string[], status?: ShipmentStatus) {
    return await this.retrievalService.getShipments(branchIds, status);
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string) {
    return await this.retrievalService.getShipmentById(shipmentId);
  }

  /**
   * @deprecated Use receiveShipment instead
   */
  async approveShipment(shipmentId: string, userId: string, branchId: string, notes?: string) {
    // Legacy method - redirect to receiveShipment
    return await this.processingService.receiveShipment(shipmentId, userId, { notes });
  }
}
