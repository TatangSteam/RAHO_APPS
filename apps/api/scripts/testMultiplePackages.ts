import { prisma } from '../src/lib/prisma';

async function testMultiplePackages() {
  try {
    console.log('=== Testing Multiple Package Assignment ===\n');

    // Get a member
    const member = await prisma.member.findFirst({
      include: { registrationBranch: true }
    });

    if (!member) {
      console.log('No member found');
      return;
    }

    console.log(`Member: ${member.memberNo} (${member.id})`);
    console.log(`Branch: ${member.registrationBranch.branchCode}\n`);

    // Get a BASIC pricing
    const basicPricing = await prisma.packagePricing.findFirst({
      where: { packageType: 'BASIC' }
    });

    if (!basicPricing) {
      console.log('No BASIC pricing found');
      return;
    }

    console.log(`Pricing: ${basicPricing.name} (${basicPricing.id})`);
    console.log(`Price: Rp ${basicPricing.price.toLocaleString('id-ID')}\n`);

    // Simulate the assignPackage logic
    const data = {
      packages: [
        {
          pricingId: basicPricing.id,
          quantity: 3  // Request 3 packages
        }
      ],
      discountPercent: 0,
      discountAmount: 0
    };

    console.log('Request data:', JSON.stringify(data, null, 2));
    console.log('\nSimulating package creation loop...\n');

    // Simulate the loop
    const packageDetails = [
      {
        pricing: basicPricing,
        quantity: 3,
        pricePerSession: Number(basicPricing.price),
        totalPrice: Number(basicPricing.price) * 3
      }
    ];

    let packageIndex = 0;
    const totalPackages = packageDetails.reduce((sum, detail) => sum + detail.quantity, 0);
    console.log(`Total packages to create: ${totalPackages}\n`);

    for (const detail of packageDetails) {
      console.log(`Processing detail with quantity: ${detail.quantity}`);
      for (let i = 0; i < detail.quantity; i++) {
        packageIndex++;
        console.log(`  ✓ Creating package ${i + 1} of ${detail.quantity} (packageIndex: ${packageIndex})`);
      }
    }

    console.log(`\nTotal packages created in loop: ${packageIndex}`);
    console.log(`Expected: ${totalPackages}`);
    console.log(`Match: ${packageIndex === totalPackages ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMultiplePackages();
