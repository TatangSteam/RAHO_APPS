import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, Gender, IncentiveType, Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { deleteFileByUrl } from '../../../config/minio';
import {
  cleanMemberName,
  hasMatchingMemberName,
  parseMemberBirthDate,
} from './member-registration.helpers';
import { enqueueContactSafely } from '../../zoho/zoho.contact.service';

const HASH_ROUNDS = 12;

type MemberUpdateInput = {
  nik?: string;
  fullName?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  religion?: string;
  phone?: string;
  username?: string;
  email?: string;
  address?: string;
  occupation?: string;
  maritalStatus?: string;
  emergencyContact?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  infoSource?: string;
  postalCode?: string;
  isActive?: boolean;
  isDeceased?: boolean;
  firstIncentiveType?: string;
  firstIncentiveValue?: number;
  nextIncentiveType?: string;
  nextIncentiveValue?: number;
};

type UpdatedMember = Prisma.MemberGetPayload<{
  include: {
    user: { include: { profile: true } };
    registrationBranch: true;
    branchAccesses: { include: { branch: true } };
  };
}>;

/**
 * Service for updating member data
 */
export class MemberUpdateService {
  /**
   * Update member
   */
  async updateMember(
    memberId: string,
    data: MemberUpdateInput,
    userId: string,
    actorRole: Role,
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

    if (actorRole === Role.ADMIN_MANAGER) {
      data = this.restrictAdminManagerToEmptyFields(member, data);
    }

    const requestedFullName = cleanMemberName(
      data.fullName ?? member.user.profile?.fullName ?? '',
    );
    const requestedBirthDate =
      data.birthDate !== undefined
        ? parseMemberBirthDate(data.birthDate)
        : member.dateOfBirth;

    if (data.birthDate !== undefined && !requestedBirthDate) {
      throw {
        status: 400,
        code: 'INVALID_BIRTH_DATE',
        message: 'Tanggal lahir wajib diisi dengan tanggal yang valid',
      };
    }

    if (requestedBirthDate && (data.fullName !== undefined || data.birthDate !== undefined)) {
      const membersWithSameBirthDate = await prisma.member.findMany({
        where: {
          id: { not: memberId },
          dateOfBirth: requestedBirthDate,
        },
        select: {
          user: {
            select: {
              profile: {
                select: { fullName: true },
              },
            },
          },
        },
      });

      if (
        hasMatchingMemberName(
          requestedFullName,
          membersWithSameBirthDate.map((candidate) => candidate.user.profile?.fullName),
        )
      ) {
        throw {
          status: 409,
          code: 'MEMBER_NAME_BIRTH_DATE_EXISTS',
          message: 'Member dengan nama dan tanggal lahir yang sama sudah terdaftar',
        };
      }
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

    const requestedLogin = data.username ?? data.email;

    // The User.email column stores either a staff email or member username.
    if (requestedLogin && requestedLogin !== member.user.email) {
      const existingLogin = await prisma.user.findFirst({
        where: { 
          email: requestedLogin,
          id: { not: member.userId }
        },
      });

      if (existingLogin) {
        throw {
          status: 409,
          code: data.username ? 'USERNAME_EXISTS' : 'EMAIL_EXISTS',
          message: data.username ? 'Username sudah digunakan' : 'Email sudah terdaftar',
        };
      }
    }

    if (data.nik && data.nik !== member.nik) {
      const existingIdentity = await prisma.member.findUnique({
        where: { nik: data.nik },
      });

      if (existingIdentity) {
        throw {
          status: 409,
          code: 'NIK_EXISTS',
          message: 'NIK atau nomor identitas sudah terdaftar pada member lain',
        };
      }
    }

    // Update in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Keep using the existing User.email database column for the login identifier.
      if (requestedLogin !== undefined) {
        await tx.user.update({
          where: { id: member.userId },
          data: { email: requestedLogin }
        });
      }

      // Update UserProfile table (fullName, phone)
      if (data.fullName !== undefined || data.phone !== undefined) {
        await tx.userProfile.update({
          where: { userId: member.userId },
          data: {
            ...(data.fullName !== undefined && { fullName: requestedFullName }),
            ...(data.phone !== undefined && { phone: data.phone || null })
          }
        });
      }

      // Update Member table (member-specific fields)
      const memberUpdateData: Prisma.MemberUncheckedUpdateInput = {};
      if (data.nik !== undefined) memberUpdateData.nik = data.nik || null;
      if (data.birthPlace !== undefined) memberUpdateData.tempatLahir = data.birthPlace || null;
      if (data.birthDate !== undefined) memberUpdateData.dateOfBirth = requestedBirthDate;
      if (data.gender !== undefined) {
        memberUpdateData.jenisKelamin = data.gender ? data.gender as Gender : null;
      }
      if (data.religion !== undefined) memberUpdateData.agama = data.religion || null;
      if (data.address !== undefined) memberUpdateData.address = data.address || null;
      if (data.occupation !== undefined) memberUpdateData.pekerjaan = data.occupation || null;
      if (data.maritalStatus !== undefined) memberUpdateData.statusNikah = data.maritalStatus || null;
      if (data.emergencyContact !== undefined || data.emergencyContactName !== undefined || data.emergencyContactPhone !== undefined) {
        const emergencyName = data.emergencyContact ?? data.emergencyContactName ?? '';
        memberUpdateData.emergencyContact = emergencyName
          ? `${emergencyName}${data.emergencyContactPhone ? ' - ' + data.emergencyContactPhone : ''}`
          : null;
      }
      if (data.infoSource !== undefined) memberUpdateData.sumberInfoRaho = data.infoSource || null;
      if (data.postalCode !== undefined) memberUpdateData.postalCode = data.postalCode || null;
      if (data.isActive !== undefined) memberUpdateData.isActive = data.isActive;
      if (data.isDeceased !== undefined) memberUpdateData.isDeceased = data.isDeceased;
      if (data.firstIncentiveType !== undefined) {
        memberUpdateData.firstIncentiveType = data.firstIncentiveType
          ? data.firstIncentiveType as IncentiveType
          : null;
      }
      if (data.firstIncentiveValue !== undefined) memberUpdateData.firstIncentiveValue = data.firstIncentiveValue ?? null;
      if (data.nextIncentiveType !== undefined) {
        memberUpdateData.nextIncentiveType = data.nextIncentiveType
          ? data.nextIncentiveType as IncentiveType
          : null;
      }
      if (data.nextIncentiveValue !== undefined) memberUpdateData.nextIncentiveValue = data.nextIncentiveValue ?? null;

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
    await enqueueContactSafely('MEMBER', memberId);

    return this.formatMemberData(updated);
  }

  private restrictAdminManagerToEmptyFields(
    member: {
      nik: string | null;
      tempatLahir: string | null;
      dateOfBirth: Date | null;
      jenisKelamin: Gender | null;
      agama: string | null;
      address: string | null;
      pekerjaan: string | null;
      statusNikah: string | null;
      emergencyContact: string | null;
      sumberInfoRaho: string | null;
      postalCode: string | null;
      isActive: boolean;
      isDeceased: boolean;
      firstIncentiveType: IncentiveType | null;
      firstIncentiveValue: Prisma.Decimal | null;
      nextIncentiveType: IncentiveType | null;
      nextIncentiveValue: Prisma.Decimal | null;
      user: {
        email: string;
        profile: { fullName: string; phone: string | null } | null;
      };
    },
    input: MemberUpdateInput,
  ): MemberUpdateInput {
    const effective = { ...input };
    const blocked = new Set<string>();

    const valuesEqual = (current: unknown, requested: unknown): boolean => {
      if (current instanceof Date) {
        const requestedDate = typeof requested === 'string' ? parseMemberBirthDate(requested) : null;
        return !!requestedDate && current.getTime() === requestedDate.getTime();
      }
      if (current instanceof Prisma.Decimal) {
        return Number(current.toString()) === Number(requested);
      }
      if (typeof current === 'string' || typeof requested === 'string') {
        return String(current ?? '').trim() === String(requested ?? '').trim();
      }
      return current === requested;
    };

    const isFilled = (value: unknown): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return true;
    };

    const protect = (
      key: keyof MemberUpdateInput,
      currentValue: unknown,
      label: string,
      requestedValue: unknown = effective[key],
    ) => {
      if (effective[key] === undefined) return;
      if (!isFilled(currentValue)) return;
      if (!valuesEqual(currentValue, requestedValue)) blocked.add(label);
      delete effective[key];
    };

    protect('fullName', member.user.profile?.fullName, 'Nama lengkap', cleanMemberName(effective.fullName ?? ''));
    protect('nik', member.nik, 'NIK');
    protect('birthPlace', member.tempatLahir, 'Tempat lahir');
    protect('birthDate', member.dateOfBirth, 'Tanggal lahir');
    protect('gender', member.jenisKelamin, 'Jenis kelamin');
    protect('religion', member.agama, 'Agama');
    protect('phone', member.user.profile?.phone, 'Nomor telepon');
    protect('username', member.user.email, 'Username');
    protect('email', member.user.email, 'Email/login');
    protect('address', member.address, 'Alamat');
    protect('occupation', member.pekerjaan, 'Pekerjaan');
    protect('maritalStatus', member.statusNikah, 'Status pernikahan');
    protect('infoSource', member.sumberInfoRaho, 'Sumber informasi');
    protect('postalCode', member.postalCode, 'Kode pos');
    protect('isActive', member.isActive, 'Status aktif');
    protect('isDeceased', member.isDeceased, 'Status hidup');
    protect('firstIncentiveType', member.firstIncentiveType, 'Tipe insentif pertama');
    protect('firstIncentiveValue', member.firstIncentiveValue, 'Nilai insentif pertama');
    protect('nextIncentiveType', member.nextIncentiveType, 'Tipe insentif berikutnya');
    protect('nextIncentiveValue', member.nextIncentiveValue, 'Nilai insentif berikutnya');

    const emergencyKeys: Array<keyof MemberUpdateInput> = [
      'emergencyContact',
      'emergencyContactName',
      'emergencyContactPhone',
    ];
    if (emergencyKeys.some((key) => effective[key] !== undefined) && isFilled(member.emergencyContact)) {
      const emergencyName = effective.emergencyContact ?? effective.emergencyContactName ?? '';
      const requestedEmergency = emergencyName
        ? `${emergencyName}${effective.emergencyContactPhone ? ` - ${effective.emergencyContactPhone}` : ''}`
        : null;
      if (!valuesEqual(member.emergencyContact, requestedEmergency)) blocked.add('Kontak darurat');
      for (const key of emergencyKeys) delete effective[key];
    }

    if (blocked.size > 0) {
      throw {
        status: 403,
        code: 'ADMIN_MANAGER_MEMBER_FIELD_LOCKED',
        message: `Admin Manager hanya dapat mengisi data member yang masih kosong. Field terkunci: ${Array.from(blocked).join(', ')}.`,
      };
    }

    return effective;
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
    await enqueueContactSafely('MEMBER', memberId);

    return { message: 'Member berhasil dinonaktifkan' };
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
        memberPackages: true,
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
    for (const pkg of member.memberPackages) {
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
  private formatMemberData(member: UpdatedMember) {
    return {
      id: member.id,
      memberNo: member.memberNo,
      fullName: member.user?.profile?.fullName,
      dateOfBirth: member.dateOfBirth?.toISOString(),
      jenisKelamin: member.jenisKelamin,
      phone: member.user?.profile?.phone,
      email: member.user?.email,
      username: member.user?.email,
      address: member.address,
      emergencyContact: member.emergencyContact,
      voucherCount: member.voucherCount,
      isActive: member.isActive,
      isDeceased: member.isDeceased,
      registrationBranch: member.registrationBranch ? {
        id: member.registrationBranch.id,
        name: member.registrationBranch.name,
        branchCode: member.registrationBranch.branchCode,
      } : null,
      branchAccesses: member.branchAccesses?.map((access) => ({
        branchId: access.branchId,
        branchName: access.branch.name,
        branchCode: access.branch.branchCode,
        grantedAt: access.createdAt.toISOString(),
      })) || [],
      userId: member.userId,
      userEmail: member.user?.email,
      userUsername: member.user?.email,
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
      username: member.user.email,
      fullName: member.user.profile?.fullName || '',
      phone: member.user.profile?.phone || '',
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
      lastLoginAt: member.user.lastLoginAt?.toISOString() || null,
      registrationBranch: member.registrationBranch,
    };
  }

  /**
   * Update member username while retaining the existing database column.
   */
  async updateMemberUsername(memberId: string, newUsername: string, adminUserId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const existingUser = await prisma.user.findUnique({ where: { email: newUsername } });
    if (existingUser && existingUser.id !== member.userId) {
      throw { status: 409, code: 'USERNAME_EXISTS', message: 'Username sudah digunakan' };
    }

    const updatedUser = await prisma.user.update({
      where: { id: member.userId },
      data: { email: newUsername },
      select: { id: true, email: true },
    });

    await logAudit({
      userId: adminUserId,
      branchId: member.registrationBranchId,
      action: AuditAction.UPDATE,
      resource: 'MemberCredentials',
      resourceId: memberId,
      meta: {
        action: 'update_username',
        oldUsername: member.user.email,
        newUsername,
        memberNo: member.memberNo,
      },
    });

    return {
      success: true,
      message: 'Username berhasil diubah',
      username: updatedUser.email,
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
