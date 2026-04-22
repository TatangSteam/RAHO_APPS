// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';

/**
 * Service for managing member branch access
 */
export class MemberBranchAccessService {
  /**
   * Grant branch access to member
   */
  async grantAccess(memberNo: string, branchId: string, userId: string) {
    // Find member
    const member = await prisma.member.findUnique({
      where: { memberNo },
      include: {
        branchAccesses: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if already has access
    const existingAccess = member.branchAccesses.find(
      access => access.branchId === branchId
    );

    if (existingAccess) {
      throw {
        status: 409,
        code: 'ACCESS_EXISTS',
        message: 'Member sudah memiliki akses ke cabang ini',
      };
    }

    // Check if branch exists
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // Grant access
    await prisma.memberBranchAccess.create({
      data: {
        memberId: member.id,
        branchId,
        grantedBy: userId,
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId: member.userId,
        type: 'INFO',
        title: 'Akses Cabang Baru',
        body: `Anda sekarang memiliki akses ke cabang ${branch.name}`,
        status: 'UNREAD',
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'MemberBranchAccess',
      resourceId: member.id,
      meta: { memberNo, branchId, branchName: branch.name },
    });

    return {
      message: 'Akses cabang berhasil diberikan',
      member: {
        id: member.id,
        memberNo: member.memberNo,
        fullName: member.fullName,
      },
      branch: {
        id: branch.id,
        name: branch.name,
        branchCode: branch.branchCode,
      },
    };
  }
}
