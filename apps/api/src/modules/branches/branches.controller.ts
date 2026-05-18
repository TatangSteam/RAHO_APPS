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
  getBranchManagersService,
  assignManagerToBranchService,
  unassignManagerFromBranchService,
  getAvailableManagersForBranchService,
} from './branches.service';
import { sendSuccess, sendCreated, sendNoContent, buildPaginationMeta } from '@utils/response';
import { logAudit } from '@utils/auditLog';

// ── List Branches ─────────────────────────────────────────────
export async function listBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listBranchesQuerySchema.parse(req.query);
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { branches, total, page, limit } = await listBranchesService(query, userId, userRole);
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
    console.log('🎯 getAllBranchesWithStats controller - userId:', userId, 'role:', userRole);
    const branches = await getAllBranchesWithStatsService(userId, userRole);
    console.log('✅ Returning', branches.length, 'branches');
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
    const userRole = req.user.role;
    console.log('👤 Created by:', createdBy, 'Role:', userRole);
    
    const branch = await createBranchService(input, createdBy, userRole);
    console.log('✅ Branch created:', branch.id);

    await logAudit({
      userId: req.user.userId,
      branchId: branch.id, // Use the newly created branch ID
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
      branchId: req.params.branchId, // Use the branch being updated
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
      branchId: req.params.branchId, // Use the branch being deleted
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

// ── Get Branch Managers ───────────────────────────────────────
export async function getBranchManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getBranchManagersService(req.params.branchId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Assign Manager to Branch ──────────────────────────────────
export async function assignManagerToBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { branchId } = req.params;
    const { managerId } = req.body;

    if (!managerId) {
      res.status(400).json({ success: false, message: 'managerId is required' });
      return;
    }

    const result = await assignManagerToBranchService(branchId, managerId);

    await logAudit({
      userId: req.user.userId,
      branchId: branchId,
      action: 'CREATE',
      resource: 'ManagerBranch',
      resourceId: `${managerId}_${branchId}`,
      meta: { action: 'assign_manager', managerId, branchId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Unassign Manager from Branch ──────────────────────────────
export async function unassignManagerFromBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { branchId, managerId } = req.params;

    const result = await unassignManagerFromBranchService(branchId, managerId);

    await logAudit({
      userId: req.user.userId,
      branchId: branchId,
      action: 'DELETE',
      resource: 'ManagerBranch',
      resourceId: `${managerId}_${branchId}`,
      meta: { action: 'unassign_manager', managerId, branchId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// ── Get Available Managers for Branch ─────────────────────────
export async function getAvailableManagersForBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const managers = await getAvailableManagersForBranchService(req.params.branchId);
    sendSuccess(res, managers);
  } catch (err) {
    next(err);
  }
}
