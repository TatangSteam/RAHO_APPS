import { Request, Response, NextFunction } from 'express';
import {
  createBranchSchema,
  updateBranchSchema,
  listBranchesQuerySchema,
} from './branches.schema';
import {
  listBranchesService,
  getBranchWithStatsService,
  getAllBranchesWithStatsService,
  createBranchService,
  updateBranchService,
  deleteBranchService,
} from './branches.service';
import { sendSuccess, sendCreated, sendNoContent, buildPaginationMeta } from '@utils/response';
import { logAudit } from '@utils/auditLog';

// ── List Branches ─────────────────────────────────────────────
export async function listBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listBranchesQuerySchema.parse(req.query);
    const { branches, total, page, limit } = await listBranchesService(query);
    sendSuccess(res, branches, 200, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

// ── Get All Branches with Stats ───────────────────────────────
export async function getAllBranchesWithStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const branches = await getAllBranchesWithStatsService(userId, userRole);
    sendSuccess(res, branches);
  } catch (err) {
    next(err);
  }
}

// ── Get Single Branch ─────────────────────────────────────────
export async function getBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const branch = await getBranchWithStatsService(req.params.branchId);
    sendSuccess(res, branch);
  } catch (err) {
    next(err);
  }
}

// ── Create Branch ─────────────────────────────────────────────
export async function createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('📝 Create Branch Request Body:', JSON.stringify(req.body, null, 2));
    
    const input = createBranchSchema.parse(req.body);
    console.log('✅ Validation passed:', JSON.stringify(input, null, 2));
    
    const createdBy = req.user.userId;
    console.log('👤 Created by:', createdBy);
    
    const branch = await createBranchService(input, createdBy);
    console.log('✅ Branch created:', branch.id);

    await logAudit({
      userId: req.user.userId,
      action: 'CREATE',
      resource: 'Branch',
      resourceId: branch.id,
      meta: { branchCode: branch.branchCode, name: branch.name },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendCreated(res, branch);
  } catch (err) {
    console.error('❌ Create Branch Error:', err);
    next(err);
  }
}

// ── Update Branch ─────────────────────────────────────────────
export async function updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = updateBranchSchema.parse(req.body);
    const branch = await updateBranchService(req.params.branchId, input);

    await logAudit({
      userId: req.user.userId,
      action: 'UPDATE',
      resource: 'Branch',
      resourceId: branch.id,
      meta: { changes: input },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, branch);
  } catch (err) {
    next(err);
  }
}

// ── Delete Branch ─────────────────────────────────────────────
export async function deleteBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteBranchService(req.params.branchId);

    await logAudit({
      userId: req.user.userId,
      action: 'DELETE',
      resource: 'Branch',
      resourceId: req.params.branchId,
      meta: { action: 'soft_delete' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendNoContent(res);
  } catch (err) {
    next(err);
  }
}
