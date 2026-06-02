// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { Role } from '@prisma/client';

export interface MemberFilters {
  search?: string;
  status?: string;
  branchCode?: string;
  page?: number;
  limit?: number;
  userId?: string; // Add userId for ADMIN_MANAGER
}

/**
 * Service for retrieving member data
 */
export class MemberRetrievalService {
  /**
   * Get members with filtering and pagination
   */
  async getMembers(branchId: string | null, role: Role, filters: MemberFilters) {
    const { search, status, branchCode, userId, page = 1, limit = 20 } = filters;

    // Build where clause - start with isActive filter
    const where: any = {
      isActive: true  // Only show active members
    };

    // Branch filtering based on role
    if (role === Role.SUPER_ADMIN) {
      // Super admin can see all members or filter by specific branch
      if (branchCode) {
        // Filter by specific branch code
        where.OR = [
          { registrationBranch: { branchCode } },
          { branchAccesses: { some: { branch: { branchCode } } } },
        ];
      }
      // If no branchCode, show all members (no additional filter)
    } else if (role === Role.ADMIN_MANAGER) {
      // Admin Manager can see members from branches they manage
      if (!userId) {
        // If ADMIN_MANAGER doesn't have userId, something is wrong - deny access
        console.error('❌ ADMIN_MANAGER without userId - denying access');
        throw { status: 403, code: 'USER_ID_REQUIRED', message: 'User ID diperlukan untuk ADMIN_MANAGER' };
      }
      
      // Get all branches this manager manages (via ManagerBranch table)
      const managerBranches = await prisma.managerBranch.findMany({
        where: { userId },
        select: { branchId: true }
      });

      const managedBranchIds = managerBranches.map(mb => mb.branchId);
      
      // Include primary branch (if exists) + managed branches (remove duplicates)
      const allBranchIds = branchId 
        ? Array.from(new Set([branchId, ...managedBranchIds]))
        : managedBranchIds;

      console.log(`📊 ADMIN_MANAGER ${userId} manages ${allBranchIds.length} branches:`, allBranchIds);

      // If manager has no branches assigned, return empty result
      if (allBranchIds.length === 0) {
        console.warn('⚠️ ADMIN_MANAGER has no branches assigned - returning empty result');
        where.id = 'no-branches-assigned'; // Force empty result
      } else if (branchCode) {
        // If branchCode filter is provided, first get the branch by code
        const targetBranch = await prisma.branch.findUnique({
          where: { branchCode },
          select: { id: true }
        });

        if (targetBranch && allBranchIds.includes(targetBranch.id)) {
          // Only show members from this specific branch (if manager has access)
          console.log(`🔍 Filtering by branchCode: ${branchCode} (id: ${targetBranch.id})`);
          where.OR = [
            { registrationBranchId: targetBranch.id },
            { branchAccesses: { some: { branchId: targetBranch.id } } },
          ];
        } else {
          // Manager doesn't have access to this branch - return empty
          console.warn(`⚠️ ADMIN_MANAGER doesn't have access to branch ${branchCode}`);
          where.id = 'no-access'; // Force empty result
        }
      } else {
        // Show all members from all branches they manage
        console.log(`📋 Showing members from all ${allBranchIds.length} managed branches`);
        where.OR = [
          { registrationBranchId: { in: allBranchIds } },
          { branchAccesses: { some: { branchId: { in: allBranchIds } } } },
        ];
      }
    } else if (role === Role.DOCTOR || role === Role.NURSE) {
      // DOCTOR and NURSE use StaffBranch table for multi-branch support
      if (!userId) {
        console.error(`❌ ${role} without userId - denying access`);
        throw { status: 403, code: 'USER_ID_REQUIRED', message: 'User ID diperlukan' };
      }

      // Get all branches this staff has access to (via StaffBranch table)
      const staffBranches = await prisma.staffBranch.findMany({
        where: { userId },
        select: { branchId: true }
      });

      const staffBranchIds = staffBranches.map(sb => sb.branchId);
      
      // Include primary branch (if exists) + staff branches (remove duplicates)
      const allBranchIds = branchId 
        ? Array.from(new Set([branchId, ...staffBranchIds]))
        : staffBranchIds;

      console.log(`🔒 ${role} ${userId} has access to ${allBranchIds.length} branches:`, allBranchIds);

      // If staff has no branches assigned, deny access
      if (allBranchIds.length === 0) {
        console.warn(`⚠️ ${role} has no branches assigned - denying access`);
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Akun Anda belum di-assign ke cabang. Hubungi SUPER_ADMIN untuk assign cabang.' };
      }

      // Filter members by accessible branches
      where.OR = [
        { registrationBranchId: { in: allBranchIds } },
        { branchAccesses: { some: { branchId: { in: allBranchIds } } } },
      ];
    } else if (role === Role.ADMIN_CABANG || role === Role.ADMIN_LAYANAN) {
      // Admin Cabang and Admin Layanan can only see members from their primary branch
      if (!branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Akun Anda belum di-assign ke cabang. Hubungi SUPER_ADMIN untuk assign cabang.' };
      }
      
      console.log(`🔒 ${role} filtering members by branchId: ${branchId}`);
      
      where.OR = [
        { registrationBranchId: branchId },
        { branchAccesses: { some: { branchId } } },
      ];
    } else {
      // Unknown role - deny access
      console.error(`❌ Unknown role ${role} - denying access`);
      throw { status: 403, code: 'ACCESS_DENIED', message: 'Anda tidak memiliki akses ke data member' };
    }

    // Search filter
    if (search) {
      const searchConditions = [
        { memberNo: { contains: search, mode: 'insensitive' } },
        { 
          user: { 
            profile: { 
              fullName: { contains: search, mode: 'insensitive' } 
            } 
          } 
        },
        { 
          user: { 
            profile: { 
              phone: { contains: search, mode: 'insensitive' } 
            } 
          } 
        },
        { 
          user: { 
            email: { contains: search, mode: 'insensitive' } 
          } 
        },
      ];

      // Merge with existing OR conditions (branch access)
      if (where.OR && where.OR.length > 0) {
        // Combine branch conditions with search conditions using AND
        const branchConditions = where.OR;
        where.AND = [
          { OR: branchConditions },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await prisma.member.count({ where });

    // Get members with pagination
    const members = await prisma.member.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        branchAccesses: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
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
            documentType: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      members: members.map(m => this.formatMemberData(m)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get members by specific branch
   */
  async getMembersByBranch(targetBranchId: string, filters: MemberFilters) {
    const { search, status, page = 1, limit = 20 } = filters;

    const where: any = {
      AND: [
        // Only show active members
        { isActive: true },
        // Branch access conditions
        {
          OR: [
            { registrationBranchId: targetBranchId },
            { branchAccesses: { some: { branchId: targetBranchId } } },
          ],
        }
      ]
    };

    if (search) {
      const searchConditions = [
        { memberNo: { contains: search, mode: 'insensitive' } },
        { 
          user: { 
            profile: { 
              fullName: { contains: search, mode: 'insensitive' } 
            } 
          } 
        },
        { 
          user: { 
            profile: { 
              phone: { contains: search, mode: 'insensitive' } 
            } 
          } 
        },
        { 
          user: { 
            email: { contains: search, mode: 'insensitive' } 
          } 
        },
      ];

      // Add search conditions to existing AND clause
      where.AND.push({ OR: searchConditions });
    }

    if (status) {
      where.AND.push({ status: status });
    }

    const total = await prisma.member.count({ where });

    const members = await prisma.member.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        registrationBranch: {
          select: {
            id: true,
            name: true,
            branchCode: true,
          },
        },
        branchAccesses: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
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
            documentType: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      members: members.map(m => this.formatMemberData(m)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lookup member by member number
   * This is used for cross-branch member search to grant access
   * Returns limited info for members without access (for grant access flow)
   */
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

    // Check if user already has access to this member
    const hasAccess = role === Role.SUPER_ADMIN || (
      branchId && (
        member.registrationBranchId === branchId ||
        member.branchAccesses.some(access => access.branchId === branchId)
      )
    );

    // For lookup (cross-branch search), we return limited info
    // This allows staff to find members from other branches and grant access
    return {
      memberNo: member.memberNo,
      fullName: member.user.profile?.fullName || '-',
      phone: member.user.profile?.phoneNumber || '-',
      isActive: member.user.isActive,
      registrationBranch: member.registrationBranch?.name || '-',
      isRegistrationBranch: branchId === member.registrationBranchId,
      sudahAdaAkses: hasAccess,
      // Only include memberId if user has access (for navigation)
      ...(hasAccess && { memberId: member.id }),
    };
  }

  /**
   * Get member by ID
   */
  async getMemberById(memberId: string) {
    console.log('🔍 [Member Retrieval] getMemberById called for:', memberId);
    console.time('getMemberById');
    
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
        referralCode: true,
        documents: true,
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
      },
    });

    console.timeEnd('getMemberById');

    if (!member) {
      console.log('❌ [Member Retrieval] Member not found:', memberId);
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    console.log('✅ [Member Retrieval] Member found:', member.memberNo, member.user.profile?.fullName);
    const result = this.formatMemberDetailData(member);
    console.log('✅ [Member Retrieval] Formatted data ready');
    return result;
  }

  /**
   * Get consent documents for a member
   */
  async getConsentDocuments(memberId: string) {
    console.log('🔍 [Member Retrieval] getConsentDocuments called for:', memberId);
    
    // First verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, memberNo: true },
    });

    if (!member) {
      console.log('❌ [Member Retrieval] Member not found:', memberId);
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    console.log('✅ [Member Retrieval] Member found:', member.memberNo);

    // Get consent documents
    const documents = await prisma.memberDocument.findMany({
      where: {
        memberId,
        documentType: 'PERSETUJUAN_SETELAH_PENJELASAN',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        uploadedBy: true,
        createdAt: true,
      },
    });

    console.log(`📄 [Member Retrieval] Found ${documents.length} consent documents for member ${member.memberNo}`);
    
    if (documents.length > 0) {
      console.log('📋 [Member Retrieval] Documents:', documents.map(d => ({ fileName: d.fileName, fileUrl: d.fileUrl })));
    }

    return {
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedBy: doc.uploadedBy,
        createdAt: doc.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Get referral incentive records for a member
   */
  async getReferralIncentives(memberId: string) {
    console.log('🔍 [Member Retrieval] getReferralIncentives called for:', memberId);
    
    // First verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, memberNo: true, referralCodeId: true },
    });

    if (!member) {
      console.log('❌ [Member Retrieval] Member not found:', memberId);
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    if (!member.referralCodeId) {
      console.log('ℹ️ [Member Retrieval] Member has no referral code');
      return {
        totalIncentive: 0,
        records: [],
      };
    }

    console.log('✅ [Member Retrieval] Member found:', member.memberNo);

    // Get incentive records
    const records = await prisma.referralIncentiveRecord.findMany({
      where: {
        memberId,
      },
      include: {
        memberPackage: {
          select: {
            packageCode: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`💰 [Member Retrieval] Found ${records.length} incentive records for member ${member.memberNo}`);

    // Calculate total incentive
    const totalIncentive = records.reduce((sum, record) => sum + Number(record.incentiveAmount), 0);

    return {
      totalIncentive,
      records: records.map(record => ({
        id: record.id,
        packageCode: record.memberPackage.packageCode,
        packageType: record.packageType,
        packageName: record.packageName,
        packageValue: Number(record.packageValue),
        isFirstPackage: record.isFirstPackage,
        incentiveType: record.incentiveType,
        incentiveValue: Number(record.incentiveValue),
        incentiveAmount: Number(record.incentiveAmount),
        notes: record.notes,
        purchaseDate: record.memberPackage.createdAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Format member detail data for response
   */
  private formatMemberDetailData(member: any) {
    // Get profile photo - check both memberDocuments and user.profile.avatarUrl
    // Priority: memberDocuments FOTO_PROFIL > user.profile.avatarUrl
    const profilePhoto = member.documents?.find((doc: any) => doc.documentType === 'FOTO_PROFIL');
    const avatarUrl = profilePhoto?.fileUrl || member.user?.profile?.avatarUrl || null;
    
    return {
      memberId: member.id,
      memberNo: member.memberNo,
      user: {
        email: member.user.email,
        isActive: member.isActive,
      },
      profile: {
        fullName: member.user.profile?.fullName || '',
        phone: member.user.profile?.phone || '',
        avatarUrl,
      },
      registrationBranch: {
        id: member.registrationBranch.id,
        name: member.registrationBranch.name,
        branchCode: member.registrationBranch.branchCode,
      },
      branchAccess: member.branchAccesses?.map((access: any) => ({
        branchId: access.branchId,
        branchName: access.branch.name,
        grantedAt: access.createdAt.toISOString(),
      })) || [],
      documents: member.documents?.map((doc: any) => ({
        id: doc.id,
        documentType: doc.documentType,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt.toISOString(),
      })) || [],
      referralCodeId: member.referralCodeId,
      referralCode: member.referralCode ? {
        code: member.referralCode.code,
        referrerName: member.referralCode.referrerName,
        referrerType: member.referralCode.referrerType,
      } : null,
      // Incentive settings (per member)
      firstIncentiveType: member.firstIncentiveType,
      firstIncentiveValue: member.firstIncentiveValue ? Number(member.firstIncentiveValue) : null,
      nextIncentiveType: member.nextIncentiveType,
      nextIncentiveValue: member.nextIncentiveValue ? Number(member.nextIncentiveValue) : null,
      // Member fields
      nik: member.nik,
      tempatLahir: member.tempatLahir,
      dateOfBirth: member.dateOfBirth?.toISOString(),
      jenisKelamin: member.jenisKelamin,
      agama: member.agama,
      address: member.address,
      pekerjaan: member.pekerjaan,
      statusNikah: member.statusNikah,
      emergencyContact: member.emergencyContact,
      sumberInfoRaho: member.sumberInfoRaho,
      postalCode: member.postalCode,
      voucherCount: member.voucherCount,
      isConsentToPhoto: member.isConsentToPhoto,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
    };
  }

  /**
   * Format member data for response
   */
  private formatMemberData(member: any) {
    // Calculate basic voucher count from packages
    const basicVoucherCount = member.memberPackages?.reduce(
      (sum: number, pkg: any) => sum + (pkg.totalSessions - pkg.usedSessions),
      0
    ) || 0;

    // Get profile photo - check both memberDocuments and user.profile.avatarUrl
    // Priority: memberDocuments FOTO_PROFIL > user.profile.avatarUrl
    const profilePhoto = member.documents?.find((doc: any) => doc.documentType === 'FOTO_PROFIL');
    const photoUrl = profilePhoto?.fileUrl || member.user?.profile?.avatarUrl || null;

    // Check if member has cross-branch access
    const isLintas = member.branchAccesses && member.branchAccesses.length > 0;

    return {
      memberId: member.id,
      memberNo: member.memberNo,
      fullName: member.user?.profile?.fullName || '',
      phone: member.user?.profile?.phone || '',
      email: member.user?.email || '',
      voucherCount: member.voucherCount || 0,
      basicPackageCount: basicVoucherCount,
      isActive: member.isActive,
      isLintas,
      registrationBranch: member.registrationBranch?.name || 'N/A',
      photoUrl,
      createdAt: member.createdAt?.toISOString(),
    };
  }
}
