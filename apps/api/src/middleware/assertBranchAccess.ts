import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { sendError } from '@utils/response';

/**
 * Middleware — Assert that the authenticated staff has access to the requested member.
 *
 * Access is granted if ANY of these conditions is met:
 *   1. The member's registrationBranchId === staff's branchId
 *   2. A BranchMemberAccess record exists for (memberId, staff's branchId)
 *   3. Staff role is SUPER_ADMIN or ADMIN_MANAGER (global bypass)
 *   4. For DOCTOR/NURSE: member's branch is in their StaffBranch records
 *
 * Expects `req.params.memberId` to be set by the parent route.
 * Must be used AFTER `authenticate`.
 */
export async function assertBranchAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { user } = req;
  const memberId = req.params.memberId;

  console.log('🔐 [assertBranchAccess] Checking access');
  console.log('  - memberId:', memberId);
  console.log('  - user role:', user?.role);
  console.log('  - user branchId:', user?.branchId);

  if (!memberId) {
    console.log('⏭️  [assertBranchAccess] No memberId, skipping check');
    next();
    return;
  }

  // Global roles bypass branch access check
  if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN_MANAGER) {
    console.log('✅ [assertBranchAccess] Global role bypass:', user.role);
    next();
    return;
  }

  try {
    console.time('assertBranchAccess-query');
    
    // For DOCTOR and NURSE, get all accessible branches from StaffBranch table
    let accessibleBranchIds: string[] = [];
    
    if (user.role === Role.DOCTOR || user.role === Role.NURSE) {
      // Get branches from StaffBranch table
      const staffBranches = await prisma.staffBranch.findMany({
        where: { userId: user.userId },
        select: { branchId: true },
      });
      
      accessibleBranchIds = staffBranches.map(sb => sb.branchId);
      
      // Also include primary branchId if exists
      if (user.branchId && !accessibleBranchIds.includes(user.branchId)) {
        accessibleBranchIds.push(user.branchId);
      }
      
      console.log(`  - ${user.role} accessible branches:`, accessibleBranchIds);
      
      if (accessibleBranchIds.length === 0) {
        console.log('❌ [assertBranchAccess] No branches assigned to staff');
        sendError(res, 403, 'BRANCH_ACCESS_DENIED', 'Anda belum di-assign ke cabang manapun.');
        return;
      }
    } else {
      // For other roles (ADMIN_CABANG, ADMIN_LAYANAN), use primary branchId
      if (!user.branchId) {
        console.log('❌ [assertBranchAccess] No branchId for user');
        sendError(res, 403, 'BRANCH_ACCESS_DENIED', 'Anda tidak memiliki akses ke member ini.');
        return;
      }
      accessibleBranchIds = [user.branchId];
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
    console.timeEnd('assertBranchAccess-query');

    if (!member) {
      console.log('❌ [assertBranchAccess] Member not found');
      sendError(res, 404, 'MEMBER_NOT_FOUND', 'Member tidak ditemukan.');
      return;
    }

    // Check if member's registration branch is in accessible branches
    const isRegistrationBranchAccessible = accessibleBranchIds.includes(member.registrationBranchId);
    
    // Check if member has granted access to any of the accessible branches
    const hasGrantedAccess = member.branchAccesses.some(
      access => accessibleBranchIds.includes(access.branchId)
    );

    console.log('  - isRegistrationBranchAccessible:', isRegistrationBranchAccessible);
    console.log('  - hasGrantedAccess:', hasGrantedAccess);

    if (!isRegistrationBranchAccessible && !hasGrantedAccess) {
      console.log('❌ [assertBranchAccess] Access denied');
      sendError(res, 403, 'BRANCH_ACCESS_DENIED', 'Anda tidak memiliki akses ke member ini.');
      return;
    }

    console.log('✅ [assertBranchAccess] Access granted');
    next();
  } catch (error) {
    console.error('❌ [assertBranchAccess] Error:', error);
    sendError(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
  }
}
