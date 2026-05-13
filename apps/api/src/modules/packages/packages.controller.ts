import { Request, Response, NextFunction } from 'express';
import { PackagesService } from './packages.service';
import { prisma } from '@lib/prisma';
import {
  assignPackageSchema,
  verifyPaymentSchema,
  createPackagePricingSchema,
  updatePackagePricingSchema,
  refundPackageSchema,
  cancelPackageSchema,
  editPackageSchema,
} from './packages.schema';
import { sendSuccess, sendCreated } from '../../utils/response';
import { env } from '../../config/env';
import { uploadFile } from '../../config/minio';

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
      const branchId = req.user?.branchId;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.verifyPayment(packageId, data, branchId, userId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Get member packages
  async getMemberPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const { branchId, role } = req.user!;

      console.log('🎯 [Packages Controller] getMemberPackages called');
      console.log('  - memberId:', memberId);
      console.log('  - branchId:', branchId);
      console.log('  - role:', role);

      // ADMIN_MANAGER and SUPER_ADMIN should ALWAYS use member's registration branch
      // They can view packages across all branches
      let effectiveBranchId = branchId;
      
      if (role === 'ADMIN_MANAGER' || role === 'SUPER_ADMIN') {
        console.log('  - Global role detected, fetching member registration branch');
        const member = await prisma.member.findUnique({
          where: { id: memberId },
          select: { registrationBranchId: true }
        });
        
        if (!member) {
          throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
        }
        
        effectiveBranchId = member.registrationBranchId;
        console.log('  - Using member registration branch:', effectiveBranchId);
      } else if (!branchId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Branch information missing' };
      }

      const packages = await packagesService.getMemberPackages(memberId, effectiveBranchId);
      console.log('✅ [Packages Controller] Returning', packages.length, 'packages');
      return sendSuccess(res, packages);
    } catch (error) {
      console.error('❌ [Packages Controller] getMemberPackages error:', error);
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

  // Upload payment proof file
  async uploadPaymentProof(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw { status: 400, code: 'FILE_REQUIRED', message: 'File bukti pembayaran wajib diupload' };
      }

      // Validate file type - ONLY IMAGES
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        throw { 
          status: 400, 
          code: 'INVALID_FILE_TYPE', 
          message: 'Format file harus JPG atau PNG' 
        };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        throw { 
          status: 400, 
          code: 'FILE_TOO_LARGE', 
          message: 'Ukuran file maksimal 5MB' 
        };
      }

      const userId = req.user?.userId;
      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      // Generate unique key for the file
      const timestamp = Date.now();
      const fileExt = req.file.mimetype.split('/')[1];
      const key = `uploads/payment-proofs/${userId}/${timestamp}.${fileExt}`;

      // Upload to MinIO
      const uploadResult = await uploadFile(req.file.buffer, key, req.file.mimetype);
      const apiUrl = `${env.API_PREFIX}/files/${key}`;

      return sendSuccess(res, {
        url: apiUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      next(error);
    }
  }

  // Refund package
  async refundPackage(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('=== refundPackage controller called ===');
      console.log('packageId:', req.params.packageId);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const { packageId } = req.params;
      const data = refundPackageSchema.parse(req.body);
      
      console.log('Parsed data:', JSON.stringify(data, null, 2));
      
      const userId = req.user?.userId;
      const branchId = req.user?.branchId || null;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.refundPackage(packageId, {
        reason: data.reason,
        refundAmount: data.refundAmount
      }, userId, branchId);
      return sendSuccess(res, result);
    } catch (error) {
      console.log('refundPackage controller error:', error);
      next(error);
    }
  }

  // Cancel package
  async cancelPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.params;
      const data = cancelPackageSchema.parse(req.body);
      const userId = req.user?.userId;
      const branchId = req.user?.branchId || null;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.cancelPackage(packageId, {
        reason: data.reason
      }, userId, branchId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // Edit package
  async editPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { packageId } = req.params;
      console.log('\n=== editPackage controller called ===');
      console.log('packageId:', packageId);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      const data = editPackageSchema.parse(req.body);
      console.log('Parsed data:', JSON.stringify(data, null, 2));
      
      const userId = req.user?.userId;
      const branchId = req.user?.branchId || null;

      if (!userId) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'User information missing' };
      }

      const result = await packagesService.editPackage(packageId, data, userId, branchId);
      return sendSuccess(res, result);
    } catch (error) {
      console.error('editPackage controller error:', error);
      next(error);
    }
  }
}
