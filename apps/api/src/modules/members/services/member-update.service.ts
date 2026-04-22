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
      dateOfBirth?: string;
      gender?: string;
      phoneNumber?: string;
      email?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      emergencyContactRelation?: string;
      photoUrl?: string;
      status?: string;
    },
    userId: string
  ) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if phone number is being changed and already exists
    if (data.phoneNumber && data.phoneNumber !== member.phoneNumber) {
      const existingPhone = await prisma.member.findUnique({
        where: { phoneNumber: data.phoneNumber },
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
    if (data.email && data.email !== member.email) {
      const existingEmail = await prisma.member.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw {
          status: 409,
          code: 'EMAIL_EXISTS',
          message: 'Email sudah terdaftar',
        };
      }
    }

    // Update member
    const updated = await prisma.member.update({
      where: { id: memberId },
      data: {
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        phoneNumber: data.phoneNumber,
        email: data.email,
        address: data.address,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRelation: data.emergencyContactRelation,
        photoUrl: data.photoUrl,
        status: data.status,
      },
      include: {
        user: true,
        registrationBranch: true,
        branchAccesses: {
          include: {
            branch: true,
          },
        },
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Member',
      resourceId: memberId,
      meta: { changes: data },
    });

    return this.formatMemberData(updated);
  }

  /**
   * Delete member (soft delete by setting status to INACTIVE)
   */
  async deleteMember(memberId: string, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Soft delete by setting status to INACTIVE
    await prisma.member.update({
      where: { id: memberId },
      data: { status: 'INACTIVE' },
    });

    // Audit log
    await logAudit({
      userId,
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
      fullName: member.fullName,
      dateOfBirth: member.dateOfBirth?.toISOString(),
      gender: member.gender,
      phoneNumber: member.phoneNumber,
      email: member.email,
      address: member.address,
      city: member.city,
      province: member.province,
      postalCode: member.postalCode,
      emergencyContactName: member.emergencyContactName,
      emergencyContactPhone: member.emergencyContactPhone,
      emergencyContactRelation: member.emergencyContactRelation,
      photoUrl: member.photoUrl,
      status: member.status,
      voucherCount: member.voucherCount,
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
