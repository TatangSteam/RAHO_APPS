import { Request, Response, NextFunction } from 'express';
import { NonTherapyService } from './non-therapy.service';
import {
  createNonTherapyProductSchema,
  updateNonTherapyProductSchema,
  assignNonTherapyToMemberSchema,
  verifyNonTherapyPurchaseSchema,
} from './non-therapy.schema';
import { sendSuccess, sendCreated } from '../../utils/response';

const service = new NonTherapyService();

export class NonTherapyController {
  // ============================================================
  // PRODUCT MANAGEMENT
  // ============================================================

  async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { productType, isActive } = req.query;

      const filters: any = {};
      if (productType) filters.productType = productType;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const products = await service.getAllProducts(filters);

      return sendSuccess(res, products);
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const product = await service.getProductById(productId);

      return sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createNonTherapyProductSchema.parse(req.body);
      const userId = req.user!.userId;

      const product = await service.createProduct(data, userId);

      return sendCreated(res, product);
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const data = updateNonTherapyProductSchema.parse(req.body);
      const userId = req.user!.userId;

      const product = await service.updateProduct(productId, data, userId);

      return sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const userId = req.user!.userId;

      const result = await service.deleteProduct(productId, userId);

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // MEMBER PURCHASES
  // ============================================================

  async assignToMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const data = assignNonTherapyToMemberSchema.parse(req.body);
      const branchId = req.user!.branchId!;
      const userId = req.user!.userId;

      const purchase = await service.assignToMember(memberId, data, branchId, userId);

      return sendCreated(res, purchase);
    } catch (error) {
      next(error);
    }
  }

  async getMemberPurchases(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const branchId = req.user!.branchId!;

      const purchases = await service.getMemberPurchases(memberId, branchId);

      return sendSuccess(res, purchases);
    } catch (error) {
      next(error);
    }
  }

  async verifyPurchase(req: Request, res: Response, next: NextFunction) {
    try {
      const { purchaseId } = req.params;
      const data = verifyNonTherapyPurchaseSchema.parse(req.body);
      const userId = req.user!.userId;

      const result = await service.verifyPurchase(purchaseId, data, userId);

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
