// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';

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
}
