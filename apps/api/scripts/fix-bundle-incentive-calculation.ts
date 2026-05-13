import { prisma } from '../src/lib/prisma';

async function fixBundleIncentiveCalculation() {
  console.log('🔧 Fixing bundle incentive calculations...\n');

  // Get all incentive records for bundles
  const records = await prisma.referralIncentiveRecord.findMany({
    where: {
      memberPackage: {
        purchaseGroupId: {
          not: null,
        },
      },
    },
    include: {
      memberPackage: {
        select: {
          id: true,
          purchaseGroupId: true,
        },
      },
      member: {
        select: {
          memberNo: true,
        },
      },
    },
  });

  console.log(`Found ${records.length} bundle incentive records to check\n`);

  let fixedCount = 0;
  let alreadyCorrectCount = 0;

  for (const record of records) {
    console.log('━'.repeat(80));
    console.log(`📋 Checking Record ID: ${record.id}`);
    console.log(`👤 Member: ${record.member.memberNo}`);
    console.log(`🎁 Bundle Group: ${record.memberPackage.purchaseGroupId}`);

    // Get all packages in this bundle
    const bundlePackages = await prisma.memberPackage.findMany({
      where: {
        purchaseGroupId: record.memberPackage.purchaseGroupId!,
      },
      select: {
        packageCode: true,
        packageType: true,
        finalPrice: true,
      },
    });

    const correctPackageValue = bundlePackages.reduce(
      (sum, pkg) => sum + Number(pkg.finalPrice),
      0
    );

    const storedPackageValue = Number(record.packageValue);

    console.log(`   Stored Package Value: Rp ${storedPackageValue.toLocaleString('id-ID')}`);
    console.log(`   Correct Package Value: Rp ${correctPackageValue.toLocaleString('id-ID')}`);

    if (storedPackageValue !== correctPackageValue) {
      console.log(`   ⚠️ MISMATCH! Fixing...`);

      // Recalculate incentive amount
      let newIncentiveAmount: number;
      if (record.incentiveType === 'PERCENTAGE') {
        newIncentiveAmount = Math.round(
          (correctPackageValue * Number(record.incentiveValue)) / 100
        );
      } else {
        newIncentiveAmount = Number(record.incentiveValue);
      }

      const oldIncentiveAmount = Number(record.incentiveAmount);
      const incentiveDifference = newIncentiveAmount - oldIncentiveAmount;

      console.log(`   Old Incentive Amount: Rp ${oldIncentiveAmount.toLocaleString('id-ID')}`);
      console.log(`   New Incentive Amount: Rp ${newIncentiveAmount.toLocaleString('id-ID')}`);
      console.log(`   Difference: Rp ${Math.abs(incentiveDifference).toLocaleString('id-ID')}`);

      // Update the record
      await prisma.referralIncentiveRecord.update({
        where: { id: record.id },
        data: {
          packageValue: correctPackageValue,
          incentiveAmount: newIncentiveAmount,
          notes: record.notes + ' [Fixed: Bundle total recalculated]',
        },
      });

      // Update referral code statistics
      await prisma.referralCode.update({
        where: { id: record.referralCodeId },
        data: {
          totalIncentiveEarned: {
            increment: incentiveDifference,
          },
        },
      });

      console.log(`   ✅ Fixed!`);
      fixedCount++;
    } else {
      console.log(`   ✅ Already correct`);
      alreadyCorrectCount++;
    }

    console.log('');
  }

  console.log('━'.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total records checked: ${records.length}`);
  console.log(`   Fixed: ${fixedCount}`);
  console.log(`   Already correct: ${alreadyCorrectCount}`);
  console.log('\n✅ Fix complete');
}

fixBundleIncentiveCalculation()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
