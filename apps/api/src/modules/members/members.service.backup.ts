import { prisma } from '../../lib/prisma';
import { uploadFile } from '../../config/minio';
import { generateMemberNo, generateStaffCode, generateEncounterCode, generateDiagnosisCode } from '../../utils/codeGenerator';
import { logAudit } from '../../utils/auditLog';
import bcrypt from 'bcryptjs';
import type { CreateMemberInput, UpdateMemberInput } from './members.schema';
import { Role, DocumentType, NotificationType, NotificationStatus, AuditAction } from '@prisma/client';

const HASH_ROUNDS = 12;

interface MemberFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class MembersService {
  async getMembers(branchId: string | null, role: Role, filters: MemberFilters) {
    const { search, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Filter by branch access
    if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN_MANAGER && branchId) {
      where.OR = [
        { registrationBranchId: branchId },
        { branchAccesses: { some: { branchId } } },
      ];
    }

    // Search filter
    if (search) {
      where.AND = [
        {
          OR: [
            { memberNo: { contains: search, mode: 'insensitive' } },
            { user: { profile: { fullName: { contains: search, mode: 'insensitive' } } } },
            { user: { profile: { phone: { contains: search } } } },
          ],
        },
      ];
    }

    // Status filter
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          registrationBranch: true,
          branchAccesses: {
            include: {
              branch: true,
            },
          },
          memberPackages: {
            where: {
              packageType: 'BASIC',
              status: 'ACTIVE',
              branchId: branchId || undefined, // Only count packages from current branch
            },
            select: {
              totalSessions: true,
              usedSessions: true,
            },
          },
          documents: {
            where: {
              documentType: 'FOTO_PROFIL',
            },
            select: {
              fileUrl: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.member.count({ where }),
    ]);

    // Map to response format
    const mappedMembers = members.map((member) => {
      const isLintas =
        branchId && member.registrationBranchId !== branchId
          ? member.branchAccesses.some((access) => access.branchId === branchId)
          : false;

      // Calculate basic voucher count from included packages
      const basicVoucherCount = member.memberPackages.reduce(
        (sum: number, pkg: { totalSessions: number; usedSessions: number }) => 
          sum + (pkg.totalSessions - pkg.usedSessions),
        0
      );

      // Get profile photo from included documents
      const profilePhoto = member.documents[0];

      return {
        memberId: member.id,
        memberNo: member.memberNo,
        fullName: member.user.profile?.fullName || '',
        phone: member.user.profile?.phone || '',
        email: member.user.email,
        voucherCount: member.voucherCount,
        basicPackageCount: basicVoucherCount,
        isActive: member.isActive,
        isLintas,
        registrationBranch: member.registrationBranch.name,
        photoUrl: profilePhoto?.fileUrl,
        createdAt: member.createdAt,
      };
    });

    return {
      members: mappedMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // New method: Get members by specific branch (for Admin Manager viewing branch details)
  async getMembersByBranch(targetBranchId: string, filters: MemberFilters) {
    const { search, status, page = 1, limit = 100 } = filters;
    const skip = (page - 1) * limit;

    console.log('🔍 getMembersByBranch service called');
    console.log('  targetBranchId:', targetBranchId);
    console.log('  filters:', filters);

    // Build where clause - only members registered at this specific branch
    const where: any = {
      registrationBranchId: targetBranchId,
    };

    // Search filter
    if (search) {
      where.AND = [
        {
          OR: [
            { memberNo: { contains: search, mode: 'insensitive' } },
            { user: { profile: { fullName: { contains: search, mode: 'insensitive' } } } },
            { user: { profile: { phone: { contains: search } } } },
          ],
        },
      ];
    }

    // Status filter
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    console.log('  where clause:', JSON.stringify(where, null, 2));

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          registrationBranch: true,
          branchAccesses: {
            include: {
              branch: true,
            },
          },
          memberPackages: {
            where: {
              packageType: 'BASIC',
              status: 'ACTIVE',
            },
            select: {
              totalSessions: true,
              usedSessions: true,
            },
          },
          documents: {
            where: {
              documentType: 'FOTO_PROFIL',
            },
            select: {
              fileUrl: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.member.count({ where }),
    ]);

    console.log('  ✅ Found members:', members.length);
    console.log('  ✅ Total count:', total);

    // Map to response format
    const mappedMembers = members.map((member) => {
      // Check if member has access to other branches
      const isLintas = member.branchAccesses.length > 0;

      // Calculate basic voucher count from included packages
      const basicVoucherCount = member.memberPackages.reduce(
        (sum: number, pkg: { totalSessions: number; usedSessions: number }) => 
          sum + (pkg.totalSessions - pkg.usedSessions),
        0
      );

      // Get profile photo from included documents
      const profilePhoto = member.documents[0];

      return {
        memberId: member.id,
        memberNo: member.memberNo,
        fullName: member.user.profile?.fullName || '',
        phone: member.user.profile?.phone || '',
        email: member.user.email,
        voucherCount: member.voucherCount,
        basicPackageCount: basicVoucherCount,
        isActive: member.isActive,
        isLintas,
        registrationBranch: member.registrationBranch.name,
        photoUrl: profilePhoto?.fileUrl,
        createdAt: member.createdAt,
      };
    });

    return {
      members: mappedMembers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async lookupMember(memberNo: string, branchId: string | null, role: Role) {
    const member = await prisma.member.findUnique({
      where: { memberNo },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: true,
        branchAccesses: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const isRegistrationBranch = branchId === member.registrationBranchId;
    const sudahAdaAkses =
      isRegistrationBranch ||
      member.branchAccesses.some((access) => access.branchId === branchId) ||
      role === Role.SUPER_ADMIN ||
      role === Role.ADMIN_MANAGER;

    return {
      memberId: member.id,
      memberNo: member.memberNo,
      fullName: member.user.profile?.fullName || '',
      phone: member.user.profile?.phone || '',
      email: member.user.email,
      registrationBranch: member.registrationBranch.name,
      registrationBranchId: member.registrationBranchId,
      isRegistrationBranch,
      sudahAdaAkses,
      isActive: member.isActive,
    };
  }

  async grantAccess(memberNo: string, branchId: string, userId: string) {
    const member = await prisma.member.findUnique({
      where: { memberNo },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check if it's registration branch
    if (member.registrationBranchId === branchId) {
      throw {
        status: 400,
        code: 'GRANT_ACCESS_INVALID',
        message: 'Tidak bisa grant akses ke cabang registrasi sendiri',
      };
    }

    // Check if access already exists
    const existingAccess = await prisma.branchMemberAccess.findFirst({
      where: {
        branchId,
        memberId: member.id,
      },
    });

    if (existingAccess) {
      throw {
        status: 409,
        code: 'MEMBER_ACCESS_EXISTS',
        message: 'Akses member ke cabang ini sudah ada',
      };
    }

    const access = await prisma.branchMemberAccess.create({
      data: {
        branchId,
        memberId: member.id,
        grantedBy: userId,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'BranchMemberAccess',
      resourceId: access.id,
      meta: { memberNo, branchId },
    });

    return { message: 'Akses berhasil diberikan' };
  }

  async createMember(
    data: CreateMemberInput,
    files: { psp?: Express.Multer.File; photo?: Express.Multer.File },
    branchId: string,
    userId: string
  ) {
    // Check email duplicate
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.memberEmail },
    });

    if (existingEmail) {
      throw {
        status: 409,
        code: 'MEMBER_EMAIL_DUPLICATE',
        message: 'Email sudah terdaftar',
      };
    }

    // Check NIK duplicate if provided
    if (data.nik) {
      const existingNik = await prisma.member.findFirst({
        where: { nik: data.nik },
      });

      if (existingNik) {
        throw {
          status: 409,
          code: 'MEMBER_NIK_DUPLICATE',
          message: 'NIK sudah terdaftar',
        };
      }
    }

    // Validate referral code if provided
    if (data.referralCode) {
      const referral = await prisma.referralCode.findUnique({
        where: { code: data.referralCode, isActive: true },
      });

      if (!referral) {
        throw {
          status: 400,
          code: 'REFERRAL_INVALID',
          message: 'Kode referral tidak valid atau tidak aktif',
        };
      }
    }

    // Get branch for code generation
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan' };
    }

    // Get next sequence for member number
    const prefix = `MBR-${branch.branchCode}-`;
    const lastMember = await prisma.member.findFirst({
      where: { memberNo: { startsWith: prefix } },
      orderBy: { memberNo: 'desc' },
    });
    
    const sequence = lastMember 
      ? parseInt(lastMember.memberNo.split('-').pop() || '0') + 1 
      : 1;

    // Generate codes
    const memberNo = generateMemberNo(branch.branchCode, sequence);
    const staffCode = generateStaffCode(Role.MEMBER);
    const hashedPassword = await bcrypt.hash(data.memberPassword, HASH_ROUNDS);

    // Create user, profile, and member in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.memberEmail,
          password: hashedPassword,
          role: Role.MEMBER,
          staffCode,
          isActive: true,
        },
      });

      await tx.userProfile.create({
        data: {
          userId: user.id,
          fullName: data.fullName,
          phone: data.phone,
        },
      });

      const member = await tx.member.create({
        data: {
          userId: user.id,
          memberNo,
          registrationBranchId: branchId,
          referralCodeId: data.referralCode ? (await tx.referralCode.findUnique({ where: { code: data.referralCode } }))?.id : undefined,
          voucherCount: 0,
          isConsentToPhoto: data.isConsentToPhoto,
          nik: data.nik,
          tempatLahir: data.birthPlace,
          dateOfBirth: data.birthDate ? new Date(data.birthDate) : null,
          jenisKelamin: data.gender,
          address: data.address,
          pekerjaan: data.occupation,
          statusNikah: data.maritalStatus,
          emergencyContact: data.emergencyContact ? `${data.emergencyContact} - ${data.emergencyContactPhone || ''}` : null,
          sumberInfoRaho: data.infoSource,
          postalCode: data.postalCode,
          isActive: true,
        },
      });

      return { user, member };
    });

    // Upload files to MinIO if provided
    if (files.psp) {
      const pspKey = `uploads/members/${result.member.id}/documents/psp-${Date.now()}.${files.psp.mimetype.split('/')[1]}`;
      const pspResult = await uploadFile(files.psp.buffer, pspKey, files.psp.mimetype);

      await prisma.memberDocument.create({
        data: {
          memberId: result.member.id,
          documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
          fileUrl: pspResult.url, // Use permanent URL instead of presignedUrl
          fileName: files.psp.originalname,
          fileSize: files.psp.size,
          mimeType: files.psp.mimetype,
          uploadedBy: userId,
        },
      });
    }

    if (files.photo) {
      const photoKey = `uploads/members/${result.member.id}/documents/profile-${Date.now()}.${files.photo.mimetype.split('/')[1]}`;
      const photoResult = await uploadFile(files.photo.buffer, photoKey, files.photo.mimetype);

      await prisma.memberDocument.create({
        data: {
          memberId: result.member.id,
          documentType: DocumentType.FOTO_PROFIL,
          fileUrl: photoResult.url, // Use permanent URL instead of presignedUrl
          fileName: files.photo.originalname,
          fileSize: files.photo.size,
          mimeType: files.photo.mimetype,
          uploadedBy: userId,
        },
      });
    }

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Member',
      resourceId: result.member.id,
      meta: { memberNo },
    });

    return {
      memberId: result.member.id,
      memberNo: result.member.memberNo,
      message: 'Member berhasil didaftarkan',
    };
  }

  async getMemberById(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: true,
        branchAccesses: {
          include: {
            branch: true,
          },
        },
        documents: true,
        referralCode: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    return {
      memberId: member.id,
      memberNo: member.memberNo,
      user: {
        email: member.user.email,
        isActive: member.user.isActive,
      },
      profile: member.user.profile,
      registrationBranch: member.registrationBranch,
      branchAccesses: member.branchAccesses.map((access) => ({
        branchId: access.branchId,
        branchName: access.branch.name,
        grantedAt: access.createdAt,
      })),
      documents: member.documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt,
      })),
      referralCodeId: member.referralCodeId,
      referralCode: member.referralCode,
      nik: member.nik,
      tempatLahir: member.tempatLahir,
      dateOfBirth: member.dateOfBirth,
      jenisKelamin: member.jenisKelamin,
      address: member.address,
      pekerjaan: member.pekerjaan,
      statusNikah: member.statusNikah,
      emergencyContact: member.emergencyContact,
      sumberInfoRaho: member.sumberInfoRaho,
      postalCode: member.postalCode,
      voucherCount: member.voucherCount,
      isConsentToPhoto: member.isConsentToPhoto,
      isActive: member.isActive,
      createdAt: member.createdAt,
    };
  }

  async updateMember(memberId: string, data: UpdateMemberInput, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: { include: { profile: true } } },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    await prisma.$transaction(async (tx) => {
      if (data.isActive !== undefined) {
        await tx.user.update({
          where: { id: member.userId },
          data: { isActive: data.isActive },
        });

        await tx.member.update({
          where: { id: memberId },
          data: { isActive: data.isActive },
        });
      }

      if (member.user.profile) {
        await tx.userProfile.update({
          where: { userId: member.userId },
          data: {
            fullName: data.fullName,
            phone: data.phone,
          },
        });
      }

      await tx.member.update({
        where: { id: memberId },
        data: {
          nik: data.nik,
          tempatLahir: data.birthPlace,
          dateOfBirth: data.birthDate ? new Date(data.birthDate) : undefined,
          jenisKelamin: data.gender,
          address: data.address,
          pekerjaan: data.occupation,
          statusNikah: data.maritalStatus,
          emergencyContact: data.emergencyContact,
          sumberInfoRaho: data.infoSource,
          postalCode: data.postalCode,
        },
      });
    });

    await logAudit({
      userId,
      action: AuditAction.UPDATE,
      resource: 'Member',
      resourceId: memberId,
      meta: data as Record<string, unknown>,
    });

    return { message: 'Data member berhasil diperbarui' };
  }

  async deleteMember(memberId: string, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.member.delete({ where: { id: memberId } });
      await tx.user.delete({ where: { id: member.userId } });
    });

    await logAudit({
      userId,
      action: AuditAction.DELETE,
      resource: 'Member',
      resourceId: memberId,
      meta: {},
    });

    return { message: 'Member berhasil dihapus' };
  }

  async sendNotification(memberId: string, title: string, message: string, _userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    await prisma.notification.create({
      data: {
        userId: member.userId,
        type: NotificationType.INFO,
        title,
        body: message,
        status: NotificationStatus.UNREAD,
      },
    });

    return { message: 'Notifikasi berhasil dikirim' };
  }

  async getMemberDiagnoses(memberId: string) {
    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Get all diagnoses for this member (both standalone and encounter-linked)
    const diagnoses = await prisma.diagnosis.findMany({
      where: {
        memberId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return diagnoses;
  }

  async createMemberDiagnosis(memberId: string, data: any, userId: string) {
    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Verify doctor exists and is active
    const doctor = await prisma.user.findUnique({
      where: { id: data.doktorPemeriksa },
      include: {
        branch: true,
      },
    });

    if (!doctor || doctor.role !== Role.DOCTOR || !doctor.isActive) {
      throw { status: 403, code: 'INVALID_DOCTOR', message: 'Dokter tidak valid atau tidak aktif' };
    }

    // Try to find active package and encounter (optional)
    const activePackage = await prisma.memberPackage.findFirst({
      where: {
        memberId,
        status: 'ACTIVE',
        packageType: 'BASIC',
      },
      include: {
        branch: true,
      },
      orderBy: {
        activatedAt: 'desc',
      },
    });

    let encounterId: string | undefined = undefined;

    // If member has active package, try to link to encounter
    if (activePackage && doctor.branch) {
      // Check if encounter already exists for this package
      let encounter = await prisma.encounter.findFirst({
        where: {
          memberPackageId: activePackage.id,
          status: 'ONGOING',
        },
      });

      // If no encounter, create one
      if (!encounter) {
        const encounterCode = generateEncounterCode(activePackage.branch.branchCode);
        encounter = await prisma.encounter.create({
          data: {
            encounterCode,
            memberId,
            branchId: activePackage.branchId,
            memberPackageId: activePackage.id,
            adminLayananId: userId,
            doctorId: doctor.id,
            nurseId: doctor.id, // Temporary - should be actual nurse
            status: 'ONGOING',
          },
        });
      }

      // Check if diagnosis already exists for this encounter
      const existingDiagnosis = await prisma.diagnosis.findUnique({
        where: { encounterId: encounter.id },
      });

      if (existingDiagnosis) {
        throw { status: 409, code: 'DIAGNOSIS_EXISTS', message: 'Diagnosa sudah ada untuk encounter ini' };
      }

      encounterId = encounter.id;
    }

    // Generate diagnosis code
    const branchCode = member.registrationBranch.branchCode;
    const prefix = `DX-${branchCode}-`;
    const lastDiagnosis = await prisma.diagnosis.findFirst({
      where: { diagnosisCode: { startsWith: prefix } },
      orderBy: { diagnosisCode: 'desc' },
    });
    
    const sequence = lastDiagnosis 
      ? parseInt(lastDiagnosis.diagnosisCode.split('-').pop() || '0') + 1 
      : 1;
    
    const diagnosisCode = generateDiagnosisCode(branchCode, sequence);

    // Create diagnosis (with or without encounter)
    const diagnosis = await prisma.diagnosis.create({
      data: {
        diagnosisCode,
        memberId, // Direct link to member
        encounterId, // Optional - only if encounter exists
        doktorPemeriksa: data.doktorPemeriksa,
        diagnosa: data.diagnosa,
        kategoriDiagnosa: data.kategoriDiagnosa || null,
        icdPrimer: data.icdPrimer || null,
        icdSekunder: data.icdSekunder || null,
        icdTersier: data.icdTersier || null,
        keluhanRiwayatSekarang: data.keluhanRiwayatSekarang || null,
        riwayatPenyakitTerdahulu: data.riwayatPenyakitTerdahulu || null,
        riwayatSosialKebiasaan: data.riwayatSosialKebiasaan || null,
        riwayatPengobatan: data.riwayatPengobatan || null,
        pemeriksaanFisik: data.pemeriksaanFisik || null,
        pemeriksaanTambahan: data.pemeriksaanTambahan || null,
      },
    });

    // Log audit
    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'Diagnosis',
      resourceId: diagnosis.id,
      meta: { memberId, encounterId },
    });

    return diagnosis;
  }

  // ============================================================
  // THERAPY PLAN METHODS
  // ============================================================

  async getMemberTherapyPlans(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const therapyPlans = await prisma.therapyPlan.findMany({
      where: {
        memberId,
      },
      include: {
        session: {
          select: {
            id: true,
            sessionCode: true,
            treatmentDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return therapyPlans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      keterangan: plan.keterangan,
      ifa: plan.ifa ? Number(plan.ifa) : null,
      hho: plan.hho ? Number(plan.hho) : null,
      h2: plan.h2 ? Number(plan.h2) : null,
      no: plan.no ? Number(plan.no) : null,
      gaso: plan.gaso ? Number(plan.gaso) : null,
      o2: plan.o2 ? Number(plan.o2) : null,
      o3: plan.o3 ? Number(plan.o3) : null,
      edta: plan.edta ? Number(plan.edta) : null,
      mb: plan.mb ? Number(plan.mb) : null,
      h2s: plan.h2s ? Number(plan.h2s) : null,
      kcl: plan.kcl ? Number(plan.kcl) : null,
      jmlNb: plan.jmlNb ? Number(plan.jmlNb) : null,
      isUsed: !!plan.treatmentSessionId,
      usedInSession: plan.session,
      createdAt: plan.createdAt.toISOString(),
    }));
  }

  async createMemberTherapyPlan(memberId: string, data: any, userId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        registrationBranch: true,
      },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Generate therapy plan code
    const branchCode = member.registrationBranch.branchCode;
    const prefix = `TP-${branchCode}-`;
    const lastPlan = await prisma.therapyPlan.findFirst({
      where: { planCode: { startsWith: prefix } },
      orderBy: { planCode: 'desc' },
    });
    
    const sequence = lastPlan 
      ? parseInt(lastPlan.planCode.split('-').pop() || '0') + 1 
      : 1;
    
    const planCode = `TP-${branchCode}-${String(sequence).padStart(5, '0')}`;

    const therapyPlan = await prisma.therapyPlan.create({
      data: {
        planCode,
        memberId,
        keterangan: data.keterangan || null,
        ifa: data.ifa || null,
        hho: data.hho || null,
        h2: data.h2 || null,
        no: data.no || null,
        gaso: data.gaso || null,
        o2: data.o2 || null,
        o3: data.o3 || null,
        edta: data.edta || null,
        mb: data.mb || null,
        h2s: data.h2s || null,
        kcl: data.kcl || null,
        jmlNb: data.jmlNb || null,
      },
    });

    await logAudit({
      userId,
      action: AuditAction.CREATE,
      resource: 'TherapyPlan',
      resourceId: therapyPlan.id,
      meta: { memberId, planCode },
    });

    return {
      id: therapyPlan.id,
      planCode: therapyPlan.planCode,
      message: 'Therapy plan berhasil dibuat',
    };
  }

  // ============================================================
  // INFUSION METHODS
  // ============================================================

  async getMemberInfusions(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    const infusions = await prisma.infusionExecution.findMany({
      where: {
        session: {
          encounter: {
            memberId,
          },
        },
      },
      include: {
        session: {
          select: {
            id: true,
            sessionCode: true,
            treatmentDate: true,
            encounter: {
              select: {
                member: {
                  select: {
                    user: {
                      select: {
                        profile: {
                          select: {
                            fullName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return infusions.map((infusion) => ({
      id: infusion.id,
      treatmentSessionId: infusion.treatmentSessionId,
      sessionCode: infusion.session.sessionCode,
      memberName: infusion.session.encounter.member.user.profile?.fullName || '',
      treatmentDate: infusion.session.treatmentDate.toISOString(),
      ifa: infusion.ifa ? Number(infusion.ifa) : null,
      hho: infusion.hho ? Number(infusion.hho) : null,
      h2: infusion.h2 ? Number(infusion.h2) : null,
      no: infusion.no ? Number(infusion.no) : null,
      gaso: infusion.gaso ? Number(infusion.gaso) : null,
      o2: infusion.o2 ? Number(infusion.o2) : null,
      o3: infusion.o3 ? Number(infusion.o3) : null,
      edta: infusion.edta ? Number(infusion.edta) : null,
      mb: infusion.mb ? Number(infusion.mb) : null,
      h2s: infusion.h2s ? Number(infusion.h2s) : null,
      kcl: infusion.kcl ? Number(infusion.kcl) : null,
      jmlNb: infusion.jmlNb ? Number(infusion.jmlNb) : null,
      deviationNotes: infusion.deviationNotes,
      bottleType: infusion.bottleType,
      jenisCairan: infusion.jenisCairan,
      volumeCarrier: infusion.volumeCarrier ? Number(infusion.volumeCarrier) : null,
      jumlahJarum: infusion.jumlahJarum,
      tanggalProduksi: infusion.tanggalProduksi?.toISOString() || null,
      createdAt: infusion.createdAt.toISOString(),
      updatedAt: infusion.updatedAt.toISOString(),
    }));
  }
}
