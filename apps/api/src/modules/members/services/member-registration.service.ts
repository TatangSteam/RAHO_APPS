// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Service for member registration
 */
export class MemberRegistrationService {
  /**
   * Create new member
   */
  async createMember(
    data: {
      fullName: string;
      nik?: string;
      birthPlace?: string;
      birthDate?: string;
      gender?: string;
      phone: string;
      email?: string;
      address?: string;
      occupation?: string;
      maritalStatus?: string;
      emergencyContact?: string;
      emergencyContactPhone?: string;
      infoSource?: string;
      postalCode?: string;
      memberEmail: string;
      memberPassword: string;
      referralCode?: string;
      isConsentToPhoto?: boolean;
    },
    files: {
      psp?: Express.Multer.File;
      photo?: Express.Multer.File;
    },
    branchId: string,
    userId: string
  ) {
    // Check if phone number already exists
    const existingMember = await prisma.member.findUnique({
      where: { phoneNumber: data.phone },
    });

    if (existingMember) {
      throw {
        status: 409,
        code: 'PHONE_EXISTS',
        message: 'Nomor telepon sudah terdaftar',
      };
    }

    // Check if email already exists (if provided)
    if (data.email) {
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

    // Get branch for member number generation
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // Generate member number
    const memberNo = await this.generateMemberNumber(branch.branchCode);

    // Use provided password (already validated by schema)
    const hashedPassword = await bcrypt.hash(data.memberPassword, 10);

    // Create user and member in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user account
      const user = await tx.user.create({
        data: {
          email: data.memberEmail,
          password: hashedPassword,
          role: 'MEMBER',
          profile: {
            create: {
              fullName: data.fullName,
              phoneNumber: data.phone,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // Create member
      const member = await tx.member.create({
        data: {
          memberNo,
          userId: user.id,
          fullName: data.fullName,
          dateOfBirth: data.birthDate ? new Date(data.birthDate) : null,
          gender: data.gender || null,
          phoneNumber: data.phone,
          email: data.email || null,
          address: data.address || null,
          city: null, // Not in schema
          province: null, // Not in schema
          postalCode: data.postalCode || null,
          emergencyContactName: data.emergencyContact || null,
          emergencyContactPhone: data.emergencyContactPhone || null,
          emergencyContactRelation: null, // Not in schema
          photoUrl: files.photo ? `/uploads/members/${files.photo.filename}` : null,
          registrationBranchId: branchId,
          status: 'ACTIVE',
          voucherCount: 0,
        },
        include: {
          user: true,
          registrationBranch: true,
        },
      });

      return { user, member };
    });

    // Send welcome notification
    await prisma.notification.create({
      data: {
        userId: result.user.id,
        type: 'INFO',
        title: 'Selamat Datang di RAHO Klinik',
        body: `Halo ${data.fullName}, akun Anda telah berhasil dibuat. Member No: ${memberNo}`,
        status: 'UNREAD',
      },
    });

    // Audit log
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Member',
      resourceId: result.member.id,
      meta: { memberNo, branchId },
    });

    return {
      member: this.formatMemberData(result.member),
      credentials: {
        email: result.user.email,
        memberNo,
      },
    };
  }

  /**
   * Generate member number
   */
  private async generateMemberNumber(branchCode: string): Promise<string> {
    const prefix = `MBR-${branchCode}`;
    
    // Get last member number for this branch
    const lastMember = await prisma.member.findFirst({
      where: {
        memberNo: {
          startsWith: prefix,
        },
      },
      orderBy: {
        memberNo: 'desc',
      },
    });

    let sequence = 1;
    if (lastMember) {
      const lastSequence = parseInt(lastMember.memberNo.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(4, '0')}`;
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
      userId: member.userId,
      userEmail: member.user?.email,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }
}
