import { Request, Response, NextFunction } from 'express';
import { PackagesService } from './packages.service';
import {
  assignPackageSchema,
  verifyPaymentSchema,
  createPackagePricingSchema,
  updatePackagePricingSchema,
} from './packages.schema';
import { sendSuccess, sendCreated } from '../../utils/response';

const packagesService = new PackagesService();

export class PackagesController {
  // Assign package to member
  async assignPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      console.log('\n=== assignPackage controller called ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const data = assignPackageSchema.parse(req.body);
      console.log('Parsed data:', JSON.stringify(data, null, 2));
      console.log('Number of package selections:', data.packages.length);
      data.packages.forEach((pkg, idx) => {
        console.log(`  Package ${idx}: pricingId=${pkg.pricingId}, quantity=${pkg.quantity}`);
      });
      
      const branchId = req.user?.branchId;
      const userId = req.user?.userId;

      if (!branchId || !userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.assignPackage(memberId, data, branchId, userId);
      return sendCreated(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Verify payment for package
  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.params;
      const data = verifyPaymentSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.verifyPayment(packageId, data, userId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Get member packages
  async getMemberPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const branchId = req.user?.branchId;

      if (!branchId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Branch information missing' };
      }

      const packages = await packagesService.getMemberPackages(memberId, branchId);
      return sendSuccess(res, packages);
    } catch (error) {
      console.error('getMemberPackages error:', error);
      next(error);
    }
  }

  // Get package pricings
  async getPackagePricings(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.user?.branchId;
      const userRole = req.user?.role;

      // ADMIN_MANAGER & SUPER_ADMIN can see all branches
      if (userRole === 'ADMIN_MANAGER' || userRole === 'SUPER_ADMIN') {
        const pricings = await packagesService.getAllPackagePricings();
        return sendSuccess(res, { pricings });
      }

      // Other roles need branchId
      if (!branchId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Branch information missing' };
      }

      const pricings = await packagesService.getPackagePricings(branchId);
      return sendSuccess(res, { pricings });
    } catch (error) {
      console.error('getPackagePricings error:', error);
      next(error);
    }
  }

  // Create package pricing
  async createPackagePricing(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createPackagePricingSchema.parse(req.body);
      const branchId = req.user?.branchId;
      const userId = req.user?.userId;

      if (!branchId || !userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const pricing = await packagesService.createPackagePricing(data, branchId, userId);
      return sendCreated(res, { pricing });
    } catch (error) {
      next(error);
    }
  }

  // Update package pricing
  async updatePackagePricing(req: Request, res: Response, next: NextFunction) {
    try {
      const { pricingId } = req.params;
      const data = updatePackagePricingSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const pricing = await packagesService.updatePackagePricing(pricingId, data, userId);
      return sendSuccess(res, { pricing });
    } catch (error) {
      next(error);
    }
  }

  // Delete package pricing
  async deletePackagePricing(req: Request, res: Response, next: NextFunction) {
    try {
      const { pricingId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.deletePackagePricing(pricingId, userId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
