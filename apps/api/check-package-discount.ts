import { prisma } from './src/lib/prisma';

async function checkPackageDiscount() {
  const memberNo = 'MBR-PST-0021';
  
  const member = await prisma.member.findUnique({
    where: { memberNo },
    include: {
      memberPackages: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      memberAddOns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!member) {
    console.log('Member not found');
    return;
  }

  console.log('\n👤 Member:', member.memberNo);
  console.log('\n📦 Packages:');
  
  let totalPackagePrice = 0;
  let totalDiscount = 0;
  
  member.memberPackages.forEach((pkg, idx) => {
    const originalPrice = Number(pkg.finalPrice) + Number(pkg.discountAmount || 0);
    totalPackagePrice += originalPrice;
    totalDiscount += Number(pkg.discountAmount || 0);
    
    console.log(`${idx + 1}. ${pkg.packageCode} (${pkg.packageType})`);
    console.log(`   Original Price: Rp ${originalPrice.toLocaleString('id-ID')}`);
    console.log(`   Discount: Rp ${(pkg.discountAmount || 0).toLocaleString('id-ID')} (${pkg.discountPercent}%)`);
    console.log(`   Final Price: Rp ${pkg.finalPrice.toLocaleString('id-ID')}`);
    console.log(`   Purchase Group: ${pkg.purchaseGroupId || 'none'}`);
  });

  console.log('\n🎁 Add-Ons:');
  let totalAddOnPrice = 0;
  member.memberAddOns.forEach((addon, idx) => {
    const addonTotal = Number(addon.pricePerUnit) * addon.quantity;
    totalAddOnPrice += addonTotal;
    console.log(`${idx + 1}. ${addon.addOnCode} (${addon.addOnType})`);
    console.log(`   Price: ${addon.quantity} × Rp ${addon.pricePerUnit.toLocaleString('id-ID')} = Rp ${addonTotal.toLocaleString('id-ID')}`);
    console.log(`   Package: ${addon.packageId || 'none'}`);
  });

  console.log('\n💰 Summary:');
  console.log(`Total Package Price (before discount): Rp ${totalPackagePrice.toLocaleString('id-ID')}`);
  console.log(`Total Add-On Price: Rp ${totalAddOnPrice.toLocaleString('id-ID')}`);
  console.log(`Grand Total (before discount): Rp ${(totalPackagePrice + totalAddOnPrice).toLocaleString('id-ID')}`);
  console.log(`Total Discount from packages: Rp ${totalDiscount.toLocaleString('id-ID')}`);
  console.log(`Grand Total (after discount): Rp ${(totalPackagePrice + totalAddOnPrice - totalDiscount).toLocaleString('id-ID')}`);

  await prisma.$disconnect();
}

checkPackageDiscount().catch(console.error);
