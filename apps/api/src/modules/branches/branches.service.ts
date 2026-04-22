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
export async function listBranchesService(query: ListBranchesQuery) {
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

  return { branches, total, page, limit };
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
    prisma.member.count({ where: { registrationBranchId: branchId } }),
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
  // Build where clause - ADMIN_MANAGER only sees branches they created
  const where: Prisma.BranchWhereInput = {};
  if (userRole === 'ADMIN_MANAGER' && userId) {
    where.createdBy = userId;
  }

  const branches = await prisma.branch.findMany({
    where,
    select: {
      ...branchSelect,
      createdBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get stats for each branch
  const branchesWithStats = await Promise.all(
    branches.map(async (branch) => {
      const [activeUsers, totalMembers, activePackages] = await Promise.all([
        prisma.user.count({
          where: { branchId: branch.id, isActive: true, NOT: { role: 'MEMBER' } },
        }),
        prisma.member.count({ where: { registrationBranchId: branch.id } }),
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
export async function createBranchService(input: CreateBranchInput, createdBy: string) {
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
  const [activeUsers, totalMembers] = await Promise.all([
    prisma.user.count({ where: { branchId, isActive: true } }),
    prisma.member.count({ where: { registrationBranchId: branchId } }),
  ]);

  if (activeUsers > 0 || totalMembers > 0) {
    throw errors.badRequest(
      'BRANCH_HAS_DATA',
      'Tidak dapat menghapus cabang yang masih memiliki user atau member aktif.'
    );
  }

  // Soft delete
  await prisma.branch.update({
    where: { id: branchId },
    data: { isActive: false },
  });
}
