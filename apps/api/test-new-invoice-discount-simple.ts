import { prisma } from './src/lib/prisma';

/**
 * Simple test to verify invoice generation uses correct discount calculation
 */
async function testInvoiceDiscountLogic() {
  console.log('🧪 Testing invoice discount calculation logic...\n');

  // Get an existing member with packages
  const member = await prisma.member.findFirst({
    where: {
      memberNo: 'MBR-PST-0021',
    },
    include: {
      memberPackages: {
        where: {
          purchaseGroupId: 'GRP-1777522191761-K7FQDO7',
        },
      },
    },
  });

  if (!member || member.memberPackages.length === 0) {
    console.log('❌ Test member not found');
    return;
  }

  console.log(`📦 Member: ${member.memberNo}`);
  console.log(`Packages in group: ${member.memberPackages.length}\n`);

  // Calculate expected discount
  let totalOriginalPrice = 0;
  let totalDiscount = 0;

  member.memberPackages.forEach((pkg) => {
    const originalPrice = Number(pkg.finalPrice) + Number(pkg.discountAmount || 0);
    totalOriginalPrice += originalPrice;
    totalDiscount += Number(pkg.discountAmount || 0);
    
    console.log(`${pkg.packageCode} (${pkg.packageType})`);
    console.log(`  Original: Rp ${originalPrice.toLocaleString('id-ID')}`);
    console.log(`  Discount: Rp ${(pkg.discountAmount || 0).toLocaleString('id-ID')}`);
    console.log(`  Final: Rp ${pkg.finalPrice.toLocaleString('id-ID')}`);
  });

  console.log(`\n💰 Summary:`);
  console.log(`Total original price: Rp ${totalOriginalPrice.toLocaleString('id-ID')}`);
  console.log(`Total discount: Rp ${totalDiscount.toLocaleString('id-ID')}`);
  console.log(`Total final price: Rp ${(totalOriginalPrice - totalDiscount).toLocaleString('id-ID')}`);

  // Test the invoice generation service logic
  console.log(`\n🔍 Testing InvoiceGenerationService logic:`);
  
  // Simulate what the service does
  let subtotal = 0;
  for (const pkg of member.memberPackages) {
    const packageDiscountAmount = Number(pkg.discountAmount || 0);
    const originalPricePerUnit = Number(pkg.finalPrice) + packageDiscountAmount;
    subtotal += originalPricePerUnit;
  }

  // OLD LOGIC (WRONG): Only take discount from first package
  const oldDiscountAmount = Number(member.memberPackages[0].discountAmount || 0);
  const oldTotal = subtotal - oldDiscountAmount;

  console.log(`\n❌ OLD LOGIC (taking discount from first package only):`);
  console.log(`   Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`);
  console.log(`   Discount: Rp ${oldDiscountAmount.toLocaleString('id-ID')}`);
  console.log(`   Total: Rp ${oldTotal.toLocaleString('id-ID')}`);

  // NEW LOGIC (CORRECT): Sum all package discounts
  let newDiscountAmount = 0;
  for (const pkg of member.memberPackages) {
    newDiscountAmount += Number(pkg.discountAmount || 0);
  }
  const newTotal = subtotal - newDiscountAmount;

  console.log(`\n✅ NEW LOGIC (summing all package discounts):`);
  console.log(`   Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`);
  console.log(`   Discount: Rp ${newDiscountAmount.toLocaleString('id-ID')}`);
  console.log(`   Total: Rp ${newTotal.toLocaleString('id-ID')}`);

  console.log(`\n📊 Difference:`);
  console.log(`   Discount difference: Rp ${(newDiscountAmount - oldDiscountAmount).toLocaleString('id-ID')}`);
  console.log(`   Total difference: Rp ${(oldTotal - newTotal).toLocaleString('id-ID')}`);

  await prisma.$disconnect();
}

testInvoiceDiscountLogic().catch(console.error);
