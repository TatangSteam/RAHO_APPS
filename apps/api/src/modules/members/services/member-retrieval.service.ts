// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { Role } from '@prisma/client';

export interface MemberFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Service for retrieving member data
 */
export class MemberRetrievalService {
  /**
   * Get members with filtering and pagination
   */
  async getMembers(branchId: string | null, role: Role, filters: MemberFilters) {
    const { search, status, page = 1, limit = 20 } = filters;

    // Build where clause
    const where: any = {};

    // Branch filtering based on role
    if (role === Role.SUPER_ADMIN) {
      // Super admin can see all members
      if (branchId) {
        where.OR = [
          { registrationBranchId: branchId },
          { branchAccesses: { some: { branchId } } },
        ];
      }
    } else if (role === Role.ADMIN_CABANG || role === Role.ADMIN_LAYANAN) {
      // Branch admin can only see members from their branch
      if (!branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Branch ID diperlukan' };
      }
      where.OR = [
        { registrationBranchId: branchId },
        { branchAccesses: { some: { branchId } } },
      ];
    }

    // Search filter
    if (search) {
      where.OR = [
        ...(where.OR || []),
        { memberNo: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
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
          select: {
            id: true,
            email: true,
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
      OR: [
        { registrationBranchId: targetBranchId },
        { branchAccesses: { some: { branchId: targetBranchId } } },
      ],
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { memberNo: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (status) {
      where.status = status;
    }

    const total = await prisma.member.count({ where });

    const members = await prisma.member.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
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
   */
  async lookupMember(memberNo: string, branchId: string | null, role: Role) {
    const member = await prisma.member.findUnique({
      where: { memberNo },
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

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    // Check access based on role
    if (role !== Role.SUPER_ADMIN) {
      if (!branchId) {
        throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Branch ID diperlukan' };
      }

      const hasAccess =
        member.registrationBranchId === branchId ||
        member.branchAccesses.some(access => access.branchId === branchId);

      if (!hasAccess) {
        throw {
          status: 403,
          code: 'MEMBER_ACCESS_DENIED',
          message: 'Anda tidak memiliki akses ke member ini',
        };
      }
    }

    return this.formatMemberData(member);
  }

  /**
   * Get member by ID
   */
  async getMemberById(memberId: string) {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
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

    if (!member) {
      throw { status: 404, code: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan' };
    }

    return this.formatMemberData(member);
  }

  /**
   * Format member data for response
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
