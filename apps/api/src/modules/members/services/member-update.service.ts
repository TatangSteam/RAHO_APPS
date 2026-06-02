// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { deleteFileByUrl } from '../../../config/minio';

const HASH_ROUNDS = 12;

/**
 * Service for updating member data
 */
export class MemberUpdateService {
  /**
   * Update member
   */
  async updateMember(
    memberId: string,
    data: {
      fullName?: string;
      birthDate?: string;
      gender?: string;
      religion?: string;
      phone?: string;
      email?: string;
      address?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    },
    userId: string
  ) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if phone number is being changed and already exists
    if (data.phone && data.phone !== member.user.profile?.phone) {
      const existingPhone = await prisma.userProfile.findFirst({
        where: { 
          phone: data.phone,
          userId: { not: member.userId }
        },
      });

      if (existingPhone) {
        throw {
          status: 409,
          code: 'PHONE_EXISTS',
          message: 'Nomor telepon sudah terdaftar',
        };
      }
    }

    // Check if email is being changed and already exists
    if (data.email && data.email !== member.user.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { 
          email: data.email,
          id: { not: member.userId }
        },
      });

      if (existingEmail) {
        throw {
          status: 409,
          code: 'EMAIL_EXISTS',
          message: 'Email sudah terdaftar',
        };
      }
    }

    // Update in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update User table (email)
      if (data.email) {
        await tx.user.update({
          where: { id: member.userId },
          data: { email: data.email }
        });
      }

      // Update UserProfile table (fullName, phone)
      if (data.fullName || data.phone) {
        await tx.userProfile.update({
          where: { userId: member.userId },
          data: {
            ...(data.fullName && { fullName: data.fullName }),
            ...(data.phone && { phone: data.phone })
          }
        });
      }

      // Update Member table (member-specific fields)
      const memberUpdateData: any = {};
      if (data.birthDate) memberUpdateData.dateOfBirth = new Date(data.birthDate);
      if (data.gender) memberUpdateData.jenisKelamin = data.gender;
      if (data.religion !== undefined) memberUpdateData.agama = data.religion || null;
      if (data.address) memberUpdateData.address = data.address;
      if (data.emergencyContactName) memberUpdateData.emergencyContact = data.emergencyContactName;

      if (Object.keys(memberUpdateData).length > 0) {
        await tx.member.update({
          where: { id: memberId },
          data: memberUpdateData
        });
      }

      // Return updated member
      return await tx.member.findUnique({
        where: { id: memberId },
        include: {
          user: {
            include: {
              profile: true
            }
          },
          registrationBranch: true,
          branchAccesses: {
            include: {
              branch: true,
            },
          },
        },
      });
    });

    // Audit log
    await logAudit({
      userId,
      branchId: updated.registrationBranchId, // Use member's registration branch
      action: AuditAction.UPDATE,
      resource: 'Member',
      resourceId: memberId,
      meta: { changes: data },
    });

    return this.formatMemberData(updated);
  }

  /**
   * Delete member (soft delete by setting isActive to false)
   * Note: Files in MinIO are NOT deleted during soft delete to preserve audit trail.
   * Use hardDeleteMember() if you need to permanently delete member and their files.
   */
  async deleteMember(memberId: string, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Soft delete by setting isActive to false
    await prisma.member.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    // Audit log
    await logAudit({
      userId,
      branchId: member.registrationBranchId, // Use member's registration branch
      action: AuditAction.DELETE,
      resource: 'Member',
      resourceId: memberId,
      meta: { memberNo: member.memberNo },
    });

    return { message: 'Member berhasil dihapus' };
  }

  /**
   * Hard delete member and all associated files from MinIO
   * WARNING: This permanently deletes the member and all their files!
   * Use with caution - this action cannot be undone.
   */
  async hardDeleteMember(memberId: string, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        documents: true,
        packages: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Delete all member documents from MinIO
    console.log(`[Member] Hard deleting member ${member.memberNo} and their files...`);
    
    let filesDeleted = 0;

    // Delete avatar if exists
    if (member.user?.profile?.avatarUrl) {
      console.log(`[Member] Deleting avatar: ${member.user.profile.avatarUrl}`);
      await deleteFileByUrl(member.user.profile.avatarUrl);
      filesDeleted++;
    }
    
    for (const doc of member.documents) {
      if (doc.fileUrl) {
        console.log(`[Member] Deleting document: ${doc.fileUrl}`);
        await deleteFileByUrl(doc.fileUrl);
        filesDeleted++;
      }
    }

    // Delete payment proofs from packages
    for (const pkg of member.packages) {
      if (pkg.paymentProofUrl) {
        console.log(`[Member] Deleting package payment proof: ${pkg.paymentProofUrl}`);
        await deleteFileByUrl(pkg.paymentProofUrl);
        filesDeleted++;
      }
      if (pkg.refundProofUrl) {
        console.log(`[Member] Deleting package refund proof: ${pkg.refundProofUrl}`);
        await deleteFileByUrl(pkg.refundProofUrl);
        filesDeleted++;
      }
    }

    // Note: We don't delete the database records here as that would require
    // handling all foreign key constraints. This method focuses on file cleanup.
    // For full deletion, use a database cascade delete or manual cleanup.

    // Audit log
    await logAudit({
      userId,
      branchId: member.registrationBranchId,
      action: AuditAction.DELETE,
      resource: 'Member',
      resourceId: memberId,
      meta: { 
        memberNo: member.memberNo,
        action: 'HARD_DELETE',
        filesDeleted,
      },
    });

    return { 
      message: 'Member dan file terkait berhasil dihapus permanen',
      filesDeleted,
    };
  }

  /**
   * Format member data
   */
  private formatMemberData(member: any) {
    return {
      id: member.id,
      memberNo: member.memberNo,
      fullName: member.user?.profile?.fullName,
      dateOfBirth: member.dateOfBirth?.toISOString(),
      jenisKelamin: member.jenisKelamin,
      phone: member.user?.profile?.phone,
      email: member.user?.email,
      address: member.address,
      emergencyContact: member.emergencyContact,
      voucherCount: member.voucherCount,
      isActive: member.isActive,
      registrationBranch: member.registrationBranch ? {
        id: member.registrationBranch.id,
        name: member.registrationBranch.name,
        branchCode: member.registrationBranch.branchCode,
      } : null,
      branchAccesses: member.branchAccesses?.map((access: any) => ({
        branchId: access.branchId,
        branchName: access.branch.name,
        branchCode: access.branch.branchCode,
        grantedAt: access.grantedAt.toISOString(),
      })) || [],
      userId: member.userId,
      userEmail: member.user?.email,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  // ============================================================
  // CREDENTIAL MANAGEMENT (Super Admin Only)
  // ============================================================

  /**
   * Get member credentials (email, user info)
   */
  async getMemberCredentials(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
          },
        },
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    return {
      id: member.id,
      memberNo: member.memberNo,
      userId: member.userId,
      email: member.user.email,
      fullName: member.user.profile?.fullName || '',
      phone: member.user.profile?.phone || '',
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
      lastLoginAt: member.user.lastLoginAt?.toISOString() || null,
      registrationBranch: member.registrationBranch,
    };
  }

  /**
   * Update member email
   */
  async updateMemberEmail(memberId: string, newEmail: string, adminUserId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if email is already used by another user
    const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existingUser && existingUser.id !== member.userId) {
      throw { status: 409, code: 'EMAIL_DUPLICATE', message: 'Email sudah digunakan oleh user lain' };
    }

    // Update email
    const updatedUser = await prisma.user.update({
      where: { id: member.userId },
      data: { email: newEmail },
      select: {
        id: true,
        email: true,
      },
    });

    // Audit log
    await logAudit({
      userId: adminUserId,
      branchId: member.registrationBranchId,
      action: AuditAction.UPDATE,
      resource: 'MemberCredentials',
      resourceId: memberId,
      meta: {
        action: 'update_email',
        oldEmail: member.user.email,
        newEmail: newEmail,
        memberNo: member.memberNo,
      },
    });

    return {
      success: true,
      message: 'Email berhasil diubah',
      email: updatedUser.email,
    };
  }

  /**
   * Reset member password
   */
  async resetMemberPassword(memberId: string, newPassword: string, adminUserId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, HASH_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: member.userId },
      data: { password: hashedPassword },
    });

    // Audit log
    await logAudit({
      userId: adminUserId,
      branchId: member.registrationBranchId,
      action: AuditAction.UPDATE,
      resource: 'MemberCredentials',
      resourceId: memberId,
      meta: {
        action: 'reset_password',
        memberNo: member.memberNo,
        memberName: member.user.profile?.fullName,
      },
    });

    return {
      success: true,
      message: 'Password berhasil di-reset',
    };
  }
}
