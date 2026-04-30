import { prisma } from './src/lib/prisma';

async function checkTarkIncentiveDetail() {
  const member = await prisma.member.findUnique({
    where: { memberNo: 'MBR-PST-0021' },
    include: {
      referralCode: true,
      memberPackages: {
        include: {
          incentiveRecords: {
            include: {
              referralCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!member) {
    console.log('Member not found');
    return;
  }

  console.log(`\n👤 Member: ${member.memberNo}`);
  console.log(`📧 Referral Code: ${member.referralCode?.code || 'None'}`);
  console.log(`\n💰 Member Incentive Settings:`);
  console.log(`   First Package: ${member.firstIncentiveType} - ${member.firstIncentiveValue}`);
  console.log(`   Next Packages: ${member.nextIncentiveType} - ${member.nextIncentiveValue}`);

  console.log(`\n📦 All Packages with Incentive Details:\n`);

  member.memberPackages.forEach((pkg, idx) => {
    const originalPrice = Number(pkg.finalPrice) + Number(pkg.discountAmount || 0);
    
    console.log(`${idx + 1}. ${pkg.packageCode} (${pkg.packageType})`);
    console.log(`   Status: ${pkg.status}`);
    console.log(`   Original Price: Rp ${originalPrice.toLocaleString('id-ID')}`);
    console.log(`   Discount: Rp ${(pkg.discountAmount || 0).toLocaleString('id-ID')}`);
    console.log(`   Final Price: Rp ${pkg.finalPrice.toLocaleString('id-ID')}`);
    console.log(`   Purchase Group: ${pkg.purchaseGroupId || 'none'}`);
    
    if (pkg.incentiveRecords.length > 0) {
      pkg.incentiveRecords.forEach((inc) => {
        console.log(`\n   💰 Incentive Record:`);
        console.log(`      Package Value: Rp ${inc.packageValue.toLocaleString('id-ID')}`);
        console.log(`      Is First Package: ${inc.isFirstPackage}`);
        console.log(`      Incentive Type: ${inc.incentiveType}`);
        console.log(`      Incentive Value: ${inc.incentiveValue}`);
        console.log(`      Incentive Amount: Rp ${inc.incentiveAmount.toLocaleString('id-ID')}`);
        console.log(`      Referral: ${inc.referralCode?.referrerName} (${inc.referralCode?.code})`);
        
        // Calculate what it should be
        if (inc.incentiveType === 'PERCENTAGE') {
          const expectedAmount = Math.round((Number(inc.packageValue) * Number(inc.incentiveValue)) / 100);
          console.log(`      Expected Amount: Rp ${expectedAmount.toLocaleString('id-ID')}`);
          if (expectedAmount !== Number(inc.incentiveAmount)) {
            console.log(`      ⚠️  MISMATCH! Difference: Rp ${(Number(inc.incentiveAmount) - expectedAmount).toLocaleString('id-ID')}`);
          }
        }
      });
    } else {
      console.log(`   ⚠️  No incentive records`);
    }
    console.log('');
  });

  await prisma.$disconnect();
}

checkTarkIncentiveDetail().catch(console.error);
