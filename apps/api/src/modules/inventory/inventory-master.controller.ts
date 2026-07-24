import { NextFunction, Request, Response } from 'express';
import { sendCreated, sendSuccess } from '@utils/response';
import {
  conversionPreviewSchema,
  createBatchSchema,
  createMasterProductSchema,
  createStockLocationSchema,
  createUomSchema,
  createWarehouseSchema,
  masterListQuerySchema,
  updateBatchSchema,
  updateMasterProductSchema,
  updateStockLocationSchema,
  updateUomSchema,
  updateWarehouseSchema,
} from './inventory-master.schema';
import {
  createBatch,
  createMasterProduct,
  createStockLocation,
  createUom,
  createWarehouse,
  deactivateStockLocation,
  deactivateWarehouse,
  listBatches,
  listStockLocations,
  listUoms,
  listWarehouses,
  updateBatch,
  updateMasterProduct,
  updateStockLocation,
  updateUom,
  updateWarehouse,
} from './services/inventory-master.service';
import { UnitConversionService } from './services/unit-conversion.service';

export class InventoryMasterController {
  async listWarehouses(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listWarehouses(req.user.userId, masterListQuerySchema.parse(req.query))); } catch (error) { next(error); }
  }
  async createWarehouse(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await createWarehouse(req.user.userId, createWarehouseSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async updateWarehouse(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await updateWarehouse(req.user.userId, req.params.id, updateWarehouseSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async deactivateWarehouse(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await deactivateWarehouse(req.user.userId, req.params.id)); } catch (error) { next(error); }
  }
  async listLocations(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listStockLocations(req.user.userId, String(req.query.warehouseId || ''), req.query.includeInactive === 'true')); } catch (error) { next(error); }
  }
  async createLocation(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await createStockLocation(req.user.userId, createStockLocationSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async updateLocation(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await updateStockLocation(req.user.userId, req.params.id, updateStockLocationSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async deactivateLocation(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await deactivateStockLocation(req.user.userId, req.params.id)); } catch (error) { next(error); }
  }
  async listUoms(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listUoms(req.user.userId, req.query.includeInactive === 'true')); } catch (error) { next(error); }
  }
  async createUom(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await createUom(req.user.userId, createUomSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async updateUom(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await updateUom(req.user.userId, req.params.id, updateUomSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async createProduct(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await createMasterProduct(req.user.userId, createMasterProductSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await updateMasterProduct(req.user.userId, req.params.productId, updateMasterProductSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async previewConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const input = conversionPreviewSchema.parse(req.body);
      sendSuccess(res, UnitConversionService.preview(input));
    } catch (error) { next(error); }
  }
  async listBatches(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await listBatches(req.user.userId, req.query.masterProductId as string | undefined, req.query.includeBlocked === 'true')); } catch (error) { next(error); }
  }
  async createBatch(req: Request, res: Response, next: NextFunction) {
    try { sendCreated(res, await createBatch(req.user.userId, createBatchSchema.parse(req.body))); } catch (error) { next(error); }
  }
  async updateBatch(req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await updateBatch(req.user.userId, req.params.id, updateBatchSchema.parse(req.body))); } catch (error) { next(error); }
  }
}
