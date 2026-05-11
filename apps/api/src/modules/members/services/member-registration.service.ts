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
      referralCodeId?: string;
      isConsentToPhoto?: boolean;
      // Incentive fields
      firstIncentiveType?: string;
      firstIncentiveValue?: number;
      nextIncentiveType?: string;
      nextIncentiveValue?: number;
    },
    files: {
      psp?: Express.Multer.File;
      photo?: Express.Multer.File;
    },
    branchId: string,
    userId: string
  ) {
    // Check if phone number already exists
    const existingPhone = await prisma.userProfile.findFirst({
      where: { phone: data.phone },
    });

    if (existingPhone) {
      throw {
        status: 409,
        code: 'PHONE_EXISTS',
        message: 'Nomor telepon sudah terdaftar',
      };
    }

    // Check if email already exists (if provided)
    if (data.memberEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: data.memberEmail },
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

    // Validate referral code if provided and set incentive values
    let referralCodeId: string | null = null;
    let finalFirstIncentiveType = data.firstIncentiveType;
    let finalFirstIncentiveValue = data.firstIncentiveValue;
    let finalNextIncentiveType = data.nextIncentiveType;
    let finalNextIncentiveValue = data.nextIncentiveValue;
    
    // Handle both referralCodeId (UUID) and referralCode (string code like "REF-001")
    // IMPORTANT: If referralCodeId is provided, it takes precedence
    if (data.referralCodeId) {
      // Validate by ID
      const referralCode = await prisma.referralCode.findFirst({
        where: { 
          id: data.referralCodeId, 
          isActive: true 
        },
      });

      if (!referralCode) {
        throw {
          status: 400,
          code: 'INVALID_REFERRAL_CODE',
          message: 'Kode referral tidak valid atau tidak aktif',
        };
      }

      referralCodeId = referralCode.id;
      
      // Set default incentive values if not provided by user
      if (!finalFirstIncentiveType) {
        finalFirstIncentiveType = 'PERCENTAGE';
        finalFirstIncentiveValue = 10.0; // 10% for first package
      }
      if (!finalNextIncentiveType) {
        finalNextIncentiveType = 'PERCENTAGE';
        finalNextIncentiveValue = 5.0; // 5% for subsequent packages
      }
    } else if (data.referralCode) {
      // Validate by code string (e.g., "REF-001")
      // This handles cases where user manually types a referral code
      const referralCode = await prisma.referralCode.findFirst({
        where: { 
          code: data.referralCode, 
          isActive: true 
        },
      });

      if (!referralCode) {
        throw {
          status: 400,
          code: 'INVALID_REFERRAL_CODE',
          message: `Kode referral "${data.referralCode}" tidak valid atau tidak aktif`,
        };
      }

      referralCodeId = referralCode.id;
      
      // Set default incentive values if not provided by user
      if (!finalFirstIncentiveType) {
        finalFirstIncentiveType = 'PERCENTAGE';
        finalFirstIncentiveValue = 10.0; // 10% for first package
      }
      if (!finalNextIncentiveType) {
        finalNextIncentiveType = 'PERCENTAGE';
        finalNextIncentiveValue = 5.0; // 5% for subsequent packages
      }
    }
    // If neither referralCodeId nor referralCode is provided, that's OK - member can be created without referral

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
              phone: data.phone,
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
          userId: user.id,
          memberNo,
          registrationBranchId: branchId,
          referralCodeId: referralCodeId,
          voucherCount: 0,
          isConsentToPhoto: data.isConsentToPhoto ?? true,
          nik: data.nik || null,
          tempatLahir: data.birthPlace || null,
          dateOfBirth: data.birthDate ? new Date(data.birthDate) : null,
          jenisKelamin: data.gender as any || null,
          address: data.address || null,
          pekerjaan: data.occupation || null,
          statusNikah: data.maritalStatus || null,
          emergencyContact: data.emergencyContact 
            ? `${data.emergencyContact}${data.emergencyContactPhone ? ' - ' + data.emergencyContactPhone : ''}`
            : null,
          sumberInfoRaho: data.infoSource || null,
          postalCode: data.postalCode || null,
          // Incentive fields (use user-provided values or defaults if referral code is provided)
          firstIncentiveType: finalFirstIncentiveType as any || null,
          firstIncentiveValue: finalFirstIncentiveValue || null,
          nextIncentiveType: finalNextIncentiveType as any || null,
          nextIncentiveValue: finalNextIncentiveValue || null,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          registrationBranch: true,
          referralCode: true,
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
      branchId,
      action: AuditAction.CREATE,
      resource: 'Member',
      resourceId: result.member.id,
      meta: { memberNo },
    });

    return {
      memberId: result.member.id,
      memberNo: memberNo,
      message: 'Member berhasil didaftarkan',
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
      fullName: member.user?.profile?.fullName,
      dateOfBirth: member.dateOfBirth?.toISOString(),
      gender: member.jenisKelamin,
      phone: member.user?.profile?.phone,
      email: member.user?.email,
      address: member.address,
      postalCode: member.postalCode,
      emergencyContact: member.emergencyContact,
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
