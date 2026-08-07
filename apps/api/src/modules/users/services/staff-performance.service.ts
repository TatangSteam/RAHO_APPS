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
  branchId?: string;
  position?: 'doctor' | 'nurse' | 'adminLayanan' | 'all';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

const STAFF_PERFORMANCE_ROLES: Role[] = [
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

function parseDateBoundary(value: string, boundary: 'start' | 'end') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // The performance screen is operated in Indonesia; use an explicit Jakarta
    // offset so deployments running in UTC do not shift the selected session day.
    return new Date(`${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}+07:00`);
  }

  return new Date(value);
}

function buildDateFilter(startDate?: string, endDate?: string): Prisma.TreatmentSessionWhereInput {
  if (!startDate && !endDate) return {};

  const treatmentDateFilter: Prisma.DateTimeFilter = {};
  if (startDate) {
    treatmentDateFilter.gte = parseDateBoundary(startDate, 'start');
  }
  if (endDate) {
    treatmentDateFilter.lte = parseDateBoundary(endDate, 'end');
  }

  return { treatmentDate: treatmentDateFilter };
}

function buildBranchFilter(branchIds?: string[]): Prisma.TreatmentSessionWhereInput {
  if (!branchIds || branchIds.length === 0) return {};
  return branchIds.length === 1
    ? { branchId: branchIds[0] }
    : { branchId: { in: branchIds } };
}

function buildStaffBranchWhere(branchIds?: string[]): Prisma.UserWhereInput {
  if (!branchIds || branchIds.length === 0) return {};

  const branchFilter = branchIds.length === 1
    ? { branchId: branchIds[0] }
    : { branchId: { in: branchIds } };

  return {
    OR: [
      branchFilter,
      { staffBranches: { some: branchFilter } },
    ],
  };
}

function incrementCount(map: Map<string, number>, userId: string) {
  map.set(userId, (map.get(userId) || 0) + 1);
}

async function getPositionCountMaps(
  staffIds: string[],
  sessionWhere: Prisma.TreatmentSessionWhereInput,
) {
  const staffIdSet = new Set(staffIds);
  const doctorMap = new Map<string, number>();
  const nurseMap = new Map<string, number>();
  const adminMap = new Map<string, number>();

  if (staffIds.length === 0) {
    return { doctorMap, nurseMap, adminMap };
  }

  const sessions = await prisma.treatmentSession.findMany({
    where: {
      ...sessionWhere,
      OR: [
        { doctorId: { in: staffIds } },
        { nurseId: { in: staffIds } },
        { adminLayananId: { in: staffIds } },
        { sessionDoctors: { some: { doctorId: { in: staffIds } } } },
        { sessionNurses: { some: { nurseId: { in: staffIds } } } },
      ],
    },
    select: {
      doctorId: true,
      nurseId: true,
      adminLayananId: true,
      sessionDoctors: { select: { doctorId: true } },
      sessionNurses: { select: { nurseId: true } },
    },
  });

  for (const session of sessions) {
    const doctorIds = new Set<string>();
    const nurseIds = new Set<string>();

    if (staffIdSet.has(session.doctorId)) doctorIds.add(session.doctorId);
    if (staffIdSet.has(session.nurseId)) nurseIds.add(session.nurseId);
    if (staffIdSet.has(session.adminLayananId)) incrementCount(adminMap, session.adminLayananId);

    session.sessionDoctors.forEach(({ doctorId }) => {
      if (staffIdSet.has(doctorId)) doctorIds.add(doctorId);
    });
    session.sessionNurses.forEach(({ nurseId }) => {
      if (staffIdSet.has(nurseId)) nurseIds.add(nurseId);
    });

    doctorIds.forEach((doctorId) => incrementCount(doctorMap, doctorId));
    nurseIds.forEach((nurseId) => incrementCount(nurseMap, nurseId));
  }

  return { doctorMap, nurseMap, adminMap };
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
    allowedBranchIds = targetBranchId ? [targetBranchId] : undefined;
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
    allowedBranchIds = [branchId];
  } else if (callerRole === Role.SUPER_ADMIN && branchId === 'all') {
    // SUPER_ADMIN can see all branches
    isAllBranches = true;
    targetBranchId = undefined;
    allowedBranchIds = undefined;
  } else if (targetBranchId) {
    allowedBranchIds = [targetBranchId];
  }

  // For non-Super Admin, branch is required
  if (!isAllBranches && !targetBranchId) {
    throw errors.badRequest('BRANCH_REQUIRED', 'Branch ID diperlukan');
  }

  const dateFilter = buildDateFilter(startDate, endDate);
  const sessionBranchFilter = buildBranchFilter(allowedBranchIds);

  // Build user where clause
  const userWhere: Prisma.UserWhereInput = {
    isActive: true,
    role: { in: STAFF_PERFORMANCE_ROLES },
    ...buildStaffBranchWhere(allowedBranchIds),
  };

  // Get all matching staff first so ranking and pagination are based on performance order.
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
    orderBy: { profile: { fullName: 'asc' } },
  });

  const staffIds = staff.map((s) => s.id);

  const { doctorMap, nurseMap, adminMap } = await getPositionCountMaps(staffIds, {
    ...sessionBranchFilter,
    ...dateFilter,
  });

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
      ...(isAllBranches && 'branch' in s && s.branch ? { branch: s.branch } : {}),
      performance: {
        asDoctor,
        asNurse,
        asAdminLayanan,
        total,
      },
    };
  });

  // Sort by total performance descending before pagination so ranks are global.
  staffWithPerformance.sort((a, b) => {
    const performanceDiff = b.performance.total - a.performance.total;
    if (performanceDiff !== 0) return performanceDiff;
    return a.fullName.localeCompare(b.fullName);
  });

  const totalStaff = staffWithPerformance.length;
  const paginatedStaff = staffWithPerformance.slice(skip, skip + limit);

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
    staff: paginatedStaff,
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
  callerUserId?: string,
) {
  const { branchId, position = 'all', startDate, endDate, page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;
  let allowedBranchIds: string[] | undefined;

  if (callerRole === Role.ADMIN_CABANG) {
    allowedBranchIds = callerBranchId ? [callerBranchId] : [];
    if (branchId && branchId !== callerBranchId) {
      throw errors.forbidden('Anda tidak memiliki akses ke cabang ini');
    }
  } else if (callerRole === Role.ADMIN_MANAGER && callerUserId) {
    const managerBranches = await prisma.managerBranch.findMany({
      where: { userId: callerUserId },
      select: { branchId: true },
    });
    allowedBranchIds = managerBranches.map((branch) => branch.branchId);

    if (branchId) {
      if (!allowedBranchIds.includes(branchId)) {
        throw errors.forbidden('Anda tidak memiliki akses ke cabang ini');
      }

      allowedBranchIds = [branchId];
    }
  } else if (callerRole === Role.SUPER_ADMIN && branchId && branchId !== 'all') {
    allowedBranchIds = [branchId];
  }

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
      staffBranches: {
        select: {
          branchId: true,
        },
      },
    },
  });

  if (!staff) {
    throw errors.notFound('Staff tidak ditemukan');
  }

  const staffBranchIds = new Set([
    staff.branchId,
    ...staff.staffBranches.map((branch) => branch.branchId),
  ].filter(Boolean) as string[]);

  if (allowedBranchIds && !allowedBranchIds.some((branchId) => staffBranchIds.has(branchId))) {
    throw errors.forbidden('Anda tidak memiliki akses ke staff ini');
  }

  const dateFilter = buildDateFilter(startDate, endDate);
  const sessionBranchFilter = buildBranchFilter(allowedBranchIds);

  // Build position filter
  const positionFilter: Prisma.TreatmentSessionWhereInput = {};
  if (position === 'doctor') {
    positionFilter.OR = [
      { doctorId: staffId },
      { sessionDoctors: { some: { doctorId: staffId } } },
    ];
  } else if (position === 'nurse') {
    positionFilter.OR = [
      { nurseId: staffId },
      { sessionNurses: { some: { nurseId: staffId } } },
    ];
  } else if (position === 'adminLayanan') {
    positionFilter.adminLayananId = staffId;
  } else {
    // All positions
    positionFilter.OR = [
      { doctorId: staffId },
      { nurseId: staffId },
      { adminLayananId: staffId },
      { sessionDoctors: { some: { doctorId: staffId } } },
      { sessionNurses: { some: { nurseId: staffId } } },
    ];
  }

  // Get sessions
  const [sessions, totalSessions] = await Promise.all([
    prisma.treatmentSession.findMany({
      where: {
        ...positionFilter,
        ...sessionBranchFilter,
        ...dateFilter,
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
        sessionDoctors: {
          select: {
            doctorId: true,
          },
        },
        sessionNurses: {
          select: {
            nurseId: true,
          },
        },
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
        ...sessionBranchFilter,
        ...dateFilter,
      },
    }),
  ]);

  // Add position info to each session
  const sessionsWithPosition = sessions.map((session) => {
    const positions: string[] = [];
    if (
      session.doctorId === staffId ||
      session.sessionDoctors.some((sessionDoctor) => sessionDoctor.doctorId === staffId)
    ) {
      positions.push('doctor');
    }
    if (
      session.nurseId === staffId ||
      session.sessionNurses.some((sessionNurse) => sessionNurse.nurseId === staffId)
    ) {
      positions.push('nurse');
    }
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
      where: {
        OR: [
          { doctorId: staffId },
          { sessionDoctors: { some: { doctorId: staffId } } },
        ],
        ...sessionBranchFilter,
        ...dateFilter,
      },
    }),
    prisma.treatmentSession.count({
      where: {
        OR: [
          { nurseId: staffId },
          { sessionNurses: { some: { nurseId: staffId } } },
        ],
        ...sessionBranchFilter,
        ...dateFilter,
      },
    }),
    prisma.treatmentSession.count({
      where: {
        adminLayananId: staffId,
        ...sessionBranchFilter,
        ...dateFilter,
      },
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
