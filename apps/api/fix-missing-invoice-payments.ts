import { prisma } from './src/lib/prisma';

/**
 * Fix invoices that don't have InvoicePayment records but their packages have payment proof
 */
async function fixMissingInvoicePayments() {
  console.log('🔧 Finding invoices without payment records...\n');

  // Find all PAID invoices without payment records
  const invoices = await prisma.invoice.findMany({
    where: {
      status: 'PAID',
    },
    include: {
      payments: true,
      items: {
        where: {
          itemType: 'PACKAGE',
        },
      },
    },
  });

  console.log(`📄 Found ${invoices.length} PAID invoices\n`);

  let fixed = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    // Skip if invoice already has payment records
    if (invoice.payments.length > 0) {
      skipped++;
      continue;
    }

    // Get package IDs from invoice items
    const packageIds = invoice.items
      .filter(item => item.itemId)
      .map(item => item.itemId);

    if (packageIds.length === 0) {
      console.log(`⚠️  Invoice ${invoice.invoiceNumber} has no package items`);
      skipped++;
      continue;
    }

    // Find packages with payment proof
    const packages = await prisma.memberPackage.findMany({
      where: {
        id: { in: packageIds },
        paymentProofUrl: { not: null },
      },
    });

    if (packages.length === 0) {
      console.log(`⚠️  Invoice ${invoice.invoiceNumber} - no packages with payment proof`);
      skipped++;
      continue;
    }

    // Use payment proof from first package (all packages in same group should have same proof)
    const firstPackage = packages[0];

    // Create invoice payment record
    await prisma.invoicePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.totalAmount,
        paymentMethod: 'TRANSFER',
        proofFileUrl: firstPackage.paymentProofUrl,
        proofFileName: firstPackage.paymentProofFileName,
        proofFileSize: firstPackage.paymentProofFileSize,
        proofMimeType: firstPackage.paymentProofMimeType,
        receivedBy: firstPackage.verifiedBy || firstPackage.assignedBy,
        receivedAt: firstPackage.paidAt || firstPackage.verifiedAt || new Date(),
      },
    });

    console.log(`✅ Fixed invoice ${invoice.invoiceNumber}`);
    console.log(`   Amount: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);
    console.log(`   Proof: ${firstPackage.paymentProofFileName}`);
    console.log(`   Packages: ${packages.length}/${packageIds.length} with proof\n`);
    fixed++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${invoices.length}`);

  await prisma.$disconnect();
}

fixMissingInvoicePayments().catch(console.error);
