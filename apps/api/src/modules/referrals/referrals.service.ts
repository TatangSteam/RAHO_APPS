// @ts-nocheck
import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  CreateReferralInput,
  UpdateReferralInput,
  ListReferralsQuery,
} from './referrals.schema';

// ── Shared Referral Select ────────────────────────────────────
const referralSelect = {
  id: true,
  code: true,
  referrerName: true,
  referrerType: true,
  branchId: true,
  phone: true,
  email: true,
  totalReferrals: true,
  totalIncentiveEarned: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  },
} satisfies Prisma.ReferralCodeSelect;

// ── Generate Referral Code ────────────────────────────────────
async function generateReferralCode(): Promise<string> {
  // Get the latest referral code number
  const lastReferral = await prisma.referralCode.findFirst({
    where: {
      code: {
        startsWith: 'REF-',
      },
    },
    orderBy: {
      code: 'desc',
    },
    select: {
      code: true,
    },
  });

  let nextNumber = 1;
  if (lastReferral) {
    const match = lastReferral.code.match(/REF-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `REF-${String(nextNumber).padStart(3, '0')}`;
}

// ── List Referrals ────────────────────────────────────────────
export async function listReferralsService(
  query: ListReferralsQuery,
  userId?: string,
  userRole?: string,
  userBranchId?: string
) {
  const { page, limit, search, branchId, referrerType, isActive } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ReferralCodeWhereInput = {
    ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
    ...(referrerType ? { referrerType } : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { referrerName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  // Branch filtering based on role
  if (userRole === 'ADMIN_CABANG') {
    // ADMIN_CABANG can only see referrals in their branch
    // Use branchId directly from user or from staffBranches relation
    if (userBranchId) {
      where.branchId = userBranchId;
    } else {
      // Fallback: get from staffBranches relation
      const staffBranch = await prisma.staffBranch.findFirst({
        where: { userId: userId },
        select: { branchId: true },
      });
      
      if (staffBranch) {
        where.branchId = staffBranch.branchId;
      }
    }
  } else if (userRole === 'ADMIN_MANAGER' && userId) {
    // ADMIN_MANAGER can see referrals in branches they manage
    const managerBranches = await prisma.managerBranch.findMany({
      where: { userId: userId },
      select: { branchId: true },
    });
    
    if (managerBranches.length > 0) {
      where.branchId = {
        in: managerBranches.map((mb) => mb.branchId),
      };
    }
  } else if (branchId) {
    // For SUPER_ADMIN and others, allow filtering by branchId
    where.branchId = branchId;
  }

  const [total, referrals] = await Promise.all([
    prisma.referralCode.count({ where }),
    prisma.referralCode.findMany({
      where,
      select: referralSelect,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Transform Decimal values to numbers for JSON serialization
  const transformedReferrals = referrals.map((ref) => ({
    ...ref,
    totalIncentiveEarned: Number(ref.totalIncentiveEarned),
  }));

  // Force JSON serialization to catch any remaining issues
  const serialized = JSON.parse(JSON.stringify(transformedReferrals));

  return { referrals: serialized, total, page, limit };
}

// ── Get Referral by ID ────────────────────────────────────────
export async function getReferralByIdService(referralId: string) {
  const referral = await prisma.referralCode.findUnique({
    where: { id: referralId },
    select: {
      ...referralSelect,
      _count: {
        select: {
          members: true,
          incentiveRecords: true,
        },
      },
    },
  });

  if (!referral) throw errors.notFound('Kode referral tidak ditemukan.');

  return referral;
}

// ── Get Referral Incentive Records ───────────────────────────
export async function getReferralIncentiveRecordsService(
  referralId: string,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;

  const referral = await prisma.referralCode.findUnique({
    where: { id: referralId },
  });

  if (!referral) throw errors.notFound('Kode referral tidak ditemukan.');

  const [total, records] = await Promise.all([
    prisma.referralIncentiveRecord.count({ where: { referralCodeId: referralId } }),
    prisma.referralIncentiveRecord.findMany({
      where: { referralCodeId: referralId },
      select: {
        id: true,
        packageType: true,
        packageName: true,
        packageValue: true,
        isFirstPackage: true,
        incentiveType: true,
        incentiveValue: true,
        incentiveAmount: true,
        notes: true,
        createdAt: true,
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
            id: true,
            packageCode: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { records, total, page, limit };
}

// ── Create Referral ───────────────────────────────────────────
export async function createReferralService(input: CreateReferralInput) {
  // Check if branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
  });

  if (!branch) throw errors.notFound('Cabang tidak ditemukan.');

  // Generate referral code
  const code = await generateReferralCode();

  const referral = await prisma.referralCode.create({
    data: {
      code,
      ...input,
    },
    select: referralSelect,
  });

  return referral;
}

// ── Update Referral ───────────────────────────────────────────
export async function updateReferralService(
  referralId: string,
  input: UpdateReferralInput
) {
  const existing = await prisma.referralCode.findUnique({
    where: { id: referralId },
  });

  if (!existing) throw errors.notFound('Kode referral tidak ditemukan.');

  const referral = await prisma.referralCode.update({
    where: { id: referralId },
    data: input,
    select: referralSelect,
  });

  return referral;
}

// ── Delete Referral (Soft Delete) ────────────────────────────
export async function deleteReferralService(referralId: string) {
  const existing = await prisma.referralCode.findUnique({
    where: { id: referralId },
  });

  if (!existing) throw errors.notFound('Kode referral tidak ditemukan.');

  // Soft delete (set isActive to false)
  await prisma.referralCode.update({
    where: { id: referralId },
    data: { isActive: false },
  });

  return { message: 'Kode referral berhasil dihapus' };
}

// ── Get All Active Referrals (for dropdown) ──────────────────
export async function getActiveReferralsService(branchId?: string) {
  const where: Prisma.ReferralCodeWhereInput = {
    isActive: true,
    ...(branchId ? { branchId } : {}),
  };

  const referrals = await prisma.referralCode.findMany({
    where,
    select: {
      id: true,
      code: true,
      referrerName: true,
      referrerType: true,
    },
    orderBy: { code: 'asc' },
  });

  return referrals;
}
