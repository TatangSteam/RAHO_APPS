// @ts-nocheck
import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  CreateBranchInput,
  UpdateBranchInput,
  ListBranchesQuery,
} from './branches.schema';

// ── Shared Branch Select ──────────────────────────────────────
const branchSelect = {
  id: true,
  branchCode: true,
  name: true,
  address: true,
  city: true,
  phone: true,
  type: true,
  operatingHours: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

// ── List Branches ─────────────────────────────────────────────
export async function listBranchesService(query: ListBranchesQuery, userId?: string, userRole?: string) {
  const { page, limit, search, isActive, type } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.BranchWhereInput = {
    ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { branchCode: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  // Filter branches for ADMIN_MANAGER based on ManagerBranch assignments
  if (userRole === 'ADMIN_MANAGER' && userId) {
    where.managerBranches = {
      some: {
        userId: userId
      }
    };
  }

  const [total, branches] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      select: branchSelect,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Add member and staff counts to each branch
  const branchesWithCounts = await Promise.all(
    branches.map(async (branch) => {
      const [memberCount, staffCount] = await Promise.all([
        prisma.member.count({ where: { registrationBranchId: branch.id, isActive: true } }),
        prisma.user.count({
          where: { branchId: branch.id, isActive: true, NOT: { role: 'MEMBER' } },
        }),
      ]);

      return {
        ...branch,
        _count: {
          members: memberCount,
          staff: staffCount,
        },
      };
    })
  );

  return { branches: branchesWithCounts, total, page, limit };
}

// ── Get Branch with Stats ─────────────────────────────────────
export async function getBranchWithStatsService(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: branchSelect,
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  // Get stats
  const [activeUsers, totalMembers, activePackages] = await Promise.all([
    prisma.user.count({
      where: { branchId, isActive: true, NOT: { role: 'MEMBER' } },
    }),
    prisma.member.count({ where: { registrationBranchId: branchId, isActive: true } }),
    prisma.memberPackage.count({
      where: { branchId, status: 'ACTIVE' },
    }),
  ]);

  return {
    ...branch,
    stats: {
      activeUsers,
      totalMembers,
      activePackages,
    },
  };
}

// ── Get All Branches with Stats ───────────────────────────────
export async function getAllBranchesWithStatsService(userId?: string, userRole?: string) {
  console.log('🔍 getAllBranchesWithStatsService called with:', { userId, userRole });
  
  // Build where clause - ADMIN_MANAGER only sees branches they manage via ManagerBranch
  const where: Prisma.BranchWhereInput = {
    isActive: true, // Only show active branches
  };
  
  if (userRole === 'ADMIN_MANAGER' && userId) {
    console.log('✅ Applying ADMIN_MANAGER filter for userId:', userId);
    where.managerBranches = {
      some: {
        userId: userId
      }
    };
  }

  console.log('📋 Where clause:', JSON.stringify(where, null, 2));

  // First, let's verify the ManagerBranch records exist
  if (userRole === 'ADMIN_MANAGER' && userId) {
    const managerBranchRecords = await prisma.managerBranch.findMany({
      where: { userId },
      include: { branch: { select: { branchCode: true, name: true } } }
    });
    console.log(`📌 ManagerBranch records for user ${userId}:`, managerBranchRecords.map(mb => ({
      branchCode: mb.branch.branchCode,
      branchName: mb.branch.name
    })));
  }

  const branches = await prisma.branch.findMany({
    where,
    select: {
      ...branchSelect,
      createdBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${branches.length} branches for role ${userRole}`);

  // Get stats for each branch
  const branchesWithStats = await Promise.all(
    branches.map(async (branch) => {
      const [activeUsers, totalMembers, activePackages] = await Promise.all([
        prisma.user.count({
          where: { branchId: branch.id, isActive: true, NOT: { role: 'MEMBER' } },
        }),
        prisma.member.count({ where: { registrationBranchId: branch.id, isActive: true } }),
        prisma.memberPackage.count({
          where: { branchId: branch.id, status: 'ACTIVE' },
        }),
      ]);

      return {
        ...branch,
        stats: {
          activeUsers,
          totalMembers,
          activePackages,
        },
      };
    })
  );

  return branchesWithStats;
}

// ── Create Branch ─────────────────────────────────────────────
export async function createBranchService(input: CreateBranchInput, createdBy: string, userRole?: string) {
  // Check if branch code already exists
  const existing = await prisma.branch.findUnique({
    where: { branchCode: input.branchCode },
  });

  if (existing) {
    throw errors.conflict('BRANCH_CODE_DUPLICATE', 'Kode cabang sudah digunakan.');
  }

  const branch = await prisma.branch.create({
    data: {
      ...input,
      createdBy,
    },
    select: branchSelect,
  });

  // Auto-assign ADMIN_MANAGER to the branch they created
  if (userRole === 'ADMIN_MANAGER') {
    await prisma.managerBranch.create({
      data: {
        userId: createdBy,
        branchId: branch.id,
      },
    });
    console.log(`✅ Auto-assigned ADMIN_MANAGER (${createdBy}) to branch ${branch.branchCode}`);
  }

  return branch;
}

// ── Update Branch ─────────────────────────────────────────────
export async function updateBranchService(
  branchId: string,
  input: UpdateBranchInput
) {
  const existing = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!existing) throw errors.notFound('Cabang tidak ditemukan.');

  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: input,
    select: branchSelect,
  });

  return branch;
}

// ── Delete Branch (Soft Delete) ───────────────────────────────
export async function deleteBranchService(branchId: string) {
  const existing = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!existing) throw errors.notFound('Cabang tidak ditemukan.');

  // Check if branch has active users or members
  const [activeUsers, totalMembers, inventoryItems] = await Promise.all([
    prisma.user.count({ where: { branchId, isActive: true } }),
    prisma.member.count({ where: { registrationBranchId: branchId, isActive: true } }),
    prisma.inventoryItem.count({ where: { branchId } }),
  ]);

  // Soft delete branch (set isActive to false)
  // Also deactivate all related users
  await prisma.$transaction(async (tx) => {
    // Deactivate branch
    await tx.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    });

    // Deactivate all users in this branch
    if (activeUsers > 0) {
      await tx.user.updateMany({
        where: { branchId, isActive: true },
        data: { isActive: false },
      });
    }

    // Deactivate all members registered in this branch
    if (totalMembers > 0) {
      await tx.member.updateMany({
        where: { registrationBranchId: branchId, isActive: true },
        data: { isActive: false },
      });
    }
  });

  return {
    message: 'Cabang berhasil dihapus',
    deactivated: {
      users: activeUsers,
      members: totalMembers,
      inventoryItems,
    },
  };
}
