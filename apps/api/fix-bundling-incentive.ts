import { prisma } from './src/lib/prisma';

async function fixBundlingIncentive() {
  console.log('🔍 Checking bundling incentives...\n');

  // Get all incentive records
  const incentiveRecords = await prisma.referralIncentiveRecord.findMany({
    include: {
      memberPackage: true,
      member: true,
      referralCode: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${incentiveRecords.length} incentive records\n`);

  // Group by purchaseGroupId
  const bundleGroups = new Map<string, any[]>();
  const standaloneRecords: any[] = [];

  for (const record of incentiveRecords) {
    if (record.memberPackage.purchaseGroupId) {
      const groupId = record.memberPackage.purchaseGroupId;
      if (!bundleGroups.has(groupId)) {
        bundleGroups.set(groupId, []);
      }
      bundleGroups.get(groupId)!.push(record);
    } else {
      standaloneRecords.push(record);
    }
  }

  console.log(`📦 Found ${bundleGroups.size} bundle groups`);
  console.log(`📄 Found ${standaloneRecords.length} standalone records\n`);

  let fixedCount = 0;
  let deletedCount = 0;

  // Process each bundle group
  for (const [groupId, records] of bundleGroups.entries()) {
    console.log(`\n🔧 Processing bundle: ${groupId}`);
    console.log(`   Records in this bundle: ${records.length}`);

    if (records.length === 0) continue;

    // Get all packages in this bundle
    const allPackagesInBundle = await prisma.memberPackage.findMany({
      where: { purchaseGroupId: groupId },
    });

    // Calculate total bundle value
    const totalBundleValue = allPackagesInBundle.reduce(
      (sum, pkg) => sum + Number(pkg.finalPrice),
      0
    );

    const basicCount = allPackagesInBundle.filter(p => p.packageType === 'BASIC').length;
    const boosterCount = allPackagesInBundle.filter(p => p.packageType === 'BOOSTER').length;

    console.log(`   Total packages in bundle: ${allPackagesInBundle.length} (${basicCount} BASIC + ${boosterCount} BOOSTER)`);
    console.log(`   Total bundle value: Rp ${totalBundleValue.toLocaleString('id-ID')}`);

    // Keep only the first record, delete the rest
    const [firstRecord, ...duplicateRecords] = records;

    // Get member incentive settings
    const member = firstRecord.member;
    const incentiveType = firstRecord.isFirstPackage
      ? member.firstIncentiveType
      : member.nextIncentiveType;
    const incentiveValue = firstRecord.isFirstPackage
      ? member.firstIncentiveValue
      : member.nextIncentiveValue;

    // Calculate correct incentive amount
    let correctIncentiveAmount: number;
    if (incentiveType === 'PERCENTAGE') {
      correctIncentiveAmount = Math.round((totalBundleValue * Number(incentiveValue)) / 100);
    } else {
      correctIncentiveAmount = Number(incentiveValue);
    }

    console.log(`   Incentive type: ${incentiveType} ${incentiveValue}`);
    console.log(`   Current incentive amount: Rp ${Number(firstRecord.incentiveAmount).toLocaleString('id-ID')}`);
    console.log(`   Correct incentive amount: Rp ${correctIncentiveAmount.toLocaleString('id-ID')}`);

    // Update the first record with correct values
    if (Number(firstRecord.incentiveAmount) !== correctIncentiveAmount || 
        Number(firstRecord.packageValue) !== totalBundleValue) {
      
      const oldAmount = Number(firstRecord.incentiveAmount);
      const amountDiff = correctIncentiveAmount - oldAmount;

      await prisma.referralIncentiveRecord.update({
        where: { id: firstRecord.id },
        data: {
          packageValue: totalBundleValue,
          packageName: `Bundle (${basicCount} BASIC + ${boosterCount} BOOSTER)`,
          incentiveAmount: correctIncentiveAmount,
          notes: `Auto-calculated incentive for ${firstRecord.isFirstPackage ? 'first' : 'subsequent'} bundle (total bundling) - FIXED`,
        },
      });

      // Update referral code statistics
      await prisma.referralCode.update({
        where: { id: firstRecord.referralCodeId },
        data: {
          totalIncentiveEarned: {
            increment: amountDiff,
          },
        },
      });

      console.log(`   ✅ Updated first record with correct values`);
      fixedCount++;
    } else {
      console.log(`   ✓ First record already correct`);
    }

    // Delete duplicate records
    if (duplicateRecords.length > 0) {
      console.log(`   🗑️  Deleting ${duplicateRecords.length} duplicate records...`);
      
      for (const dupRecord of duplicateRecords) {
        // Subtract from referral code statistics
        await prisma.referralCode.update({
          where: { id: dupRecord.referralCodeId },
          data: {
            totalIncentiveEarned: {
              decrement: Number(dupRecord.incentiveAmount),
            },
          },
        });

        // Delete the duplicate record
        await prisma.referralIncentiveRecord.delete({
          where: { id: dupRecord.id },
        });

        deletedCount++;
      }
      
      console.log(`   ✅ Deleted ${duplicateRecords.length} duplicate records`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Fixed records: ${fixedCount}`);
  console.log(`   Deleted duplicate records: ${deletedCount}`);
  console.log(`   Total bundle groups processed: ${bundleGroups.size}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

fixBundlingIncentive().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
