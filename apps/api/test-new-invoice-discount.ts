import { prisma } from './src/lib/prisma';

/**
 * Test creating a new member with packages and verify invoice discount is calculated correctly
 */
async function testNewInvoiceDiscount() {
  console.log('🧪 Testing new invoice discount calculation...\n');

  // Create a test member
  const testMember = await prisma.member.create({
    data: {
      memberNo: 'MBR-TEST-9999',
      registrationBranchId: 'cmoiw5zzh0000xxyy0zzz0000', // PST branch
      userId: 'cmoiw5zzh0001xxyy0zzz0001', // Admin user
      nik: '1234567890123456',
      tempatLahir: 'Jakarta',
      dateOfBirth: new Date('1990-01-01'),
      jenisKelamin: 'L',
      address: 'Test Address',
      pekerjaan: 'Test Job',
      statusNikah: 'Belum Menikah',
      emergencyContact: '08123456789',
      sumberInfoRaho: 'Test',
      isActive: true,
    },
  });

  console.log(`✅ Created test member: ${testMember.memberNo}\n`);

  // Create packages with discount
  const basicPackage = await prisma.memberPackage.create({
    data: {
      memberId: testMember.id,
      branchId: testMember.registrationBranchId,
      packageCode: 'PKG-TEST-BSC-0001',
      packageType: 'BASIC',
      packagePricingId: 'cmoiw5zzh0002xxyy0zzz0002', // 7 sessions
      productCode: 'TNB-P7-PM',
      serviceType: 'PM',
      totalSessions: 7,
      usedSessions: 0,
      finalPrice: 11250000, // 12.5M - 1.25M discount
      discountPercent: 10,
      discountAmount: 1250000,
      status: 'PENDING_PAYMENT',
      assignedBy: 'cmoiw5zzh0001xxyy0zzz0001',
      purchaseGroupId: 'GRP-TEST-001',
    },
  });

  const boosterPackage = await prisma.memberPackage.create({
    data: {
      memberId: testMember.id,
      branchId: testMember.registrationBranchId,
      packageCode: 'PKG-TEST-BST-0001',
      packageType: 'BOOSTER',
      packagePricingId: 'cmoiw5zzh0003xxyy0zzz0003', // 1 session HHO
      productCode: 'BST-GT-P1-PM',
      serviceType: 'PM',
      boosterType: 'HHO',
      totalSessions: 1,
      usedSessions: 0,
      finalPrice: 900000, // 1M - 100K discount
      discountPercent: 10,
      discountAmount: 100000,
      status: 'PENDING_PAYMENT',
      assignedBy: 'cmoiw5zzh0001xxyy0zzz0001',
      purchaseGroupId: 'GRP-TEST-001',
    },
  });

  console.log(`✅ Created packages:`);
  console.log(`   Basic: Rp ${basicPackage.finalPrice.toLocaleString('id-ID')} (discount: Rp ${basicPackage.discountAmount?.toLocaleString('id-ID')})`);
  console.log(`   Booster: Rp ${boosterPackage.finalPrice.toLocaleString('id-ID')} (discount: Rp ${boosterPackage.discountAmount?.toLocaleString('id-ID')})`);
  console.log(`   Total discount: Rp ${(Number(basicPackage.discountAmount) + Number(boosterPackage.discountAmount)).toLocaleString('id-ID')}\n`);

  // Now generate invoice using the service
  const { InvoiceGenerationService } = await import('./src/modules/packages/services/invoice-generation.service');
  const invoiceService = new InvoiceGenerationService();

  await invoiceService.generateInvoiceForPackages(
    [basicPackage, boosterPackage],
    testMember,
    'cmoiw5zzh0001xxyy0zzz0001'
  );

  // Fetch the generated invoice
  const invoice = await prisma.invoice.findFirst({
    where: { memberId: testMember.id },
    include: { items: true },
  });

  if (!invoice) {
    console.log('❌ Invoice not created');
    return;
  }

  console.log(`✅ Invoice created: ${invoice.invoiceNumber}\n`);
  console.log(`📦 Invoice Items:`);
  invoice.items.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.description}`);
    console.log(`   Qty: ${item.quantity} × Rp ${item.pricePerUnit.toLocaleString('id-ID')}`);
    console.log(`   Subtotal: Rp ${item.subtotal.toLocaleString('id-ID')}`);
  });

  console.log(`\n💰 Invoice Totals:`);
  console.log(`Subtotal: Rp ${invoice.subtotal.toLocaleString('id-ID')}`);
  console.log(`Discount: ${invoice.discountPercent}% = Rp ${invoice.discountAmount.toLocaleString('id-ID')}`);
  console.log(`Total: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);

  // Verify discount calculation
  const expectedSubtotal = 12500000 + 1000000; // 13.5M
  const expectedDiscount = 1250000 + 100000; // 1.35M
  const expectedTotal = expectedSubtotal - expectedDiscount; // 12.15M

  console.log(`\n🔍 Verification:`);
  console.log(`Expected subtotal: Rp ${expectedSubtotal.toLocaleString('id-ID')}`);
  console.log(`Actual subtotal: Rp ${invoice.subtotal.toLocaleString('id-ID')}`);
  console.log(`Match: ${Number(invoice.subtotal) === expectedSubtotal ? '✅' : '❌'}`);

  console.log(`\nExpected discount: Rp ${expectedDiscount.toLocaleString('id-ID')}`);
  console.log(`Actual discount: Rp ${invoice.discountAmount.toLocaleString('id-ID')}`);
  console.log(`Match: ${Number(invoice.discountAmount) === expectedDiscount ? '✅' : '❌'}`);

  console.log(`\nExpected total: Rp ${expectedTotal.toLocaleString('id-ID')}`);
  console.log(`Actual total: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);
  console.log(`Match: ${Number(invoice.totalAmount) === expectedTotal ? '✅' : '❌'}`);

  // Cleanup
  console.log(`\n🧹 Cleaning up test data...`);
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await prisma.memberPackage.deleteMany({ where: { memberId: testMember.id } });
  await prisma.member.delete({ where: { id: testMember.id } });
  console.log(`✅ Cleanup complete`);

  await prisma.$disconnect();
}

testNewInvoiceDiscount().catch(console.error);
