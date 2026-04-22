import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function checkAndCreateTestMember() {
  console.log('🔍 Checking for test member MBR-PST-2604-00001...\n');

  // Check if member exists
  const existingMember = await prisma.member.findUnique({
    where: { memberNo: 'MBR-PST-2604-00001' },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      registrationBranch: true,
    },
  });

  if (existingMember) {
    console.log('✅ Member already exists:');
    console.log(`   Member No: ${existingMember.memberNo}`);
    console.log(`   Name: ${existingMember.user.profile?.fullName}`);
    console.log(`   Branch: ${existingMember.registrationBranch.name}`);
    console.log(`   Active: ${existingMember.isActive ? 'Yes' : 'No'}`);
    await prisma.$disconnect();
    return;
  }

  console.log('❌ Member not found. Creating test member...\n');

  // Get PST branch
  const pstBranch = await prisma.branch.findFirst({
    where: { branchCode: 'PST' },
  });

  if (!pstBranch) {
    console.log('❌ PST branch not found. Please run seed first.');
    await prisma.$disconnect();
    return;
  }

  // Create user
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user = await prisma.user.create({
    data: {
      email: 'test.member@example.com',
      password: hashedPassword,
      role: 'MEMBER',
      isActive: true,
      profile: {
        create: {
          fullName: 'Test Member Pusat',
          phone: '081234567890',
        },
      },
    },
  });

  // Create member
  const member = await prisma.member.create({
    data: {
      userId: user.id,
      memberNo: 'MBR-PST-2604-00001',
      registrationBranchId: pstBranch.id,
      voucherCount: 0,
      isConsentToPhoto: true,
      isActive: true,
    },
  });

  console.log('✅ Test member created successfully:');
  console.log(`   Member No: ${member.memberNo}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: password123`);
  console.log(`   Branch: ${pstBranch.name}`);

  await prisma.$disconnect();
}

checkAndCreateTestMember().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
