import { prisma } from '../src/lib/prisma';
import { PackagesService } from '../src/modules/packages/packages.service';

async function testPackageAssignmentFix() {
  const packagesService = new PackagesService();
  
  try {
    console.log('=== Testing Multiple Package Assignment Fix ===\n');

    // Get a member from Surabaya branch
    const member = await prisma.member.findFirst({
      where: {
        registrationBranch: {
          branchCode: 'SBY'
        }
      },
      include: { 
        registrationBranch: true,
        branchAccesses: true,
        memberPackages: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!member) {
      console.log('❌ No member found in Surabaya branch');
      return;
    }

    console.log(`✅ Member: ${member.memberNo} (${member.id})`);
    console.log(`   Branch: ${member.registrationBranch.branchCode}`);
    console.log(`   Recent packages: ${member.memberPackages.length}\n`);

    // Get BASIC and BOOSTER pricings
    const basicPricing = await prisma.packagePricing.findFirst({
      where: { 
        packageType: 'BASIC',
        branchId: member.registrationBranchId
      }
    });

    const boosterPricing = await prisma.packagePricing.findFirst({
      where: { 
        packageType: 'BOOSTER',
        branchId: member.registrationBranchId
      }
    });

    if (!basicPricing || !boosterPricing) {
      console.log('❌ Missing pricing data');
      console.log(`   BASIC: ${basicPricing ? '✅' : '❌'}`);
      console.log(`   BOOSTER: ${boosterPricing ? '✅' : '❌'}`);
      return;
    }

    console.log(`✅ Pricing found:`);
    console.log(`   BASIC: ${basicPricing.name} - Rp ${basicPricing.price.toLocaleString('id-ID')}`);
    console.log(`   BOOSTER: ${boosterPricing.name} - Rp ${boosterPricing.price.toLocaleString('id-ID')}\n`);

    // Test 1: Assign 3 BASIC packages
    console.log('📋 TEST 1: Assigning 3 BASIC packages...\n');
    
    const assignData1 = {
      packages: [
        {
          pricingId: basicPricing.id,
          quantity: 3
        }
      ],
      discountPercent: 0,
      discountAmount: 0,
      notes: 'Test: 3 BASIC packages'
    };

    try {
      const result1 = await packagesService.assignPackage(
        member.id,
        assignData1,
        member.registrationBranchId,
        'test-user-id'
      );

      console.log(`✅ TEST 1 PASSED`);
      console.log(`   Packages created: ${result1.totalPackages}`);
      console.log(`   Expected: 3`);
      console.log(`   Match: ${result1.totalPackages === 3 ? '✅' : '❌'}`);
      
      if (result1.packages) {
        console.log(`   Package codes:`);
        result1.packages.forEach((pkg, idx) => {
          console.log(`     ${idx + 1}. ${pkg.packageCode}`);
        });
      }
    } catch (error: any) {
      console.log(`❌ TEST 1 FAILED`);
      console.log(`   Error: ${error.message || error.code}`);
      if (error.meta) {
        console.log(`   Details: ${JSON.stringify(error.meta)}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Assign 2 BOOSTER packages with service type
    console.log('📋 TEST 2: Assigning 2 BOOSTER packages (HC service type)...\n');
    
    const assignData2 = {
      packages: [
        {
          pricingId: boosterPricing.id,
          quantity: 2,
          boosterType: 'NO',
          serviceType: 'HC'
        }
      ],
      discountPercent: 0,
      discountAmount: 0,
      notes: 'Test: 2 BOOSTER packages'
    };

    try {
      const result2 = await packagesService.assignPackage(
        member.id,
        assignData2,
        member.registrationBranchId,
        'test-user-id'
      );

      console.log(`✅ TEST 2 PASSED`);
      console.log(`   Packages created: ${result2.totalPackages}`);
      console.log(`   Expected: 2`);
      console.log(`   Match: ${result2.totalPackages === 2 ? '✅' : '❌'}`);
      
      if (result2.packages) {
        console.log(`   Package codes:`);
        result2.packages.forEach((pkg, idx) => {
          console.log(`     ${idx + 1}. ${pkg.packageCode}`);
        });
      }
    } catch (error: any) {
      console.log(`❌ TEST 2 FAILED`);
      console.log(`   Error: ${error.message || error.code}`);
      if (error.meta) {
        console.log(`   Details: ${JSON.stringify(error.meta)}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Assign mixed packages (3 BASIC + 2 BOOSTER)
    console.log('📋 TEST 3: Assigning mixed packages (3 BASIC + 2 BOOSTER)...\n');
    
    const assignData3 = {
      packages: [
        {
          pricingId: basicPricing.id,
          quantity: 3
        },
        {
          pricingId: boosterPricing.id,
          quantity: 2,
          boosterType: 'NO',
          serviceType: 'HC'
        }
      ],
      discountPercent: 0,
      discountAmount: 0,
      notes: 'Test: Mixed packages'
    };

    try {
      const result3 = await packagesService.assignPackage(
        member.id,
        assignData3,
        member.registrationBranchId,
        'test-user-id'
      );

      console.log(`✅ TEST 3 PASSED`);
      console.log(`   Packages created: ${result3.totalPackages}`);
      console.log(`   Expected: 5`);
      console.log(`   Match: ${result3.totalPackages === 5 ? '✅' : '❌'}`);
      
      if (result3.packages) {
        console.log(`   Package codes:`);
        result3.packages.forEach((pkg, idx) => {
          console.log(`     ${idx + 1}. ${pkg.packageCode} (${pkg.packageType})`);
        });
      }
      
      if (result3.purchaseGroupId) {
        console.log(`   Bundle Group ID: ${result3.purchaseGroupId}`);
      }
    } catch (error: any) {
      console.log(`❌ TEST 3 FAILED`);
      console.log(`   Error: ${error.message || error.code}`);
      if (error.meta) {
        console.log(`   Details: ${JSON.stringify(error.meta)}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Verify all packages in database
    console.log('📊 VERIFICATION: Checking all packages for this member...\n');
    
    const allPackages = await prisma.memberPackage.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    console.log(`Total packages in database: ${allPackages.length}`);
    console.log(`\nRecent packages:`);
    allPackages.slice(0, 10).forEach((pkg, idx) => {
      console.log(`  ${idx + 1}. ${pkg.packageCode} - ${pkg.packageType} - Rp ${pkg.finalPrice.toLocaleString('id-ID')}`);
    });

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPackageAssignmentFix();
