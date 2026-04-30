import { prisma } from './src/lib/prisma';

/**
 * Fix invoice discounts to be calculated from total subtotal instead of just basic package
 */
async function fixInvoiceDiscounts() {
  console.log('🔍 Finding invoices with incorrect discount...\n');

  // Get all invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      discountPercent: { gt: 0 },
    },
    include: {
      items: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${invoices.length} invoices with discount\n`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const invoice of invoices) {
    const subtotal = Number(invoice.subtotal);
    const discountPercent = Number(invoice.discountPercent);
    const currentDiscount = Number(invoice.discountAmount);

    // Calculate what discount should be
    const expectedDiscount = Math.round((subtotal * discountPercent) / 100);

    if (currentDiscount !== expectedDiscount) {
      const newTotal = subtotal - expectedDiscount;

      console.log(`📄 ${invoice.invoiceNumber}`);
      console.log(`   Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`);
      console.log(`   Discount: ${discountPercent}%`);
      console.log(`   Current discount: Rp ${currentDiscount.toLocaleString('id-ID')}`);
      console.log(`   Expected discount: Rp ${expectedDiscount.toLocaleString('id-ID')}`);
      console.log(`   Difference: Rp ${(expectedDiscount - currentDiscount).toLocaleString('id-ID')}`);
      console.log(`   Current total: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);
      console.log(`   New total: Rp ${newTotal.toLocaleString('id-ID')}`);

      // Update invoice
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          discountAmount: expectedDiscount,
          totalAmount: newTotal,
        },
      });

      console.log(`   ✅ Fixed!\n`);
      fixedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n✅ Summary:`);
  console.log(`   Fixed: ${fixedCount} invoices`);
  console.log(`   Skipped (already correct): ${skippedCount} invoices`);

  await prisma.$disconnect();
}

fixInvoiceDiscounts().catch(console.error);
