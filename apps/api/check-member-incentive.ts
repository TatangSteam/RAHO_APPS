import { prisma } from './src/lib/prisma';

async function checkMemberIncentive() {
  // Get member from screenshot - looks like member with package "Terapi Nano Bubble 7X Premiere"
  const members = await prisma.member.findMany({
    where: {
      memberNo: { contains: 'PST' },
    },
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
        take: 5,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  console.log(`\n📊 Found ${members.length} members\n`);

  for (const member of members) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👤 Member: ${member.memberNo}`);
    console.log(`📧 Referral Code: ${member.referralCode?.code || 'None'}`);
    console.log(`📦 Packages: ${member.memberPackages.length}`);

    member.memberPackages.forEach((pkg, idx) => {
      console.log(`\n  ${idx + 1}. ${pkg.packageCode} (${pkg.packageType})`);
      console.log(`     Status: ${pkg.status}`);
      console.log(`     Price: Rp ${pkg.finalPrice.toLocaleString('id-ID')}`);
      console.log(`     Incentive Records: ${pkg.incentiveRecords.length}`);
      
      if (pkg.incentiveRecords.length > 0) {
        pkg.incentiveRecords.forEach((inc, incIdx) => {
          console.log(`\n     💰 Incentive ${incIdx + 1}:`);
          console.log(`        Amount: Rp ${inc.incentiveAmount.toLocaleString('id-ID')}`);
          console.log(`        Type: ${inc.incentiveType}`);
          console.log(`        Referral: ${inc.referralCode?.referrerName} (${inc.referralCode?.code})`);
        });
      } else {
        console.log(`     ⚠️  No incentive records found`);
      }
    });
  }

  await prisma.$disconnect();
}

checkMemberIncentive().catch(console.error);
