import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { errors } from '../../../middleware/errorHandler';

// ═══════════════════════════════════════════════════════════════
// STAFF PERFORMANCE SERVICE
// Provides performance metrics and session history for staff
// Access: ADMIN_CABANG and above
// ═══════════════════════════════════════════════════════════════

interface StaffPerformanceQuery {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface StaffSessionHistoryQuery {
  position?: 'doctor' | 'nurse' | 'adminLayanan' | 'all';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Get staff performance summary for a branch or all branches
 * Returns list of staff with their therapy counts by position
 * 
 * SUPER_ADMIN can pass branchId='all' to see all branches combined
 * ADMIN_MANAGER can only see branches they manage via ManagerBranch
 */
export async function getStaffPerformanceSummaryService(
  query: StaffPerformanceQuery,
  callerRole: Role,
  callerBranchId: string | null,
  callerUserId?: string,
) {
  const { branchId, startDate, endDate, page = 1, limit = 50 } = query;
  const skip = (page - 1) * limit;

  // Determine which branch to query
  let targetBranchId: string | undefined = branchId;
  let isAllBranches = false;
  let allowedBranchIds: string[] | undefined;

  if (callerRole === Role.ADMIN_CABANG) {
    // ADMIN_CABANG can only see their own branch
    targetBranchId = callerBranchId || undefined;
  } else if (callerRole === Role.ADMIN_MANAGER && callerUserId) {
    // ADMIN_MANAGER can only see branches they manage
    const managerBranches = await prisma.managerBranch.findMany({
      where: { userId: callerUserId },
      select: { branchId: true },
    });
    allowedBranchIds = managerBranches.map(mb => mb.branchId);
    
    // If branchId is provided, verify it's in allowed branches
    if (branchId && !allowedBranchIds.includes(branchId)) {
      throw errors.forbidden('Anda tidak memiliki akses ke cabang ini');
    }
    
    // If no branchId provided, require selection
    if (!branchId) {
      throw errors.badRequest('BRANCH_REQUIRED', 'Silakan pilih cabang terlebih dahulu');
    }
    
    targetBranchId = branchId;
  } else if (callerRole === Role.SUPER_ADMIN && branchId === 'all') {
    // SUPER_ADMIN can see all branches
    isAllBranches = true;
    targetBranchId = undefined;
  }

  // For non-Super Admin, branch is required
  if (!isAllBranches && !targetBranchId) {
    throw errors.badRequest('BRANCH_REQUIRED', 'Branch ID diperlukan');
  }

  // Build date filter
  const dateFilter: Prisma.TreatmentSessionWhereInput = {};
  if (startDate || endDate) {
    const treatmentDateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      treatmentDateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      treatmentDateFilter.lte = new Date(endDate);
    }
    dateFilter.treatmentDate = treatmentDateFilter;
  }

  // Build user where clause
  const userWhere: Prisma.UserWhereInput = {
    isActive: true,
    NOT: { role: { in: [Role.MEMBER, Role.ADMIN_MANAGER, Role.SUPER_ADMIN] } },
    ...(isAllBranches ? {} : { branchId: targetBranchId }),
  };

  // Get all staff (excluding MEMBER, ADMIN_MANAGER, SUPER_ADMIN)
  const staff = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      branchId: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
          avatarUrl: true,
        },
      },
      branch: isAllBranches ? {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      } : undefined,
    },
    skip,
    take: limit,
    orderBy: { profile: { fullName: 'asc' } },
  });

  const staffIds = staff.map((s) => s.id);

  // Build session where clause for counting
  const sessionBranchFilter = isAllBranches ? {} : { branchId: targetBranchId };

  // Count sessions by position for each staff
  const [doctorCounts, nurseCounts, adminCounts] = await Promise.all([
    // Sessions as Doctor
    prisma.treatmentSession.groupBy({
      by: ['doctorId'],
      where: {
        doctorId: { in: staffIds },
        ...sessionBranchFilter,
        isCompleted: true,
        ...dateFilter,
      },
      _count: true,
    }),
    // Sessions as Nurse
    prisma.treatmentSession.groupBy({
      by: ['nurseId'],
      where: {
        nurseId: { in: staffIds },
        ...sessionBranchFilter,
        isCompleted: true,
        ...dateFilter,
      },
      _count: true,
    }),
    // Sessions as Admin Layanan
    prisma.treatmentSession.groupBy({
      by: ['adminLayananId'],
      where: {
        adminLayananId: { in: staffIds },
        ...sessionBranchFilter,
        isCompleted: true,
        ...dateFilter,
      },
      _count: true,
    }),
  ]);

  // Create maps for quick lookup
  const doctorMap = new Map(doctorCounts.map((d) => [d.doctorId, d._count]));
  const nurseMap = new Map(nurseCounts.map((n) => [n.nurseId, n._count]));
  const adminMap = new Map(adminCounts.map((a) => [a.adminLayananId, a._count]));

  // Build result with performance data
  const staffWithPerformance = staff.map((s) => {
    const asDoctor = doctorMap.get(s.id) || 0;
    const asNurse = nurseMap.get(s.id) || 0;
    const asAdminLayanan = adminMap.get(s.id) || 0;
    const total = asDoctor + asNurse + asAdminLayanan;

    return {
      id: s.id,
      email: s.email,
      role: s.role,
      staffCode: s.staffCode,
      fullName: s.profile?.fullName || '',
      phone: s.profile?.phone || '',
      avatarUrl: s.profile?.avatarUrl || null,
      // Include branch info when showing all branches
      ...(isAllBranches && (s as any).branch ? { branch: (s as any).branch } : {}),
      performance: {
        asDoctor,
        asNurse,
        asAdminLayanan,
        total,
      },
    };
  });

  // Sort by total performance descending
  staffWithPerformance.sort((a, b) => b.performance.total - a.performance.total);

  // Get total count for pagination
  const totalStaff = await prisma.user.count({
    where: userWhere,
  });

  // Get branch info (null if all branches)
  let branch = null;
  if (!isAllBranches && targetBranchId) {
    branch = await prisma.branch.findUnique({
      where: { id: targetBranchId },
      select: { id: true, branchCode: true, name: true },
    });
  }

  return {
    branch: isAllBranches ? { id: 'all', branchCode: 'ALL', name: 'Semua Cabang' } : branch,
    staff: staffWithPerformance,
    total: totalStaff,
    page,
    limit,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    isAllBranches,
  };
}

/**
 * Get detailed session history for a specific staff member
 * Shows all sessions they participated in, grouped by position
 */
export async function getStaffSessionHistoryService(
  staffId: string,
  query: StaffSessionHistoryQuery,
  callerRole: Role,
  callerBranchId: string | null,
) {
  const { position = 'all', startDate, endDate, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  // Get staff info
  const staff = await prisma.user.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      email: true,
      role: true,
      staffCode: true,
      branchId: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
          avatarUrl: true,
        },
      },
      branch: {
        select: {
          id: true,
          branchCode: true,
          name: true,
        },
      },
    },
  });

  if (!staff) {
    throw errors.notFound('Staff tidak ditemukan');
  }

  // Check access - ADMIN_CABANG can only see staff in their branch
  if (callerRole === Role.ADMIN_CABANG && staff.branchId !== callerBranchId) {
    throw errors.forbidden('Anda tidak memiliki akses ke staff ini');
  }

  // Build date filter
  const dateFilter: Prisma.TreatmentSessionWhereInput = {};
  if (startDate || endDate) {
    const treatmentDateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      treatmentDateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      treatmentDateFilter.lte = new Date(endDate);
    }
    dateFilter.treatmentDate = treatmentDateFilter;
  }

  // Build position filter
  const positionFilter: Prisma.TreatmentSessionWhereInput = {};
  if (position === 'doctor') {
    positionFilter.doctorId = staffId;
  } else if (position === 'nurse') {
    positionFilter.nurseId = staffId;
  } else if (position === 'adminLayanan') {
    positionFilter.adminLayananId = staffId;
  } else {
    // All positions
    positionFilter.OR = [
      { doctorId: staffId },
      { nurseId: staffId },
      { adminLayananId: staffId },
    ];
  }

  // Get sessions
  const [sessions, totalSessions] = await Promise.all([
    prisma.treatmentSession.findMany({
      where: {
        ...positionFilter,
        ...dateFilter,
        isCompleted: true,
      },
      select: {
        id: true,
        sessionCode: true,
        infusKe: true,
        pelaksanaan: true,
        treatmentDate: true,
        isCompleted: true,
        doctorId: true,
        nurseId: true,
        adminLayananId: true,
        branch: {
          select: {
            id: true,
            branchCode: true,
            name: true,
          },
        },
        encounter: {
          select: {
            member: {
              select: {
                memberNo: true,
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
            memberPackage: {
              select: {
                packageType: true,
                boosterType: true,
              },
            },
          },
        },
      },
      orderBy: { treatmentDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.treatmentSession.count({
      where: {
        ...positionFilter,
        ...dateFilter,
        isCompleted: true,
      },
    }),
  ]);

  // Add position info to each session
  const sessionsWithPosition = sessions.map((session) => {
    const positions: string[] = [];
    if (session.doctorId === staffId) positions.push('doctor');
    if (session.nurseId === staffId) positions.push('nurse');
    if (session.adminLayananId === staffId) positions.push('adminLayanan');

    return {
      id: session.id,
      sessionCode: session.sessionCode,
      infusKe: session.infusKe,
      pelaksanaan: session.pelaksanaan,
      treatmentDate: session.treatmentDate,
      isCompleted: session.isCompleted,
      branch: session.branch,
      member: {
        memberNo: session.encounter.member.memberNo,
        fullName: session.encounter.member.user.profile?.fullName || '',
      },
      package: {
        packageType: session.encounter.memberPackage.packageType,
        boosterType: session.encounter.memberPackage.boosterType,
      },
      positions, // Array of positions this staff held in this session
    };
  });

  // Get counts by position
  const [doctorCount, nurseCount, adminCount] = await Promise.all([
    prisma.treatmentSession.count({
      where: { doctorId: staffId, isCompleted: true, ...dateFilter },
    }),
    prisma.treatmentSession.count({
      where: { nurseId: staffId, isCompleted: true, ...dateFilter },
    }),
    prisma.treatmentSession.count({
      where: { adminLayananId: staffId, isCompleted: true, ...dateFilter },
    }),
  ]);

  return {
    staff: {
      id: staff.id,
      email: staff.email,
      role: staff.role,
      staffCode: staff.staffCode,
      fullName: staff.profile?.fullName || '',
      phone: staff.profile?.phone || '',
      avatarUrl: staff.profile?.avatarUrl || null,
      branch: staff.branch,
    },
    summary: {
      asDoctor: doctorCount,
      asNurse: nurseCount,
      asAdminLayanan: adminCount,
      total: doctorCount + nurseCount + adminCount,
    },
    sessions: sessionsWithPosition,
    total: totalSessions,
    page,
    limit,
    dateRange: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
  };
}
