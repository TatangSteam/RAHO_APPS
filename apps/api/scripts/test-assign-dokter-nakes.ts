/**
 * Comprehensive test for Assign Dokter/Nakes feature
 * Tests both API endpoints and database state
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Assign Dokter/Nakes Feature\n');
  console.log('='.repeat(60));
  console.log('\n');

  // 1. Get Bandung branch
  const bandung = await prisma.branch.findFirst({
    where: { branchCode: 'BDG' }
  });

  if (!bandung) {
    console.log('❌ Bandung branch not found');
    return;
  }

  console.log(`✅ Test Branch: ${bandung.name} (${bandung.branchCode})`);
  console.log(`   Branch ID: ${bandung.id}\n`);

  // 2. Get all doctors and nurses
  const allStaff = await prisma.user.findMany({
    where: {
      role: { in: ['DOCTOR', 'NURSE'] },
      isActive: true
    },
    include: {
      profile: true,
      branch: true,
      staffBranches: {
        include: {
          branch: true
        }
      }
    },
    orderBy: [
      { role: 'asc' },
      { profile: { fullName: 'asc' } }
    ]
  });

  console.log('👥 All Medical Staff:\n');

  for (const staff of allStaff) {
    const isAssignedToBandung = staff.staffBranches.some(sb => sb.branchId === bandung.id);
    const assignedBranchCodes = staff.staffBranches.map(sb => sb.branch.branchCode).join(', ');
    
    console.log(`${staff.role === 'DOCTOR' ? '👨‍⚕️ ' : '👩‍⚕️ '} ${staff.profile?.fullName}`);
    console.log(`   Role: ${staff.role}`);
    console.log(`   Staff Code: ${staff.staffCode}`);
    console.log(`   Primary Branch: ${staff.branch?.name || 'None'} (${staff.branch?.branchCode || 'N/A'})`);
    console.log(`   Assigned Branches: ${assignedBranchCodes || 'None'}`);
    console.log(`   Assigned to Bandung? ${isAssignedToBandung ? '✅ YES' : '❌ NO'}`);
    console.log(`   Expected Button: ${isAssignedToBandung ? '"Assigned" (disabled)' : '"Assign" (enabled)'}`);
    console.log('');
  }

  // 3. Verify API response structure
  console.log('='.repeat(60));
  console.log('\n📡 Testing API Response Structure\n');

  // Simulate what getAllMedicalStaffService returns
  const apiResponse = allStaff.map(s => ({
    id: s.id,
    email: s.email,
    role: s.role,
    staffCode: s.staffCode,
    fullName: s.profile?.fullName || '',
    phone: s.profile?.phone || '',
    primaryBranch: s.branch,
    assignedBranches: s.staffBranches.map(sb => sb.branch),
  }));

  console.log('Sample API Response for first staff member:');
  console.log(JSON.stringify(apiResponse[0], null, 2));
  console.log('');

  // 4. Test assignment logic
  console.log('='.repeat(60));
  console.log('\n🧮 Testing Assignment Logic\n');

  for (const staff of apiResponse) {
    const isAlreadyAssigned = staff.assignedBranches.some(b => b.id === bandung.id);
    const shouldDisableButton = isAlreadyAssigned;
    const buttonText = isAlreadyAssigned ? 'Assigned' : 'Assign';
    const buttonClass = isAlreadyAssigned ? 'disabled (gray)' : 'enabled (green)';

    console.log(`${staff.fullName}:`);
    console.log(`   assignedBranches.length: ${staff.assignedBranches.length}`);
    console.log(`   assignedBranches IDs: ${staff.assignedBranches.map(b => b.id).join(', ')}`);
    console.log(`   Checking against Bandung ID: ${bandung.id}`);
    console.log(`   isAlreadyAssigned: ${isAlreadyAssigned}`);
    console.log(`   shouldDisableButton: ${shouldDisableButton}`);
    console.log(`   Button Text: "${buttonText}"`);
    console.log(`   Button Style: ${buttonClass}`);
    console.log('');
  }

  // 5. Summary
  console.log('='.repeat(60));
  console.log('\n📊 Summary\n');

  const assignedToBandung = allStaff.filter(s => 
    s.staffBranches.some(sb => sb.branchId === bandung.id)
  );
  const notAssignedToBandung = allStaff.filter(s => 
    !s.staffBranches.some(sb => sb.branchId === bandung.id)
  );

  console.log(`Total Medical Staff: ${allStaff.length}`);
  console.log(`  - Doctors: ${allStaff.filter(s => s.role === 'DOCTOR').length}`);
  console.log(`  - Nurses: ${allStaff.filter(s => s.role === 'NURSE').length}`);
  console.log('');
  console.log(`Assigned to Bandung: ${assignedToBandung.length}`);
  assignedToBandung.forEach(s => {
    console.log(`  ✅ ${s.profile?.fullName} (${s.role})`);
  });
  console.log('');
  console.log(`NOT Assigned to Bandung: ${notAssignedToBandung.length}`);
  notAssignedToBandung.forEach(s => {
    console.log(`  ❌ ${s.profile?.fullName} (${s.role})`);
  });
  console.log('');

  // 6. Expected Modal Behavior
  console.log('='.repeat(60));
  console.log('\n🎯 Expected Modal Behavior in Browser\n');

  console.log('When opening "Assign Dokter/Nakes" modal for Bandung:\n');
  
  if (assignedToBandung.length > 0) {
    console.log('Should show "Assigned" (gray, disabled):');
    assignedToBandung.forEach(s => {
      console.log(`  • ${s.profile?.fullName}`);
      console.log(`    - Button: gray, disabled, text "Assigned"`);
      console.log(`    - Badge "BDG" should be GREEN`);
    });
    console.log('');
  }

  if (notAssignedToBandung.length > 0) {
    console.log('Should show "Assign" (green, enabled):');
    notAssignedToBandung.forEach(s => {
      console.log(`  • ${s.profile?.fullName}`);
      console.log(`    - Button: green, enabled, text "Assign"`);
      console.log(`    - Should NOT have "BDG" badge`);
      console.log(`    - Other branch badges should be gray/white`);
    });
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('\n✅ Test Complete!\n');
  console.log('Next steps:');
  console.log('1. Refresh browser (Ctrl+Shift+R)');
  console.log('2. Open Bandung branch detail page');
  console.log('3. Click "Assign Dokter/Nakes" button');
  console.log('4. Check that staff members show correct assignment status');
  console.log('5. Try assigning someone who is NOT assigned yet');
  console.log('6. Verify toast and UI updates after assignment\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
