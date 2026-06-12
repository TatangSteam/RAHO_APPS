import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Role } from '@prisma/client';

export class StaffBranchAssignmentService {
  
  /**
   * Get all branches assigned to a user
   */
  async getUserBranches(userId: string) {
    const staffBranches = await prisma.staffBranch.findMany({
      where: { userId },
      include: { 
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
            city: true,
            type: true,
            isActive: true,
          }
        } 
      },
      orderBy: { createdAt: 'asc' },
    });
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    
    return staffBranches.map(sb => ({
      id: sb.id,
      userId: sb.userId,
      branchId: sb.branchId,
      branch: sb.branch,
      isPrimary: sb.branchId === user?.branchId,
      createdAt: sb.createdAt,
      updatedAt: sb.updatedAt,
    }));
  }
  
  /**
   * Assign user to a branch
   */
  async assignBranch(userId: string, branchId: string, assignedBy: string) {
    // Validate user exists and is staff
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    
    if (!user) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }
    
    if (user.role === Role.MEMBER) {
      throw { status: 400, code: 'INVALID_USER_TYPE', message: 'Can only assign branches to staff members' };
    }
    
    // Validate branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });
    
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Branch not found' };
    }
    
    // Check if already assigned
    const existing = await prisma.staffBranch.findUnique({
      where: { 
        userId_branchId: { userId, branchId } 
      },
    });
    
    if (existing) {
      throw { status: 409, code: 'ALREADY_ASSIGNED', message: 'User already assigned to this branch' };
    }
    
    // Create assignment
    const assignment = await prisma.staffBranch.create({
      data: { userId, branchId },
      include: { 
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
            city: true,
            type: true,
          }
        } 
      },
    });
    
    // Audit log
    await logAudit({
      userId: assignedBy,
      action: AuditAction.CREATE,
      resource: 'StaffBranch',
      resourceId: assignment.id,
      meta: { 
        targetUserId: userId, 
        branchId,
        branchName: branch.name,
      },
    });
    
    return assignment;
  }
  
  /**
   * Remove branch assignment
   */
  async removeBranchAssignment(userId: string, branchId: string, removedBy: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    
    // Cannot remove primary branch
    if (user?.branchId === branchId) {
      throw { 
        status: 400, 
        code: 'CANNOT_REMOVE_PRIMARY', 
        message: 'Cannot remove primary branch assignment' 
      };
    }
    
    const assignment = await prisma.staffBranch.findUnique({
      where: { 
        userId_branchId: { userId, branchId } 
      },
      include: {
        branch: {
          select: { name: true }
        }
      }
    });
    
    if (!assignment) {
      throw { status: 404, code: 'ASSIGNMENT_NOT_FOUND', message: 'Branch assignment not found' };
    }
    
    await prisma.staffBranch.delete({
      where: { id: assignment.id },
    });
    
    // Audit log
    await logAudit({
      userId: removedBy,
      action: AuditAction.DELETE,
      resource: 'StaffBranch',
      resourceId: assignment.id,
      meta: { 
        targetUserId: userId, 
        branchId,
        branchName: assignment.branch.name,
      },
    });
    
    return { message: 'Branch assignment removed successfully' };
  }
  
  /**
   * Validate user has access to branch
   */
  async validateBranchAccess(userId: string, branchId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    
    // Primary branch
    if (user?.branchId === branchId) {
      return true;
    }
    
    // Assigned branches
    const assignment = await prisma.staffBranch.findUnique({
      where: { 
        userId_branchId: { userId, branchId } 
      },
    });
    
    return !!assignment;
  }
  
  /**
   * Get all branch IDs assigned to a user (including primary)
   */
  async getUserBranchIds(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    
    const staffBranches = await prisma.staffBranch.findMany({
      where: { userId },
      select: { branchId: true },
    });
    
    const branchIds = new Set<string>();
    if (user?.branchId) {
      branchIds.add(user.branchId);
    }
    staffBranches.forEach(sb => branchIds.add(sb.branchId));
    
    return Array.from(branchIds);
  }
}
