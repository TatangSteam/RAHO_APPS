import { PrismaClient, BranchType } from '@prisma/client';

export async function seedBranches(prisma: PrismaClient) {
  console.log('🏢 Seeding branches...');

  const branchPusat = await prisma.branch.upsert({
    where: { branchCode: 'PST' },
    update: {},
    create: {
      branchCode: 'PST',
      name: 'RAHO Premiere Jakarta',
      address: 'Jl. Sudirman Kav. 52-53, Jakarta Selatan',
      city: 'Jakarta',
      phone: '021-12345678',
      type: BranchType.PREMIERE,
      operatingHours: '24 Jam',
    },
  });

  const branchBandung = await prisma.branch.upsert({
    where: { branchCode: 'BDG' },
    update: {},
    create: {
      branchCode: 'BDG',
      name: 'RAHO Partnership Bandung',
      address: 'Jl. Asia Afrika No. 10, Bandung',
      city: 'Bandung',
      phone: '022-87654321',
      type: BranchType.PARTNERSHIP,
      operatingHours: '08:00 - 20:00',
    },
  });

  const branchSurabaya = await prisma.branch.upsert({
    where: { branchCode: 'SBY' },
    update: {},
    create: {
      branchCode: 'SBY',
      name: 'RAHO Premiere Surabaya',
      address: 'Jl. Tunjungan No. 25, Surabaya',
      city: 'Surabaya',
      phone: '031-55667788',
      type: BranchType.PREMIERE,
      operatingHours: '08:00 - 22:00',
    },
  });

  console.log(`✅ Branches: ${branchPusat.name}, ${branchBandung.name}, ${branchSurabaya.name}`);

  return { branchPusat, branchBandung, branchSurabaya };
}

// Helper function to assign branches to Admin Manager (called after users are seeded)
export async function assignBranchesToManager(prisma: PrismaClient) {
  console.log('🔗 Assigning branches to Admin Manager...');

  const adminManager = await prisma.user.findUnique({
    where: { email: 'manager@raho.id' },
  });

  if (!adminManager) {
    console.log('⚠️  Admin Manager not found, skipping branch assignment');
    return;
  }

  const result = await prisma.branch.updateMany({
    where: {
      createdBy: null,
    },
    data: {
      createdBy: adminManager.id,
    },
  });

  console.log(`✅ Assigned ${result.count} branches to Admin Manager`);
}
