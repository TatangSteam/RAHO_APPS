// @ts-nocheck
import { Prisma, PackageType } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  CreateBranchInput,
  UpdateBranchInput,
  ListBranchesQuery,
} from './branches.schema';

// ── Default Package Pricing Data ──────────────────────────────
const DEFAULT_THERAPY_PACKAGES = [
  // Premiere (PM) - Main packages
  { name: 'Terapi Nano Bubble 1X Premiere', totalSessions: 1, price: 2_000_000, productCode: 'TNB-P1-PM' },
  { name: 'Terapi Nano Bubble 7X Premiere', totalSessions: 7, price: 12_500_000, productCode: 'TNB-P7-PM' },
  { name: 'Terapi Nano Bubble 15X Premiere', totalSessions: 15, price: 22_500_000, productCode: 'TNB-P15-PM' },
  
  // Partnership (PS)
  { name: 'Terapi Nano Bubble 1X Partnership', totalSessions: 1, price: 850_000, productCode: 'TNB-P1-PS' },
  
  // Partnership Homecare (PHC)
  { name: 'Terapi Nano Bubble 1X Partnership Homecare', totalSessions: 1, price: 1_000_000, productCode: 'TNB-P1-PHC' },
  
  // Free Packages (Bonus) - Premiere
  { name: 'FREE Terapi Nano Bubble dan Booster 2X Premiere', totalSessions: 2, price: 0, productCode: 'FRE-TRP-F2-PM' },
  { name: 'FREE Terapi Nano Bubble dan Booster 3X Premiere', totalSessions: 3, price: 0, productCode: 'FRE-TRP-F3-PM' },
  { name: 'FREE Terapi Nano Bubble dan Booster 4X Premiere', totalSessions: 4, price: 0, productCode: 'FRE-TRP-F4-PM' },
  { name: 'FREE Terapi Nano Bubble dan Booster 5X Premiere', totalSessions: 5, price: 0, productCode: 'FRE-TRP-F5-PM' },
];

const DEFAULT_BOOSTER_TYPES = [
  { code: 'NO', name: 'NO' },
  { code: 'GT', name: 'GT' },
  { code: 'MB', name: 'MB' },
  { code: 'KCL', name: 'KCL' },
  { code: 'H2S', name: 'H2S' },
  { code: 'HK', name: 'H2S Konsentrat' },
  { code: 'O3', name: 'O3' },
];

const DEFAULT_SERVICE_TYPES = [
  { code: 'PM', name: 'Premiere', price: 1_000_000 },
  { code: 'PS', name: 'Partnership', price: 650_000 },
  { code: 'PTY', name: 'Partnership Attiya', price: 600_000 },
  { code: 'PDA', name: 'Partnership Dr. Abhi', price: 65_000 },
  { code: 'PHC', name: 'Partnership Homecare', price: 750_000 },
];

// ── Helper: Create Default Package Pricing for Branch ─────────
async function createDefaultPackagePricingForBranch(branchId: string) {
  console.log(`📦 Creating default package pricings for branch: ${branchId}`);
  
  // Create therapy packages (BASIC)
  for (const pkg of DEFAULT_THERAPY_PACKAGES) {
    await prisma.packagePricing.create({
      data: {
        branchId,
        packageType: PackageType.BASIC,
        boosterType: null,
        name: pkg.name,
        totalSessions: pkg.totalSessions,
        price: pkg.price,
        productCode: pkg.productCode,
        isActive: true,
      },
    });
  }
  console.log(`  ✅ Created ${DEFAULT_THERAPY_PACKAGES.length} therapy packages`);

  // Create booster packages (7 types × 5 service types = 35 packages)
  let boosterCount = 0;
  for (const boosterType of DEFAULT_BOOSTER_TYPES) {
    for (const serviceType of DEFAULT_SERVICE_TYPES) {
      const name = `Booster ${boosterType.code} (${boosterType.name}) 1X - ${serviceType.name}`;
      const productCode = `BST-${boosterType.code}-P1-${serviceType.code}`;

      await prisma.packagePricing.create({
        data: {
          branchId,
          packageType: PackageType.BOOSTER,
          boosterType: boosterType.code as any,
          serviceType: serviceType.code,
          name,
          totalSessions: 1,
          price: serviceType.price,
          productCode,
          isActive: true,
        },
      });
      boosterCount++;
    }
  }
  console.log(`  ✅ Created ${boosterCount} booster packages`);
  
  return {
    therapyPackages: DEFAULT_THERAPY_PACKAGES.length,
    boosterPackages: boosterCount,
    total: DEFAULT_THERAPY_PACKAGES.length + boosterCount,
  };
}

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
          where: { 
            branchId: branch.id, 
            isActive: true, 
            NOT: { role: { in: ['MEMBER', 'ADMIN_MANAGER'] } },
          },
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
  // Note: activeUsers excludes MEMBER and ADMIN_MANAGER (Admin Managers are shown in separate tab)
  const [activeUsers, totalMembers, activePackages] = await Promise.all([
    prisma.user.count({
      where: { 
        branchId, 
        isActive: true, 
        NOT: { role: { in: ['MEMBER', 'ADMIN_MANAGER'] } },
      },
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
          where: { 
            branchId: branch.id, 
            isActive: true, 
            NOT: { role: { in: ['MEMBER', 'ADMIN_MANAGER'] } },
          },
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

  // Auto-create default package pricing for the new branch
  try {
    const pricingResult = await createDefaultPackagePricingForBranch(branch.id);
    console.log(`✅ Created ${pricingResult.total} default package pricings for branch ${branch.branchCode}`);
  } catch (error) {
    console.error(`⚠️ Failed to create default package pricings for branch ${branch.branchCode}:`, error);
    // Don't throw - branch creation should still succeed even if pricing creation fails
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

// ── Get Branch Managers ────────────────────────────────────────
export async function getBranchManagersService(branchId: string) {
  // Verify branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, branchCode: true, name: true },
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  // Get all Admin Managers assigned to this branch
  const managerBranches = await prisma.managerBranch.findMany({
    where: { branchId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          profile: {
            select: {
              fullName: true,
              phone: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  const managers = managerBranches.map((mb) => ({
    id: mb.user.id,
    email: mb.user.email,
    role: mb.user.role,
    isActive: mb.user.isActive,
    fullName: mb.user.profile?.fullName || '',
    phone: mb.user.profile?.phone || '',
    avatarUrl: mb.user.profile?.avatarUrl || null,
    lastLoginAt: mb.user.lastLoginAt,
    assignedAt: mb.createdAt,
  }));

  return {
    branch: {
      id: branch.id,
      branchCode: branch.branchCode,
      name: branch.name,
    },
    managers,
    total: managers.length,
  };
}

// ── Assign Manager to Branch ──────────────────────────────────
export async function assignManagerToBranchService(branchId: string, managerId: string) {
  // Verify branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, branchCode: true, name: true },
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  // Verify user exists and is ADMIN_MANAGER
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, email: true, role: true, profile: { select: { fullName: true } } },
  });

  if (!manager) throw errors.notFound('User tidak ditemukan.');
  if (manager.role !== 'ADMIN_MANAGER') {
    throw errors.badRequest('INVALID_ROLE', 'User harus memiliki role ADMIN_MANAGER.');
  }

  // Check if already assigned
  const existing = await prisma.managerBranch.findUnique({
    where: {
      userId_branchId: {
        userId: managerId,
        branchId: branchId,
      },
    },
  });

  if (existing) {
    throw errors.conflict('ALREADY_ASSIGNED', 'Admin Manager sudah di-assign ke cabang ini.');
  }

  // Create assignment
  await prisma.managerBranch.create({
    data: {
      userId: managerId,
      branchId: branchId,
    },
  });

  return {
    message: 'Admin Manager berhasil di-assign ke cabang',
    manager: {
      id: manager.id,
      email: manager.email,
      fullName: manager.profile?.fullName || manager.email,
    },
    branch: {
      id: branch.id,
      branchCode: branch.branchCode,
      name: branch.name,
    },
  };
}

// ── Unassign Manager from Branch ──────────────────────────────
export async function unassignManagerFromBranchService(branchId: string, managerId: string) {
  // Verify branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, branchCode: true, name: true },
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  // Check if assignment exists
  const existing = await prisma.managerBranch.findUnique({
    where: {
      userId_branchId: {
        userId: managerId,
        branchId: branchId,
      },
    },
  });

  if (!existing) {
    throw errors.notFound('Admin Manager tidak di-assign ke cabang ini.');
  }

  // Delete assignment
  await prisma.managerBranch.delete({
    where: {
      userId_branchId: {
        userId: managerId,
        branchId: branchId,
      },
    },
  });

  return {
    message: 'Admin Manager berhasil di-unassign dari cabang',
  };
}

// ── Get Available Managers for Branch ─────────────────────────
export async function getAvailableManagersForBranchService(branchId: string) {
  // Get all ADMIN_MANAGER users who are NOT assigned to this branch
  const assignedManagerIds = await prisma.managerBranch.findMany({
    where: { branchId },
    select: { userId: true },
  });

  const assignedIds = assignedManagerIds.map((m) => m.userId);

  const availableManagers = await prisma.user.findMany({
    where: {
      role: 'ADMIN_MANAGER',
      isActive: true,
      id: { notIn: assignedIds },
    },
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          fullName: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return availableManagers.map((m) => ({
    id: m.id,
    email: m.email,
    fullName: m.profile?.fullName || m.email,
    phone: m.profile?.phone || '',
  }));
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
