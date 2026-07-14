import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { logger } from '@lib/logger';
import { sendError } from '@utils/response';

async function getAccessibleBranchIds(user: Request['user']): Promise<string[]> {
  if (user.role === Role.ADMIN_MANAGER) {
    const managerBranches = await prisma.managerBranch.findMany({
      where: { userId: user.userId },
      select: { branchId: true },
    });

    return managerBranches.map((managerBranch) => managerBranch.branchId);
  }

  if (user.role === Role.DOCTOR || user.role === Role.NURSE) {
    const staffBranches = await prisma.staffBranch.findMany({
      where: { userId: user.userId },
      select: { branchId: true },
    });

    const branchIds = staffBranches.map((staffBranch) => staffBranch.branchId);

    if (user.branchId && !branchIds.includes(user.branchId)) {
      branchIds.push(user.branchId);
    }

    return branchIds;
  }

  return user.branchId ? [user.branchId] : [];
}

/**
 * Assert that the authenticated staff has access to the requested member.
 *
 * Access is granted if any condition is met:
 * 1. The member's registration branch is accessible to the staff.
 * 2. A BranchMemberAccess record grants access to one of the staff branches.
 * 3. The staff role is SUPER_ADMIN.
 * 4. ADMIN_MANAGER has access through ManagerBranch assignments.
 *
 * Expects req.params.memberId and must run after authenticate.
 */
export async function assertBranchAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { user } = req;
  const memberId = req.params.memberId;

  if (!memberId) {
    next();
    return;
  }

  if (user.role === Role.SUPER_ADMIN) {
    next();
    return;
  }

  try {
    const accessibleBranchIds = await getAccessibleBranchIds(user);

    if (accessibleBranchIds.length === 0) {
      const message =
        user.role === Role.DOCTOR || user.role === Role.NURSE
          ? 'Anda belum di-assign ke cabang manapun.'
          : 'Anda tidak memiliki akses ke member ini.';

      sendError(res, 403, 'BRANCH_ACCESS_DENIED', message);
      return;
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        registrationBranchId: true,
        branchAccesses: {
          select: { branchId: true },
        },
      },
    });

    if (!member) {
      sendError(res, 404, 'MEMBER_NOT_FOUND', 'Member tidak ditemukan.');
      return;
    }

    const isRegistrationBranchAccessible = accessibleBranchIds.includes(
      member.registrationBranchId,
    );
    const hasGrantedAccess = member.branchAccesses.some((access) =>
      accessibleBranchIds.includes(access.branchId),
    );

    if (!isRegistrationBranchAccessible && !hasGrantedAccess) {
      sendError(res, 403, 'BRANCH_ACCESS_DENIED', 'Anda tidak memiliki akses ke member ini.');
      return;
    }

    next();
  } catch (error) {
    logger.error('Branch access assertion failed', { error, memberId, userId: user.userId });
    sendError(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
  }
}
