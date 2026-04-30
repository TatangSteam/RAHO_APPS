/**
 * Test script to verify Manager Branch assignments
 * Run with: npx tsx test-manager-branches.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testManagerBranches() {
  console.log('🔍 Testing Manager Branch Assignments\n');
  console.log('='.repeat(60));

  try {
    // 1. Check Admin Manager users
    console.log('\n1️⃣ Checking Admin Manager Users:');
    const managers = await prisma.user.findMany({
      where: { role: 'ADMIN_MANAGER' },
      include: {
        profile: true
      }
    });

    console.log(`   Found ${managers.length} ADMIN_MANAGER users:`);
    managers.forEach(m => {
      console.log(`   - ${m.email} (${m.profile?.fullName})`);
      console.log(`     ID: ${m.id}`);
      console.log(`     branchId: ${m.branchId || 'NULL ✅'}`);
    });

    // 2. Check all branches
    console.log('\n2️⃣ Checking All Branches:');
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`   Found ${branches.length} branches:`);
    branches.forEach(b => {
      console.log(`   - ${b.name} (${b.branchCode})`);
      console.log(`     ID: ${b.id}`);
      console.log(`     Type: ${b.type}`);
    });

    // 3. Check ManagerBranch assignments
    console.log('\n3️⃣ Checking ManagerBranch Assignments:');
    const managerBranches = await prisma.managerBranch.findMany({
      include: {
        user: {
          include: {
            profile: true
          }
        },
        branch: true
      }
    });

    console.log(`   Found ${managerBranches.length} ManagerBranch records:`);
    
    if (managerBranches.length === 0) {
      console.log('   ❌ NO MANAGER BRANCH ASSIGNMENTS FOUND!');
      console.log('   This is the problem - managers have no branches assigned.');
    } else {
      managerBranches.forEach(mb => {
        console.log(`   - ${mb.user.email} → ${mb.branch.name}`);
      });
    }

    // 4. Group by manager
    console.log('\n4️⃣ Branches per Manager:');
    for (const manager of managers) {
      const assignments = await prisma.managerBranch.findMany({
        where: { userId: manager.id },
        include: { branch: true }
      });

      console.log(`\n   ${manager.email}:`);
      if (assignments.length === 0) {
        console.log('     ❌ No branches assigned!');
      } else {
        assignments.forEach(a => {
          console.log(`     ✅ ${a.branch.name} (${a.branch.branchCode})`);
        });
      }
    }

    // 5. Expected vs Actual
    console.log('\n5️⃣ Expected Configuration:');
    console.log('   Manager 1 (manager1@raho.id):');
    console.log('     ✅ Jakarta Pusat (PST)');
    console.log('     ✅ Bandung (BDG)');
    console.log('\n   Manager 2 (manager2@raho.id):');
    console.log('     ✅ Surabaya (SBY)');
    console.log('     ✅ Jakarta Pusat (PST)');

    console.log('\n' + '='.repeat(60));
    
    if (managerBranches.length === 4) {
      console.log('✅ SUCCESS: All 4 manager branch assignments found!');
    } else {
      console.log(`❌ PROBLEM: Expected 4 assignments, found ${managerBranches.length}`);
      console.log('\n💡 Solution: Run seeding again:');
      console.log('   cd apps/api');
      console.log('   npx prisma migrate reset --force');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testManagerBranches();
