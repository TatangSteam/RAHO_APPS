import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateMemberNo } from '../../../utils/codeGenerator';
import { AuditAction, DocumentType, Gender, IncentiveType, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { MemberDocumentsService } from './member-documents.service';
import {
  cleanMemberName,
  hasMatchingMemberName,
  parseMemberBirthDate,
  resolveMemberIdentityNumber,
  type MemberIdentityType,
} from './member-registration.helpers';
import { enqueueContactSafely } from '../../zoho/zoho.contact.service';

type RegisteredMember = Prisma.MemberGetPayload<{
  include: {
    user: { include: { profile: true } };
    registrationBranch: true;
    referralCode: true;
  };
}>;

/**
 * Service for member registration
 */
export class MemberRegistrationService {
  private readonly documentsService = new MemberDocumentsService();

  /**
   * Create new member
   */
  async createMember(
    data: {
      fullName: string;
      identityType?: MemberIdentityType;
      nik?: string;
      birthPlace?: string;
      birthDate: string;
      gender?: string;
      religion?: string;
      phone?: string;
      email?: string;
      address?: string;
      occupation?: string;
      maritalStatus?: string;
      emergencyContact?: string;
      emergencyContactPhone?: string;
      infoSource?: string;
      postalCode?: string;
      isDeceased?: boolean;
      memberUsername: string;
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
    const fullName = cleanMemberName(data.fullName);
    const birthDate = data.birthDate ? parseMemberBirthDate(data.birthDate) : null;

    if (!birthDate) {
      throw {
        status: 400,
        code: 'INVALID_BIRTH_DATE',
        message: 'Tanggal lahir wajib diisi dengan tanggal yang valid',
      };
    }

    // The existing User.email column stores member usernames without a DB migration.
    const existingUsername = await prisma.user.findUnique({
      where: { email: data.memberUsername },
    });

    if (existingUsername) {
      throw {
        status: 409,
        code: 'USERNAME_EXISTS',
        message: 'Username sudah digunakan',
      };
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
    const identityNumber = resolveMemberIdentityNumber(data.identityType, data.nik, memberNo);

    if (identityNumber) {
      const existingIdentity = await prisma.member.findUnique({
        where: { nik: identityNumber },
      });

      if (existingIdentity) {
        throw {
          status: 409,
          code: data.identityType === 'NIK' ? 'NIK_EXISTS' : 'IDENTITY_EXISTS',
          message:
            data.identityType === 'NIK'
              ? 'NIK sudah terdaftar pada member lain'
              : 'Nomor identitas sudah terdaftar pada member lain',
        };
      }
    }

    const membersWithSameBirthDate = await prisma.member.findMany({
      where: { dateOfBirth: birthDate },
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
        fullName,
        membersWithSameBirthDate.map((member) => member.user.profile?.fullName),
      )
    ) {
      throw {
        status: 409,
        code: 'MEMBER_NAME_BIRTH_DATE_EXISTS',
        message: 'Member dengan nama dan tanggal lahir yang sama sudah terdaftar',
      };
    }

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
          email: data.memberUsername,
          password: hashedPassword,
          role: 'MEMBER',
          profile: {
            create: {
              fullName,
              phone: data.phone || null,
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
          nik: identityNumber,
          tempatLahir: data.birthPlace || null,
          dateOfBirth: birthDate,
          jenisKelamin: data.gender ? data.gender as Gender : null,
          agama: data.religion || null,
          address: data.address || null,
          pekerjaan: data.occupation || null,
          statusNikah: data.maritalStatus || null,
          emergencyContact: data.emergencyContact 
            ? `${data.emergencyContact}${data.emergencyContactPhone ? ' - ' + data.emergencyContactPhone : ''}`
            : null,
          sumberInfoRaho: data.infoSource || null,
          postalCode: data.postalCode || null,
          isDeceased: data.isDeceased ?? false,
          // Incentive fields (use user-provided values or defaults if referral code is provided)
          firstIncentiveType: finalFirstIncentiveType
            ? finalFirstIncentiveType as IncentiveType
            : null,
          firstIncentiveValue: finalFirstIncentiveValue || null,
          nextIncentiveType: finalNextIncentiveType
            ? finalNextIncentiveType as IncentiveType
            : null,
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
        title: 'Selamat Datang di Raho ERP',
        body: `Halo ${fullName}, akun Anda telah berhasil dibuat. Member No: ${memberNo}`,
        status: 'UNREAD',
      },
    });

    const uploadWarnings: string[] = [];
    const uploadedDocuments = {
      informedConsent: false,
      profilePhoto: false,
    };

    if (files.psp) {
      try {
        await this.documentsService.uploadDocument(
          result.member.id,
          DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
          files.psp,
          userId,
        );
        uploadedDocuments.informedConsent = true;
      } catch (error) {
        console.error('❌ [Create Member] Failed to upload PSP document:', error);
        uploadWarnings.push(
          'Member berhasil dibuat, tetapi informed consent gagal diunggah. Silakan unggah ulang dari detail member.',
        );
      }
    }

    if (files.photo) {
      try {
        await this.documentsService.uploadDocument(
          result.member.id,
          DocumentType.FOTO_PROFIL,
          files.photo,
          userId,
        );
        uploadedDocuments.profilePhoto = true;
      } catch (error) {
        console.error('❌ [Create Member] Failed to upload profile photo:', error);
        uploadWarnings.push(
          'Member berhasil dibuat, tetapi foto profil gagal diunggah. Silakan unggah ulang dari detail member.',
        );
      }
    }

    // Audit log
    await logAudit({
      userId,
      branchId,
      action: AuditAction.CREATE,
      resource: 'Member',
      resourceId: result.member.id,
      meta: { memberNo },
    });
    await enqueueContactSafely('MEMBER', result.member.id);

    return {
      memberId: result.member.id,
      memberNo: memberNo,
      message: uploadWarnings.length
        ? 'Member berhasil didaftarkan dengan peringatan upload dokumen.'
        : 'Member berhasil didaftarkan',
      uploadedDocuments,
      uploadWarnings,
    };
  }

  /**
   * Generate member number
   */
  private async generateMemberNumber(branchCode: string): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `MBR-${branchCode}-${yymm}-`;
    
    // Get last member number for this branch in the current month.
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

    let candidate = generateMemberNo(branchCode, sequence);
    while (await prisma.member.findUnique({ where: { memberNo: candidate } })) {
      sequence += 1;
      candidate = generateMemberNo(branchCode, sequence);
    }

    return candidate;
  }

  /**
   * Format member data
   */
  private formatMemberData(member: RegisteredMember) {
    return {
      id: member.id,
      memberNo: member.memberNo,
      fullName: member.user?.profile?.fullName,
      dateOfBirth: member.dateOfBirth?.toISOString(),
      gender: member.jenisKelamin,
      phone: member.user?.profile?.phone,
      email: member.user?.email,
      username: member.user?.email,
      address: member.address,
      postalCode: member.postalCode,
      emergencyContact: member.emergencyContact,
      voucherCount: member.voucherCount,
      isDeceased: member.isDeceased,
      registrationBranch: member.registrationBranch ? {
        id: member.registrationBranch.id,
        name: member.registrationBranch.name,
        branchCode: member.registrationBranch.branchCode,
      } : null,
      userId: member.userId,
      userEmail: member.user?.email,
      userUsername: member.user?.email,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }
}
