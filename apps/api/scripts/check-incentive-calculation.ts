import { prisma } from '../src/lib/prisma';

async function checkIncentiveCalculation() {
  console.log('🔍 Checking incentive calculations...\n');

  // Get all incentive records with their related data
  const records = await prisma.referralIncentiveRecord.findMany({
    include: {
      memberPackage: {
        include: {
          member: {
            select: {
              memberNo: true,
              firstIncentiveType: true,
              firstIncentiveValue: true,
              nextIncentiveType: true,
              nextIncentiveValue: true,
            },
          },
        },
      },
      referralCode: {
        select: {
          code: true,
          referrerName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log(`Found ${records.length} recent incentive records\n`);

  for (const record of records) {
    console.log('━'.repeat(80));
    console.log(`📋 Incentive Record ID: ${record.id}`);
    console.log(`👤 Member: ${record.memberPackage.member.memberNo}`);
    console.log(`🎁 Referral Code: ${record.referralCode.code} (${record.referralCode.referrerName})`);
    console.log(`📦 Package: ${record.packageName}`);
    console.log(`💰 Package Value: Rp ${Number(record.packageValue).toLocaleString('id-ID')}`);
    console.log(`🎯 Is First Package: ${record.isFirstPackage ? 'Yes' : 'No'}`);
    console.log(`📊 Incentive Type: ${record.incentiveType}`);
    console.log(`📈 Incentive Value: ${record.incentiveValue}${record.incentiveType === 'PERCENTAGE' ? '%' : ''}`);
    console.log(`💵 Incentive Amount: Rp ${Number(record.incentiveAmount).toLocaleString('id-ID')}`);
    
    // Verify calculation
    let expectedAmount: number;
    if (record.incentiveType === 'PERCENTAGE') {
      expectedAmount = Math.round((Number(record.packageValue) * Number(record.incentiveValue)) / 100);
    } else {
      expectedAmount = Number(record.incentiveValue);
    }
    
    const isCorrect = expectedAmount === Number(record.incentiveAmount);
    console.log(`✅ Calculation Check: ${isCorrect ? 'CORRECT' : '❌ INCORRECT'}`);
    
    if (!isCorrect) {
      console.log(`   Expected: Rp ${expectedAmount.toLocaleString('id-ID')}`);
      console.log(`   Actual: Rp ${Number(record.incentiveAmount).toLocaleString('id-ID')}`);
      console.log(`   Difference: Rp ${Math.abs(expectedAmount - Number(record.incentiveAmount)).toLocaleString('id-ID')}`);
    }
    
    // Check if part of bundle
    if (record.memberPackage.purchaseGroupId) {
      console.log(`🎁 Bundle Group ID: ${record.memberPackage.purchaseGroupId}`);
      
      // Get all packages in this bundle
      const bundlePackages = await prisma.memberPackage.findMany({
        where: {
          purchaseGroupId: record.memberPackage.purchaseGroupId,
        },
        select: {
          packageCode: true,
          packageType: true,
          finalPrice: true,
          discountAmount: true,
          discountPercent: true,
        },
      });
      
      console.log(`   Bundle contains ${bundlePackages.length} packages:`);
      let totalFinalPrice = 0;
      bundlePackages.forEach((pkg, idx) => {
        totalFinalPrice += Number(pkg.finalPrice);
        console.log(
          `   ${idx + 1}. ${pkg.packageCode} (${pkg.packageType}): ` +
            `Rp ${Number(pkg.finalPrice).toLocaleString('id-ID')} ` +
            `(discount: ${pkg.discountPercent}% + Rp ${Number(pkg.discountAmount || 0).toLocaleString('id-ID')})`
        );
      });
      
      console.log(`   Total Final Price (sum): Rp ${totalFinalPrice.toLocaleString('id-ID')}`);
      console.log(`   Package Value (stored): Rp ${Number(record.packageValue).toLocaleString('id-ID')}`);
      
      if (totalFinalPrice !== Number(record.packageValue)) {
        console.log(`   ⚠️ MISMATCH! Difference: Rp ${Math.abs(totalFinalPrice - Number(record.packageValue)).toLocaleString('id-ID')}`);
      }
    }
    
    console.log(`📅 Created: ${record.createdAt.toLocaleString('id-ID')}`);
    console.log('');
  }

  console.log('━'.repeat(80));
  console.log('✅ Check complete');
}

checkIncentiveCalculation()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
