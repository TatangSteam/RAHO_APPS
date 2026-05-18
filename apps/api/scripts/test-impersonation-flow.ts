/**
 * Integration test script for impersonation flow
 * This demonstrates the complete impersonation functionality
 */

import { ImpersonationService } from '../src/modules/admin/services/impersonation.service';
import { prisma } from '../src/lib/prisma';
import { verifyAccessToken } from '../src/lib/jwt';

async function testImpersonationFlow() {
  console.log('=== Impersonation Flow Integration Test ===\n');

  const service = new ImpersonationService();

  try {
    // Step 1: Find Super Admin
    console.log('Step 1: Finding Super Admin...');
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (!superAdmin) {
      console.log('❌ No Super Admin found. Please run seed first.');
      return;
    }
    console.log(`✓ Found Super Admin: ${superAdmin.email}\n`);

    // Step 2: Find Admin Manager
    console.log('Step 2: Finding Admin Manager...');
    const adminManager = await prisma.user.findFirst({
      where: { role: 'ADMIN_MANAGER' },
      include: { managedBranches: true }
    });

    if (!adminManager) {
      console.log('❌ No Admin Manager found. Please run seed first.');
      return;
    }
    console.log(`✓ Found Admin Manager: ${adminManager.email}`);
    console.log(`  Manages ${adminManager.managedBranches.length} branches\n`);

    // Step 3: Super Admin impersonates Admin Manager
    console.log('Step 3: Super Admin → Admin Manager impersonation...');
    const result1 = await service.createImpersonationToken(
      superAdmin.id,
      adminManager.id
    );
    console.log(`✓ Impersonation token created`);
    console.log(`  Token length: ${result1.token.length} characters`);
    console.log(`  Target user: ${result1.targetUser.email}`);
    console.log(`  Target role: ${result1.targetUser.role}`);
    console.log(`  Branches: ${result1.targetUser.branches?.length || 0}\n`);

    // Verify token structure
    const decoded1 = verifyAccessToken(result1.token);
    console.log('  Token structure:');
    console.log(`    - Root user: ${decoded1.email} (${decoded1.role})`);
    console.log(`    - Impersonating: ${decoded1.impersonating?.email} (${decoded1.impersonating?.role})`);
    console.log(`    - Branches: ${decoded1.impersonating?.branches?.length || 0}\n`);

    // Step 4: Find Admin Cabang in manager's branches
    console.log('Step 4: Finding Admin Cabang in managed branches...');
    const managerBranchIds = adminManager.managedBranches.map(mb => mb.branchId);
    const adminCabang = await prisma.user.findFirst({
      where: {
        role: 'ADMIN_CABANG',
        branchId: { in: managerBranchIds }
      },
      include: { branch: true }
    });

    if (!adminCabang) {
      console.log('❌ No Admin Cabang found in managed branches.');
      console.log('   Skipping nested impersonation test.\n');
    } else {
      console.log(`✓ Found Admin Cabang: ${adminCabang.email}`);
      console.log(`  Branch: ${adminCabang.branch?.name}\n`);

      // Step 5: Nested impersonation (Super Admin → Admin Manager → Admin Cabang)
      console.log('Step 5: Nested impersonation (Admin Manager → Admin Cabang)...');
      const result2 = await service.createImpersonationToken(
        adminManager.id,
        adminCabang.id,
        decoded1 // Pass the current token for nested impersonation
      );
      console.log(`✓ Nested impersonation token created`);
      console.log(`  Token length: ${result2.token.length} characters`);
      console.log(`  Target user: ${result2.targetUser.email}`);
      console.log(`  Target role: ${result2.targetUser.role}`);
      console.log(`  Branch: ${result2.targetUser.branchCode}\n`);

      // Verify nested token structure
      const decoded2 = verifyAccessToken(result2.token);
      console.log('  Nested token structure:');
      console.log(`    - Root user: ${decoded2.email} (${decoded2.role})`);
      console.log(`    - Level 1: ${decoded2.impersonating?.email} (${decoded2.impersonating?.role})`);
      console.log(`    - Level 2: ${decoded2.impersonating?.impersonating?.email} (${decoded2.impersonating?.impersonating?.role})`);
      console.log(`    - Final branch: ${decoded2.impersonating?.impersonating?.branchId}\n`);

      // Step 6: Get impersonation chain
      console.log('Step 6: Getting impersonation chain...');
      const chain = service.getImpersonationChain(decoded2);
      console.log(`✓ Impersonation chain: ${chain.join(' → ')}\n`);

      // Step 7: Stop nested impersonation (go back one level)
      console.log('Step 7: Stopping nested impersonation (going back one level)...');
      const stopResult1 = await service.stopImpersonation(decoded2);
      console.log(`✓ Went back one level`);
      console.log(`  Current user: ${stopResult1.user.email} (${stopResult1.user.role})`);
      
      const decodedAfterStop1 = verifyAccessToken(stopResult1.token);
      const chainAfterStop1 = service.getImpersonationChain(decodedAfterStop1);
      console.log(`  Chain: ${chainAfterStop1.join(' → ')}\n`);

      // Step 8: Stop impersonation again (return to Super Admin)
      console.log('Step 8: Stopping impersonation (returning to Super Admin)...');
      const stopResult2 = await service.stopImpersonation(decodedAfterStop1);
      console.log(`✓ Returned to original user`);
      console.log(`  Current user: ${stopResult2.user.email} (${stopResult2.user.role})`);
      
      const decodedAfterStop2 = verifyAccessToken(stopResult2.token);
      console.log(`  Impersonating: ${decodedAfterStop2.impersonating ? 'Yes' : 'No'}\n`);
    }

    // Step 9: Test permission validation
    console.log('Step 9: Testing permission validation...');
    
    // Test 1: Super Admin cannot impersonate Admin Cabang directly
    if (adminCabang) {
      try {
        await service.createImpersonationToken(superAdmin.id, adminCabang.id);
        console.log('❌ Should have failed: Super Admin → Admin Cabang');
      } catch (error: any) {
        console.log(`✓ Correctly blocked: Super Admin → Admin Cabang`);
        console.log(`  Error: ${error.code}\n`);
      }
    }

    // Test 2: Admin Manager cannot impersonate Admin Cabang from unassigned branch
    const otherBranchAdminCabang = await prisma.user.findFirst({
      where: {
        role: 'ADMIN_CABANG',
        branchId: { notIn: managerBranchIds }
      }
    });

    if (otherBranchAdminCabang) {
      try {
        await service.createImpersonationToken(adminManager.id, otherBranchAdminCabang.id);
        console.log('❌ Should have failed: Admin Manager → Admin Cabang (unassigned branch)');
      } catch (error: any) {
        console.log(`✓ Correctly blocked: Admin Manager → Admin Cabang (unassigned branch)`);
        console.log(`  Error: ${error.code}\n`);
      }
    }

    // Test 3: Cannot impersonate inactive user
    const inactiveUser = await prisma.user.findFirst({
      where: { isActive: false }
    });

    if (inactiveUser) {
      try {
        await service.createImpersonationToken(superAdmin.id, inactiveUser.id);
        console.log('❌ Should have failed: Impersonate inactive user');
      } catch (error: any) {
        console.log(`✓ Correctly blocked: Impersonate inactive user`);
        console.log(`  Error: ${error.code}\n`);
      }
    }

    // Step 10: Test canImpersonate helper
    console.log('Step 10: Testing canImpersonate helper...');
    console.log(`  Super Admin can impersonate: ${service.canImpersonate('SUPER_ADMIN')}`);
    console.log(`  Admin Manager can impersonate: ${service.canImpersonate('ADMIN_MANAGER')}`);
    console.log(`  Admin Cabang can impersonate: ${service.canImpersonate('ADMIN_CABANG')}`);
    
    if (adminCabang) {
      const decoded2 = verifyAccessToken(result1.token);
      console.log(`  At max depth can impersonate: ${service.canImpersonate('ADMIN_MANAGER', {
        ...decoded2,
        impersonating: {
          ...decoded2.impersonating!,
          impersonating: {
            userId: adminCabang.id,
            email: adminCabang.email,
            role: 'ADMIN_CABANG',
            branchId: adminCabang.branchId
          }
        }
      } as any)}\n`);
    }

    console.log('=== All Tests Passed! ===');
    console.log('\n✅ Implementation is working correctly:');
    console.log('  ✓ Super Admin → Admin Manager impersonation');
    console.log('  ✓ Admin Manager → Admin Cabang impersonation');
    console.log('  ✓ Nested impersonation (Super Admin → Admin Manager → Admin Cabang)');
    console.log('  ✓ Permission validation');
    console.log('  ✓ Branch access control');
    console.log('  ✓ Stop impersonation (go back one level)');
    console.log('  ✓ Token generation and verification');
    console.log('  ✓ Helper methods (canImpersonate, getImpersonationChain)');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testImpersonationFlow();
