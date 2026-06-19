import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Minimal seed: Hanya create 1 SUPER_ADMIN
 * 
 * CATATAN:
 * - Jika ingin reset database sepenuhnya, jalankan: npx prisma migrate reset --force
 * - Script ini hanya membuat branch HQ dan super admin
 */
async function main() {
  console.log('🌱 Starting minimal seed (SUPER_ADMIN only)...\n');

  // 1. Create or get default branch (required for super admin)
  console.log('📍 Checking/creating default branch...');
  let branch = await prisma.branch.findUnique({
    where: { branchCode: 'HQ' },
  });

  if (branch) {
    console.log(`ℹ️  Branch 'HQ' already exists, using existing branch\n`);
  } else {
    branch = await prisma.branch.create({
      data: {
        branchCode: 'HQ',
        name: 'Head Office',
        address: 'Jakarta',
        city: 'Jakarta',
        phone: '021-1234567',
        type: 'PUSAT',
        operatingHours: '08:00 - 17:00',
        isActive: true,
      },
    });
    console.log(`✅ Branch created: ${branch.name} (${branch.branchCode})\n`);
  }

  // 2. Create or get SUPER_ADMIN users (2 users)
  console.log('👤 Creating/checking SUPER_ADMIN users...\n');
  
  // === SUPER ADMIN 1 ===
  console.log('📋 Super Admin 1: admin@rahopremier.id');
  let superAdmin1 = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@rahopremier.id' },
        { staffCode: 'SA000' },
      ],
    },
    include: {
      profile: true,
      branch: {
        select: {
          name: true,
          branchCode: true,
        },
      },
    },
  });

  if (superAdmin1) {
    console.log(`   ℹ️  Already exists (${superAdmin1.email}), skipping\n`);
  } else {
    const hashedPassword1 = await bcrypt.hash('SuP3r4Dm1n', 10);

    superAdmin1 = await prisma.user.create({
      data: {
        email: 'admin@rahopremier.id',
        password: hashedPassword1,
        role: 'SUPER_ADMIN',
        staffCode: 'SA000',
        branchId: branch.id,
        isActive: true,
        profile: {
          create: {
            fullName: 'Super Administrator',
            phone: '08123456789',
          },
        },
      },
      include: {
        profile: true,
        branch: {
          select: {
            name: true,
            branchCode: true,
          },
        },
      },
    });

    console.log('   ✅ Created successfully\n');
  }

  // === SUPER ADMIN 2 ===
  console.log('📋 Super Admin 2: jovanku1@gmail.com');
  let superAdmin2 = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'jovanku1@gmail.com' },
        { staffCode: 'SA002' },
      ],
    },
    include: {
      profile: true,
      branch: {
        select: {
          name: true,
          branchCode: true,
        },
      },
    },
  });

  if (superAdmin2) {
    console.log(`   ℹ️  Already exists (${superAdmin2.email}), skipping\n`);
  } else {
    const hashedPassword2 = await bcrypt.hash('Kuncoro@1', 10);

    superAdmin2 = await prisma.user.create({
      data: {
        email: 'jovanku1@gmail.com',
        password: hashedPassword2,
        role: 'SUPER_ADMIN',
        staffCode: 'SA002',
        branchId: branch.id,
        isActive: true,
        profile: {
          create: {
            fullName: 'Jovan Prabowo Kuncoro',
            phone: '081233742584',
          },
        },
      },
      include: {
        profile: true,
        branch: {
          select: {
            name: true,
            branchCode: true,
          },
        },
      },
    });

    console.log('   ✅ Created successfully\n');
  }

  // Display both users info
  console.log('👥 SUPER_ADMIN Users:');
  console.log('\n🔹 User 1:');
  console.log(`   Email: ${superAdmin1.email}`);
  console.log(`   Password: SuP3r4Dm1n`);
  console.log(`   Staff Code: ${superAdmin1.staffCode}`);
  console.log(`   Name: ${superAdmin1.profile?.fullName}`);
  console.log(`   Branch: ${superAdmin1.branch?.name} (${superAdmin1.branch?.branchCode})`);

  console.log('\n🔹 User 2:');
  console.log(`   Email: ${superAdmin2.email}`);
  console.log(`   Password: Kuncoro@1`);
  console.log(`   Staff Code: ${superAdmin2.staffCode}`);
  console.log(`   Name: ${superAdmin2.profile?.fullName}`);
  console.log(`   Branch: ${superAdmin2.branch?.name} (${superAdmin2.branch?.branchCode})`);
  
  console.log('\n✅ Minimal seed completed successfully!');
  console.log('\n📋 Login Credentials (2 Super Admins):');
  console.log('   1. admin@rahopremier.id / SuP3r4Dm1n');
  console.log('   2. jovanku1@gmail.com / Kuncoro@1');
  console.log('\n⚠️  IMPORTANT: Change passwords after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
