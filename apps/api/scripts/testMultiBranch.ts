import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to test multi-branch functionality
 * - Shows inventory levels per branch
 * - Shows users per branch
 * - Shows members per branch
 */

async function testMultiBranch() {
  console.log('🏢 Multi-Branch Test Report\n');

  try {
    // Get all branches
    const branches = await prisma.branch.findMany({
      orderBy: { branchCode: 'asc' }
    });

    console.log(`📍 Found ${branches.length} branches:\n`);

    for (const branch of branches) {
      console.log(`🏢 ${branch.name} (${branch.branchCode})`);
      console.log(`   📍 ${branch.address}`);
      console.log(`   📞 ${branch.phone}`);
      console.log(`   ⏰ ${branch.operatingHours}`);

      // Get users for this branch
      const users = await prisma.user.findMany({
        where: { branchId: branch.id },
        include: { profile: true },
        orderBy: { role: 'asc' }
      });

      console.log(`   👥 Staff (${users.length}):`);
      users.forEach(user => {
        console.log(`      - ${user.profile?.fullName} (${user.role}) - ${user.email}`);
      });

      // Get members for this branch
      const members = await prisma.member.findMany({
        where: { registrationBranchId: branch.id },
        take: 3 // Show first 3 members
      });

      console.log(`   👤 Members (${members.length} total, showing first 3):`);
      members.forEach(member => {
        console.log(`      - ${member.memberNo}`);
      });

      // Get inventory items for this branch (HHO and NO2 only)
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          branchId: branch.id,
          masterProduct: {
            name: {
              in: ['Infus Gassotraus HHO (5ml)', 'Infus NO2 (5ml)']
            }
          }
        },
        include: { masterProduct: true },
        orderBy: { masterProduct: { name: 'asc' } }
      });

      console.log(`   📦 Booster Inventory:`);
      inventoryItems.forEach(item => {
        const stockStatus = Number(item.stock) < Number(item.minThreshold) ? '🔴 LOW' : '✅ OK';
        console.log(`      - ${item.masterProduct.name}: ${item.stock} ${item.masterProduct.unit} ${stockStatus}`);
      });

      console.log('');
    }

    // Test stock availability for each branch
    console.log('🧪 Testing Booster Stock Availability API Response:\n');

    for (const branch of branches) {
      console.log(`🏢 ${branch.name}:`);

      const hhoItem = await prisma.inventoryItem.findFirst({
        where: {
          branchId: branch.id,
          masterProduct: { name: 'Infus Gassotraus HHO (5ml)' }
        },
        include: { masterProduct: true }
      });

      const no2Item = await prisma.inventoryItem.findFirst({
        where: {
          branchId: branch.id,
          masterProduct: { name: 'Infus NO2 (5ml)' }
        },
        include: { masterProduct: true }
      });

      const stockAvailability = {
        HHO: {
          available: hhoItem ? Number(hhoItem.stock) >= 1 : false,
          stock: hhoItem ? Number(hhoItem.stock) : 0,
          minThreshold: hhoItem ? Number(hhoItem.minThreshold) : 0,
          isLowStock: hhoItem ? Number(hhoItem.stock) < Number(hhoItem.minThreshold) : false,
          unit: hhoItem?.masterProduct.unit || 'ml',
        },
        NO2: {
          available: no2Item ? Number(no2Item.stock) >= 1 : false,
          stock: no2Item ? Number(no2Item.stock) : 0,
          minThreshold: no2Item ? Number(no2Item.minThreshold) : 0,
          isLowStock: no2Item ? Number(no2Item.stock) < Number(no2Item.minThreshold) : false,
          unit: no2Item?.masterProduct.unit || 'ml',
        },
      };

      console.log('   API Response:');
      console.log('   ', JSON.stringify(stockAvailability, null, 4));
      console.log('');
    }

    console.log('✅ Multi-branch test completed successfully!');
    console.log('\n💡 Testing Instructions:');
    console.log('1. Login with different branch users to test isolation');
    console.log('2. Try creating sessions and selecting boosters');
    console.log('3. Verify stock deduction only affects the correct branch');
    console.log('4. Check that users can only see their branch inventory');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMultiBranch();