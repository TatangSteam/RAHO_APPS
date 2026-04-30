import { prisma } from './src/lib/prisma';

async function checkInvoiceDiscount() {
  const invoiceNumber = 'INV-PST-2604-0011';
  
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      items: true,
      member: {
        select: {
          memberNo: true,
        },
      },
    },
  });

  if (!invoice) {
    console.log('Invoice not found');
    return;
  }

  console.log('\n📄 Invoice:', invoiceNumber);
  console.log('Member:', invoice.member.memberNo);
  console.log('\n📦 Invoice Items:');
  invoice.items.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.description}`);
    console.log(`   Code: ${item.code}`);
    console.log(`   Qty: ${item.quantity} × Rp ${item.pricePerUnit.toLocaleString('id-ID')}`);
    console.log(`   Subtotal: Rp ${item.subtotal.toLocaleString('id-ID')}`);
  });

  console.log('\n💰 Invoice Totals:');
  console.log(`Subtotal: Rp ${invoice.subtotal.toLocaleString('id-ID')}`);
  console.log(`Discount Percent: ${invoice.discountPercent}%`);
  console.log(`Discount Amount: Rp ${invoice.discountAmount.toLocaleString('id-ID')}`);
  console.log(`Total: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);

  // Calculate what discount should be
  const expectedDiscount = Math.round((Number(invoice.subtotal) * (invoice.discountPercent || 0)) / 100);
  console.log(`\n🔍 Expected discount (${invoice.discountPercent}% of ${invoice.subtotal.toLocaleString('id-ID')}): Rp ${expectedDiscount.toLocaleString('id-ID')}`);
  console.log(`Actual discount: Rp ${invoice.discountAmount.toLocaleString('id-ID')}`);
  console.log(`Difference: Rp ${(expectedDiscount - Number(invoice.discountAmount)).toLocaleString('id-ID')}`);

  await prisma.$disconnect();
}

checkInvoiceDiscount().catch(console.error);
