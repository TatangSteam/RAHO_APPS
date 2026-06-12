/**
 * Script to reset StaffBranch assignments
 * This will delete all existing StaffBranch records and reseed with more realistic data
 * 
 * Run with: npx tsx scripts/reset-staff-branches.ts
 */

import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Resetting StaffBranch assignments...\n');

  // 1. Delete all existing StaffBranch records
  const deleteCount = await prisma.staffBranch.deleteMany({});
  console.log(`✅ Deleted ${deleteCount.count} existing StaffBranch assignments\n`);

  // 2. Get all active branches
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });

  if (branches.length === 0) {
    console.log('❌ No active branches found. Please run seed first.');
    return;
  }

  console.log(`📍 Found ${branches.length} active branches:`);
  branches.forEach((b, i) => console.log(`   ${i}. ${b.name} (${b.branchCode})`));
  console.log('');

  // 3. Get all doctors and nurses
  const doctors = await prisma.user.findMany({
    where: { role: Role.DOCTOR, isActive: true },
    include: { profile: true }
  });

  const nurses = await prisma.user.findMany({
    where: { role: Role.NURSE, isActive: true },
    include: { profile: true }
  });

  console.log(`👨‍⚕️  Found ${doctors.length} doctors:`);
  doctors.forEach((d, i) => console.log(`   ${i}. ${d.profile?.fullName} (${d.staffCode})`));
  console.log('');

  console.log(`👩‍⚕️  Found ${nurses.length} nurses:`);
  nurses.forEach((n, i) => console.log(`   ${i}. ${n.profile?.fullName} (${n.staffCode})`));
  console.log('');

  // 4. Assign doctors to SELECTED branches (realistic multi-branch setup)
  const doctorBranchMapping = [
    { doctor: doctors[0], branches: [branches[1], branches[2]] }, // Doctor 0 (Budi Santoso) → Branch 1 (Jakarta), 2 (Surabaya)
    { doctor: doctors[1], branches: [branches[2]] },               // Doctor 1 (Citra Wijaya) → Branch 2 (Surabaya) ONLY
    { doctor: doctors[2], branches: [branches[1], branches[2]] },  // Doctor 2 (Ahmad Fauzi) → Branch 1 (Jakarta), 2 (Surabaya)
  ];

  let assignmentCount = 0;

  console.log('👨‍⚕️  Assigning doctors to branches:');
  for (const mapping of doctorBranchMapping) {
    if (!mapping.doctor || !mapping.branches.length) continue;
    
    const doctorName = mapping.doctor.profile?.fullName || mapping.doctor.staffCode;
    const branchNames = mapping.branches.map(b => b.branchCode).join(', ');
    console.log(`   ${doctorName} → ${branchNames}`);

    for (const branch of mapping.branches) {
      await prisma.staffBranch.create({
        data: {
          userId: mapping.doctor.id,
          branchId: branch.id
        }
      });
      assignmentCount++;
    }
  }
  console.log('');

  // 5. Assign nurses to SELECTED branches
  const nurseBranchMapping = [
    { nurse: nurses[0], branches: [branches[0], branches[2]] }, // Nurse 0 (Siti Rahayu) → Branch 0 (Bandung), 2 (Surabaya)
    { nurse: nurses[1], branches: [branches[1]] },              // Nurse 1 (Dewi Lestari) → Branch 1 (Jakarta) ONLY
    { nurse: nurses[2], branches: [branches[0], branches[1]] }, // Nurse 2 (Eko Prasetyo) → Branch 0 (Bandung), 1 (Jakarta)
  ];

  console.log('👩‍⚕️  Assigning nurses to branches:');
  for (const mapping of nurseBranchMapping) {
    if (!mapping.nurse || !mapping.branches.length) continue;
    
    const nurseName = mapping.nurse.profile?.fullName || mapping.nurse.staffCode;
    const branchNames = mapping.branches.map(b => b.branchCode).join(', ');
    console.log(`   ${nurseName} → ${branchNames}`);

    for (const branch of mapping.branches) {
      await prisma.staffBranch.create({
        data: {
          userId: mapping.nurse.id,
          branchId: branch.id
        }
      });
      assignmentCount++;
    }
  }
  console.log('');

  console.log(`✅ Successfully created ${assignmentCount} StaffBranch assignments`);
  console.log('');
  console.log('📊 Summary:');
  console.log(`   - ${doctors.length} doctors assigned to branches`);
  console.log(`   - ${nurses.length} nurses assigned to branches`);
  console.log(`   - ${assignmentCount} total branch assignments`);
  console.log('');
  console.log('✨ Now you can test the "Assign Dokter/Nakes" modal with realistic data!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
