// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, DocumentType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { uploadFile } from '../../../config/minio';
import { processFile } from '../../../utils/imageProcessor';

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
      religion?: string;
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
          agama: data.religion || null,
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
        title: 'Selamat Datang di Raho ERP',
        body: `Halo ${data.fullName}, akun Anda telah berhasil dibuat. Member No: ${memberNo}`,
        status: 'UNREAD',
      },
    });

    // Upload files to MinIO if provided
    console.log('📤 [Create Member] Starting file uploads...');
    console.log('  - PSP file:', files.psp ? `${files.psp.originalname} (${files.psp.size} bytes)` : 'not provided');
    console.log('  - Photo file:', files.photo ? `${files.photo.originalname} (${files.photo.size} bytes)` : 'not provided');

    if (files.psp) {
      try {
        console.log('📄 [Create Member] Processing and uploading PSP document...');
        
        // Process/compress the image
        const processed = await processFile(files.psp.buffer, files.psp.mimetype, 'document');
        const fileExt = processed.mimeType === 'image/jpeg' ? 'jpg' : 
                        processed.mimeType === 'application/pdf' ? 'pdf' :
                        files.psp.mimetype.split('/')[1];
        
        const pspKey = `uploads/members/${result.member.id}/documents/psp-${Date.now()}.${fileExt}`;
        console.log('  - Key:', pspKey);
        console.log('  - Original size:', (files.psp.size / 1024).toFixed(1), 'KB');
        console.log('  - Processed size:', (processed.buffer.length / 1024).toFixed(1), 'KB');
        
        const pspResult = await uploadFile(processed.buffer, pspKey, processed.mimeType);
        console.log('  ✅ PSP uploaded to MinIO');
        console.log('  - URL:', pspResult.url);

        const pspDoc = await prisma.memberDocument.create({
          data: {
            memberId: result.member.id,
            documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
            fileUrl: pspResult.url,
            fileName: files.psp.originalname,
            fileSize: processed.buffer.length,
            mimeType: processed.mimeType,
            uploadedBy: userId,
          },
        });
        console.log('  ✅ PSP document saved to database');
        console.log('  - Document ID:', pspDoc.id);
      } catch (error) {
        console.error('❌ [Create Member] Failed to upload PSP document:', error);
        // Don't throw - allow member creation to succeed even if file upload fails
      }
    }

    if (files.photo) {
      try {
        console.log('📸 [Create Member] Processing and uploading profile photo...');
        
        // Process/compress the image
        const processed = await processFile(files.photo.buffer, files.photo.mimetype, 'profilePhoto');
        const fileExt = processed.mimeType === 'image/jpeg' ? 'jpg' : 
                        processed.mimeType === 'image/webp' ? 'webp' :
                        files.photo.mimetype.split('/')[1];
        
        const photoKey = `uploads/members/${result.member.id}/documents/profile-${Date.now()}.${fileExt}`;
        console.log('  - Key:', photoKey);
        console.log('  - Original size:', (files.photo.size / 1024).toFixed(1), 'KB');
        console.log('  - Processed size:', (processed.buffer.length / 1024).toFixed(1), 'KB');
        
        const photoResult = await uploadFile(processed.buffer, photoKey, processed.mimeType);
        console.log('  ✅ Photo uploaded to MinIO');
        console.log('  - URL:', photoResult.url);

        const photoDoc = await prisma.memberDocument.create({
          data: {
            memberId: result.member.id,
            documentType: DocumentType.FOTO_PROFIL,
            fileUrl: photoResult.url,
            fileName: files.photo.originalname,
            fileSize: processed.buffer.length,
            mimeType: processed.mimeType,
            uploadedBy: userId,
          },
        });
        console.log('  ✅ Photo document saved to database');
        console.log('  - Document ID:', photoDoc.id);
      } catch (error) {
        console.error('❌ [Create Member] Failed to upload profile photo:', error);
        // Don't throw - allow member creation to succeed even if file upload fails
      }
    }

    console.log('✅ [Create Member] File uploads completed');

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
