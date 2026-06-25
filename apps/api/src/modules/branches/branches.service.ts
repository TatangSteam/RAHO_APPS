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
  // Premier (PM) - Main packages
  { name: 'Terapi Nano Bubble 1X Premier', totalSessions: 1, price: 2_000_000, productCode: 'TNB-P1-PM' },
  { name: 'Terapi Nano Bubble 7X Premier', totalSessions: 7, price: 12_500_000, productCode: 'TNB-P7-PM' },
  { name: 'Terapi Nano Bubble 15X Premier', totalSessions: 15, price: 22_500_000, productCode: 'TNB-P15-PM' },
  
  // Partnership (PS)
  { name: 'Terapi Nano Bubble 1X Partnership', totalSessions: 1, price: 850_000, productCode: 'TNB-P1-PS' },
  
  // Partnership Homecare (PHC)
  { name: 'Terapi Nano Bubble 1X Partnership Homecare', totalSessions: 1, price: 1_000_000, productCode: 'TNB-P1-PHC' },
  
  // Free Packages (Bonus) - Premier
  { name: 'FREE Terapi Nano Bubble dan Booster 2X Premier', totalSessions: 2, price: 0, productCode: 'FRE-TRP-F2-PM' },
  { name: 'FREE Terapi Nano Bubble dan Booster 3X Premier', totalSessions: 3, price: 0, productCode: 'FRE-TRP-F3-PM' },
  { name: 'FREE Terapi Nano Bubble dan Booster 4X Premier', totalSessions: 4, price: 0, productCode: 'FRE-TRP-F4-PM' },
  { name: 'FREE Terapi Nano Bubble dan Booster 5X Premier', totalSessions: 5, price: 0, productCode: 'FRE-TRP-F5-PM' },
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
  { code: 'PM', name: 'Premier', price: 1_000_000 },
  { code: 'PS', name: 'Partnership', price: 650_000 },
  { code: 'PTY', name: 'Partnership Attiya', price: 600_000 },
  { code: 'PDA', name: 'Partnership Dr. Abhi', price: 65_000 },
  { code: 'PHC', name: 'Partnership Homecare', price: 750_000 },
];

function getRegencyCodePrefix(regencyCode?: string): string {
  const digits = (regencyCode || '').replace(/\D/g, '');
  if (digits.length !== 4) {
    throw errors.badRequest(
      'REGENCY_CODE_REQUIRED',
      'Pilih provinsi dan kabupaten/kota dari data wilayah sebelum membuat cabang.'
    );
  }

  return digits;
}

async function generateUniqueBranchCode(input: Pick<CreateBranchInput, 'regencyCode'>): Promise<string> {
  const prefix = getRegencyCodePrefix(input.regencyCode);
  const existingCodes = await prisma.branch.findMany({
    where: { branchCode: { startsWith: prefix } },
    select: { branchCode: true },
  });

  const usedCodes = new Set(existingCodes.map((branch) => branch.branchCode));
  const highestSuffix = existingCodes.reduce((highest, branch) => {
    const suffix = branch.branchCode.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) return highest;
    return Math.max(highest, Number(suffix));
  }, 0);

  let sequence = highestSuffix + 1;
  while (sequence < 100) {
    const code = `${prefix}${String(sequence).padStart(2, '0')}`;
    if (!usedCodes.has(code)) return code;
    sequence++;
  }

  throw errors.badRequest(
    'BRANCH_CODE_GENERATION_FAILED',
    `Nomor urut cabang untuk wilayah ${prefix} sudah penuh.`
  );
}

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

// ── Helper: Auto-add Products to Branch Inventory ─────────────
async function autoAddProductsToBranchInventory(branchId: string) {
  console.log(`📦 Auto-adding products to branch inventory: ${branchId}`);
  
  // Find all products with isAutoAddedToBranch = true
  const autoAddProducts = await prisma.masterProduct.findMany({
    where: {
      isAutoAddedToBranch: true,
      isActive: true,
    },
  });

  // Also ensure Infus Set + Pelengkap is always added (even if not flagged)
  const infusSetProduct = await prisma.masterProduct.findFirst({
    where: {
      OR: [
        { sku: 'PRD-INF-SET-002' },
        { sku: 'PRD-INF-SET-001' },
      ],
      isActive: true,
    },
    orderBy: { sku: 'desc' }, // PRD-INF-SET-002 first
  });

  // Combine products, ensuring no duplicates
  const productsToAdd = [...autoAddProducts];
  if (infusSetProduct && !productsToAdd.some(p => p.id === infusSetProduct.id)) {
    productsToAdd.push(infusSetProduct);
  }

  if (productsToAdd.length === 0) {
    console.log(`  ℹ️ No products configured for auto-add to branch`);
    return { productsAdded: 0 };
  }

  let addedCount = 0;
  for (const product of productsToAdd) {
    // Check if inventory item already exists
    const existing = await prisma.inventoryItem.findUnique({
      where: {
        masterProductId_branchId: {
          masterProductId: product.id,
          branchId,
        },
      },
    });

    if (!existing) {
      // Use defaultInitialStock or 100 for Infus Set
      const initialStock = product.defaultInitialStock || 
        (product.sku?.startsWith('PRD-INF-SET') ? 100 : 0);
      
      await prisma.inventoryItem.create({
        data: {
          masterProductId: product.id,
          branchId,
          stock: initialStock,
          minThreshold: 10, // Default minimum threshold
        },
      });
      console.log(`  ✅ Added ${product.name} with stock: ${initialStock} ${product.baseUnit}`);
      addedCount++;
    } else {
      console.log(`  ℹ️ ${product.name} already exists in branch inventory`);
    }
  }

  console.log(`  ✅ Auto-added ${addedCount} products to branch inventory`);
  return { productsAdded: addedCount };
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

  const summaryWhere = { ...where } as Prisma.BranchWhereInput;
  delete (summaryWhere as any).isActive;

  const [total, activeTotal, inactiveTotal, branches] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.count({ where: { ...summaryWhere, isActive: true } }),
    prisma.branch.count({ where: { ...summaryWhere, isActive: false } }),
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
        prisma.member.count({ where: { registrationBranchId: branch.id, isActive: true, isDeceased: false } }),
        // IMPORTANT: Include staff assigned via StaffBranch (multi-branch assignment)
        // Only count actual branch staff (exclude SUPER_ADMIN, ADMIN_MANAGER, and MEMBER)
        prisma.user.count({
          where: { 
            OR: [
              { branchId: branch.id }, // Primary branch
              { staffBranches: { some: { branchId: branch.id } } }, // Multi-branch assignment
            ],
            isActive: true,
            role: { in: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'] },
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
  return {
    branches: branchesWithCounts,
    total,
    page,
    limit,
    summary: {
      total: activeTotal + inactiveTotal,
      active: activeTotal,
      inactive: inactiveTotal,
    },
  };
}

// ── Get Branch with Stats ─────────────────────────────────────
export async function getBranchWithStatsService(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: branchSelect,
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  // Get stats
  // Note: activeUsers excludes MEMBER, ADMIN_MANAGER, and SUPER_ADMIN
  // IMPORTANT: Include staff assigned via StaffBranch (multi-branch assignment)
  const [activeUsers, totalMembers, activePackages] = await Promise.all([
    prisma.user.count({
      where: { 
        OR: [
          { branchId }, // Primary branch
          { staffBranches: { some: { branchId } } }, // Multi-branch assignment
        ],
        isActive: true,
        role: { in: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'] },
      },
    }),
    prisma.member.count({ where: { registrationBranchId: branchId, isActive: true, isDeceased: false } }),
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
      // IMPORTANT: Include staff assigned via StaffBranch (multi-branch assignment)
      // Only count actual branch staff (exclude SUPER_ADMIN, ADMIN_MANAGER, and MEMBER)
      const [activeUsers, totalMembers, activePackages] = await Promise.all([
        prisma.user.count({
          where: { 
            OR: [
              { branchId: branch.id }, // Primary branch
              { staffBranches: { some: { branchId: branch.id } } }, // Multi-branch assignment
            ],
            isActive: true,
            role: { in: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'] },
          },
        }),
        prisma.member.count({ where: { registrationBranchId: branch.id, isActive: true, isDeceased: false } }),
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
  const branchCode = await generateUniqueBranchCode(input);

  // Check if branch code already exists
  const existing = await prisma.branch.findUnique({
    where: { branchCode },
  });

  if (existing) {
    throw errors.conflict('BRANCH_CODE_DUPLICATE', 'Kode cabang sudah digunakan.');
  }

  const {
    provinceCode: _provinceCode,
    regencyCode: _regencyCode,
    ...branchInput
  } = input;
  const branch = await prisma.branch.create({
    data: {
      ...branchInput,
      branchCode,
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

  // Auto-add products with isAutoAddedToBranch flag to branch inventory
  try {
    const inventoryResult = await autoAddProductsToBranchInventory(branch.id);
    console.log(`✅ Auto-added ${inventoryResult.productsAdded} products to branch ${branch.branchCode} inventory`);
  } catch (error) {
    console.error(`⚠️ Failed to auto-add products to branch ${branch.branchCode} inventory:`, error);
    // Don't throw - branch creation should still succeed even if inventory creation fails
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

  const {
    provinceCode: _provinceCode,
    regencyCode: _regencyCode,
    ...branchInput
  } = input;
  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: branchInput,
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

// ── Delete Branch Permanently ─────────────────────────────────
export async function deleteBranchService(branchId: string) {
  const existing = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  });
  if (!existing) throw errors.notFound('Cabang tidak ditemukan.');

  // Medical, financial, and procurement history must never disappear as a
  // side effect of deleting a branch. An unused/test branch can still be
  // removed permanently together with its bootstrap data.
  const [
    members,
    memberPackages,
    memberAddOns,
    nonTherapyPurchases,
    invoices,
    encounters,
    treatmentSessions,
    stockRequests,
    stockRequestInvoices,
    shipments,
    overstocks,
    inventoryMutations,
    inventoryMaterialUsages,
    inventoryRequestItems,
    branchPricingUsages,
    referralMembers,
    referralIncentives,
  ] = await Promise.all([
    prisma.member.count({ where: { registrationBranchId: branchId } }),
    prisma.memberPackage.count({ where: { branchId } }),
    prisma.memberAddOn.count({ where: { branchId } }),
    prisma.memberNonTherapyPurchase.count({ where: { branchId } }),
    prisma.invoice.count({ where: { branchId } }),
    prisma.encounter.count({ where: { branchId } }),
    prisma.treatmentSession.count({ where: { branchId } }),
    prisma.stockRequest.count({ where: { branchId } }),
    prisma.stockRequestInvoice.count({ where: { branchId } }),
    prisma.shipment.count({
      where: {
        OR: [{ fromBranchId: branchId }, { toBranchId: branchId }],
      },
    }),
    prisma.branchOverstock.count({ where: { branchId } }),
    prisma.stockMutation.count({
      where: { inventoryItem: { branchId } },
    }),
    prisma.materialUsage.count({
      where: { inventoryItem: { branchId } },
    }),
    prisma.stockRequestItem.count({
      where: { inventoryItem: { branchId } },
    }),
    prisma.memberPackage.count({
      where: { packagePricing: { branchId } },
    }),
    prisma.member.count({
      where: { referralCode: { branchId } },
    }),
    prisma.referralIncentiveRecord.count({
      where: { referralCode: { branchId } },
    }),
  ]);

  const blockers = [
    ['member', members],
    ['paket member', memberPackages],
    ['add-on member', memberAddOns],
    ['pembelian non-terapi', nonTherapyPurchases],
    ['invoice', invoices],
    ['encounter', encounters],
    ['sesi terapi', treatmentSessions],
    ['permintaan stok', stockRequests],
    ['invoice permintaan stok', stockRequestInvoices],
    ['pengiriman', shipments],
    ['overstock', overstocks],
    ['mutasi stok', inventoryMutations],
    ['pemakaian material', inventoryMaterialUsages],
    ['item permintaan stok', inventoryRequestItems],
    ['paket yang memakai harga cabang', branchPricingUsages],
    ['member dengan kode referral cabang', referralMembers],
    ['insentif referral', referralIncentives],
  ].filter(([, count]) => Number(count) > 0);

  if (blockers.length > 0) {
    const blockerSummary = blockers
      .map(([label, count]) => `${label}: ${count}`)
      .join(', ');

    throw errors.conflict(
      'BRANCH_HAS_HISTORICAL_DATA',
      `Cabang tidak dapat dihapus permanen karena masih memiliki data historis (${blockerSummary}). Pindahkan atau selesaikan data tersebut terlebih dahulu.`
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    // Staff without another branch must not keep an active orphan account.
    const deactivatedUsers = await tx.user.updateMany({
      where: {
        branchId,
        isActive: true,
        staffBranches: {
          none: {
            branchId: { not: branchId },
          },
        },
      },
      data: { isActive: false },
    });

    const detachedUsers = await tx.user.updateMany({
      where: { branchId },
      data: { branchId: null },
    });

    // Preserve the audit trail, but remove its foreign-key reference to the
    // branch that is about to be deleted.
    const detachedAuditLogs = await tx.auditLog.updateMany({
      where: { branchId },
      data: { branchId: null },
    });

    const staffAssignments = await tx.staffBranch.deleteMany({ where: { branchId } });
    const managerAssignments = await tx.managerBranch.deleteMany({ where: { branchId } });
    const memberAccesses = await tx.branchMemberAccess.deleteMany({ where: { branchId } });
    const referralCodes = await tx.referralCode.deleteMany({ where: { branchId } });
    const packagePricings = await tx.packagePricing.deleteMany({ where: { branchId } });

    // Stock mutations do not have cascade deletion in the schema.
    const stockMutations = await tx.stockMutation.deleteMany({
      where: { inventoryItem: { branchId } },
    });
    const inventoryItems = await tx.inventoryItem.deleteMany({ where: { branchId } });

    await tx.branch.delete({ where: { id: branchId } });

    return {
      deactivatedUsers: deactivatedUsers.count,
      detachedUsers: detachedUsers.count,
      detachedAuditLogs: detachedAuditLogs.count,
      staffAssignments: staffAssignments.count,
      managerAssignments: managerAssignments.count,
      memberAccesses: memberAccesses.count,
      referralCodes: referralCodes.count,
      packagePricings: packagePricings.count,
      stockMutations: stockMutations.count,
      inventoryItems: inventoryItems.count,
    };
  });

  return {
    message: 'Cabang berhasil dihapus permanen',
    branch: existing,
    deleted,
  };
}

// ── Force Delete Branch (SUPER_ADMIN ONLY) ────────────────────
// ⚠️ DANGEROUS: This will permanently delete ALL data related to the branch
// including members, sessions, revenue, inventory, and all historical data
export async function forceDeleteBranchService(branchId: string) {
  const existing = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  });
  
  if (!existing) throw errors.notFound('Cabang tidak ditemukan.');

  console.log(`🚨 FORCE DELETE initiated for branch: ${existing.branchCode} (${existing.name})`);

  // Count all data that will be deleted for logging
  const counts = await Promise.all([
    prisma.member.count({ where: { registrationBranchId: branchId } }),
    prisma.memberPackage.count({ where: { branchId } }),
    prisma.memberAddOn.count({ where: { branchId } }),
    prisma.memberNonTherapyPurchase.count({ where: { branchId } }),
    prisma.invoice.count({ where: { branchId } }),
    prisma.encounter.count({ where: { branchId } }),
    prisma.treatmentSession.count({ where: { branchId } }),
    prisma.stockRequest.count({ where: { branchId } }),
    prisma.shipment.count({
      where: { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] },
    }),
    prisma.user.count({ where: { branchId } }),
  ]);

  console.log(`📊 Data to be deleted:`, {
    members: counts[0],
    packages: counts[1],
    addOns: counts[2],
    nonTherapyPurchases: counts[3],
    invoices: counts[4],
    encounters: counts[5],
    sessions: counts[6],
    stockRequests: counts[7],
    shipments: counts[8],
    users: counts[9],
  });

  // Execute force delete in transaction
  const deleted = await prisma.$transaction(async (tx) => {
    const deleteSessionRelatedData = async (sessionId: string) => {
      const evaluations = await tx.doctorEvaluation.findMany({
        where: { treatmentSessionId: sessionId },
        select: { id: true },
      });
      const evaluationIds = evaluations.map((evaluation) => evaluation.id);

      if (evaluationIds.length > 0) {
        await tx.doctorEvaluationHistory.deleteMany({
          where: { evaluationId: { in: evaluationIds } },
        });
      }

      await tx.vitalSign.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.infusionExecution.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.sessionPhoto.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.sessionSupportingPhoto.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.eMRNote.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.doctorEvaluation.deleteMany({ where: { treatmentSessionId: sessionId } });
      await tx.sessionDoctor.deleteMany({ where: { sessionId } });
      await tx.sessionNurse.deleteMany({ where: { sessionId } });
      await tx.materialUsage.deleteMany({ where: { treatmentSessionId: sessionId } });
    };

    const deleteMemberTherapyPlanData = async (memberId: string) => {
      const therapyPlanSets = await tx.therapyPlanSet.findMany({
        where: { memberId },
        select: { id: true },
      });
      const therapyPlanSetIds = therapyPlanSets.map((set) => set.id);
      const therapyPlans = await tx.therapyPlan.findMany({
        where: therapyPlanSetIds.length > 0
          ? {
              OR: [
                { memberId },
                { therapyPlanSetId: { in: therapyPlanSetIds } },
              ],
            }
          : { memberId },
        select: { id: true },
      });
      const therapyPlanIds = therapyPlans.map((plan) => plan.id);

      if (therapyPlanIds.length > 0) {
        await tx.infusionExecution.updateMany({
          where: { therapyPlanId: { in: therapyPlanIds } },
          data: { therapyPlanId: null },
        });
        await tx.therapyPlan.updateMany({
          where: { supersededById: { in: therapyPlanIds } },
          data: { supersededById: null },
        });
        await tx.therapyPlan.deleteMany({
          where: { id: { in: therapyPlanIds } },
        });
      }

      if (therapyPlanSetIds.length > 0) {
        await tx.therapyPlanSet.updateMany({
          where: { supersededById: { in: therapyPlanSetIds } },
          data: { supersededById: null },
        });
        await tx.therapyPlanSet.deleteMany({
          where: { id: { in: therapyPlanSetIds } },
        });
      }
    };

    // 1. Delete all members and their related data
    const members = await tx.member.findMany({
      where: { registrationBranchId: branchId },
      select: { id: true, userId: true },
    });

    for (const member of members) {
      await tx.diagnosis.deleteMany({ where: { memberId: member.id } });
      await tx.labResult.deleteMany({ where: { memberId: member.id } });
      await tx.memberDocument.deleteMany({ where: { memberId: member.id } });
      
      // Delete encounter-related data
      const encounters = await tx.encounter.findMany({
        where: { memberId: member.id },
        select: { id: true },
      });
      
      for (const encounter of encounters) {
        // Delete session-related data
        const sessions = await tx.treatmentSession.findMany({
          where: { encounterId: encounter.id },
          select: { id: true },
        });
        
        for (const session of sessions) {
          await deleteSessionRelatedData(session.id);
        }
      }

      await deleteMemberTherapyPlanData(member.id);

      for (const encounter of encounters) {
        await tx.treatmentSession.deleteMany({ where: { encounterId: encounter.id } });
      }
      
      await tx.encounter.deleteMany({ where: { memberId: member.id } });
      
      // Delete member packages and related
      await tx.referralIncentiveRecord.deleteMany({ where: { memberId: member.id } });
      await tx.memberAddOn.deleteMany({ where: { memberId: member.id } });
      await tx.memberPackage.deleteMany({ where: { memberId: member.id } });
      await tx.memberNonTherapyPurchase.deleteMany({ where: { memberId: member.id } });
      
      // Delete invoices for this member (must be before deleting member due to FK)
      const memberInvoices = await tx.invoice.findMany({
        where: { memberId: member.id },
        select: { id: true },
      });
      
      for (const invoice of memberInvoices) {
        await tx.invoicePayment.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      }
      await tx.invoice.deleteMany({ where: { memberId: member.id } });
      
      // Delete branch member access
      await tx.branchMemberAccess.deleteMany({ where: { memberId: member.id } });
      
      // Delete chat messages and rooms
      await tx.chatMessage.deleteMany({ where: { chatRoom: { memberId: member.id } } });
      await tx.chatRoom.deleteMany({ where: { memberId: member.id } });
      
      // Delete member
      await tx.member.delete({ where: { id: member.id } });
      
      // Delete user profile and user (if exists)
      if (member.userId) {
        await tx.notification.deleteMany({ where: { userId: member.userId } });
        await tx.userProfile.deleteMany({ where: { userId: member.userId } });
        await tx.user.delete({ where: { id: member.userId } });
      }
    }

    // 2. Delete all invoices and payments for this branch
    const invoices = await tx.invoice.findMany({
      where: { branchId },
      select: { id: true },
    });
    
    for (const invoice of invoices) {
      await tx.invoicePayment.deleteMany({ where: { invoiceId: invoice.id } });
    }
    await tx.invoice.deleteMany({ where: { branchId } });

    // 3. Delete inventory and stock-related data
    await tx.stockMutation.deleteMany({
      where: { inventoryItem: { branchId } },
    });
    
    await tx.stockRequestItem.deleteMany({
      where: { inventoryItem: { branchId } },
    });
    
    const stockRequests = await tx.stockRequest.findMany({
      where: { branchId },
      select: { id: true },
    });
    
    for (const stockRequest of stockRequests) {
      await tx.stockRequestInvoice.deleteMany({ where: { stockRequestId: stockRequest.id } });
    }

    // Shipments point to stock requests, so they must go first.
    const shipments = await tx.shipment.findMany({
      where: { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] },
      select: { id: true },
    });
    
    for (const shipment of shipments) {
      await tx.shipmentItem.deleteMany({ where: { shipmentId: shipment.id } });
    }
    
    await tx.shipment.deleteMany({
      where: { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] },
    });

    await tx.stockRequest.deleteMany({ where: { branchId } });
    
    await tx.branchOverstock.deleteMany({ where: { branchId } });
    await tx.inventoryItem.deleteMany({ where: { branchId } });

    // 4. Delete staff and their assignments
    const staff = await tx.user.findMany({
      where: { branchId },
      select: { id: true },
    });
    
    for (const user of staff) {
      // Delete sessions where user is doctor or nurse
      // Note: Sessions were already deleted in step 1 (member loop),
      // but we need to handle any remaining sessions that might reference this staff
      const staffSessions = await tx.treatmentSession.findMany({
        where: {
          OR: [
            { doctorId: user.id },
            { nurseId: user.id },
          ],
        },
        select: { id: true },
      });
      
      // Delete all session-related data first
      for (const session of staffSessions) {
        await deleteSessionRelatedData(session.id);
      }
      
      // Now delete the sessions
      await tx.treatmentSession.deleteMany({
        where: {
          OR: [
            { doctorId: user.id },
            { nurseId: user.id },
          ],
        },
      });
      
      await tx.userProfile.deleteMany({ where: { userId: user.id } });
      await tx.managerBranch.deleteMany({ where: { userId: user.id } });
      await tx.staffBranch.deleteMany({ where: { userId: user.id } });
      await tx.chatMessage.deleteMany({ where: { senderId: user.id } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
    }
    
    await tx.user.deleteMany({ where: { branchId } });

    // 5. Delete branch-specific data
    await tx.referralCode.deleteMany({ where: { branchId } });
    await tx.packagePricing.deleteMany({ where: { branchId } });
    await tx.managerBranch.deleteMany({ where: { branchId } });
    await tx.staffBranch.deleteMany({ where: { branchId } });
    await tx.branchMemberAccess.deleteMany({ where: { branchId } });
    
    // 6. Detach audit logs (preserve trail but remove FK)
    const detachedAuditLogs = await tx.auditLog.updateMany({
      where: { branchId },
      data: { branchId: null },
    });

    // 8. Finally, delete the branch itself
    await tx.branch.delete({ where: { id: branchId } });

    return {
      members: counts[0],
      packages: counts[1],
      addOns: counts[2],
      nonTherapyPurchases: counts[3],
      invoices: counts[4],
      encounters: counts[5],
      sessions: counts[6],
      stockRequests: counts[7],
      shipments: counts[8],
      users: counts[9],
      detachedAuditLogs: detachedAuditLogs.count,
    };
  });

  console.log(`✅ FORCE DELETE completed for branch: ${existing.branchCode}`);
  console.log(`📊 Deleted data summary:`, deleted);

  return {
    message: 'Cabang dan semua data terkait berhasil dihapus permanen',
    branch: existing,
    deleted,
  };
}

// ── Get Branch Sessions ────────────────────────────────────────
export async function getBranchSessionsService(
  branchId: string,
  params: { page?: number; limit?: number; status?: string }
) {
  // Verify branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, branchCode: true, name: true },
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  const page = Number.isFinite(params.page) ? Math.max(1, params.page as number) : 1;
  const limit = Number.isFinite(params.limit)
    ? Math.min(100, Math.max(1, params.limit as number))
    : 50;
  const skip = (page - 1) * limit;
  const normalizedStatus = params.status?.trim().toUpperCase();

  const where: Prisma.TreatmentSessionWhereInput = {
    branchId,
    ...(normalizedStatus === 'COMPLETED'
      ? { isCompleted: true }
      : normalizedStatus === 'ONGOING' || normalizedStatus === 'IN_PROGRESS'
        ? { isCompleted: false }
        : {}),
  };

  const [total, sessions] = await Promise.all([
    prisma.treatmentSession.count({ where }),
    prisma.treatmentSession.findMany({
      where,
      select: {
        id: true,
        sessionCode: true,
        treatmentDate: true,
        isCompleted: true,
        encounter: {
          select: {
            member: {
              select: {
                id: true,
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
                packageCode: true,
                productCode: true,
              },
            },
          },
        },
        doctor: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
        nurse: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { treatmentDate: 'desc' },
    }),
  ]);

  // Transform data with null safety for all optional relations
  const sessionsFormatted = sessions.map((s) => ({
    id: s.id,
    sessionCode: s.sessionCode,
    date: s.treatmentDate,
    status: s.isCompleted ? 'COMPLETED' : 'ONGOING',
    member: s.encounter.member ? {
      id: s.encounter.member.id,
      fullName: s.encounter.member.user?.profile?.fullName || 'N/A',
      memberNo: s.encounter.member.memberNo,
    } : null,
    doctor: s.doctor ? {
      fullName: s.doctor.profile?.fullName || 'N/A',
    } : null,
    nurse: s.nurse ? {
      fullName: s.nurse.profile?.fullName || 'N/A',
    } : null,
    package: s.encounter.memberPackage ? {
      name: s.encounter.memberPackage.productCode || s.encounter.memberPackage.packageCode,
    } : null,
  }));

  return {
    branch: {
      id: branch.id,
      branchCode: branch.branchCode,
      name: branch.name,
    },
    sessions: sessionsFormatted,
    total,
    page,
    limit,
  };
}
