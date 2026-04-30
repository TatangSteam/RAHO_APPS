import { prisma } from './src/lib/prisma';

async function verifyInvoiceFix() {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: 'INV-PST-2604-0012' },
    include: {
      payments: true,
    },
  });

  if (!invoice) {
    console.log('❌ Invoice not found');
    return;
  }

  console.log(`📄 Invoice: ${invoice.invoiceNumber}`);
  console.log(`💳 Payments: ${invoice.payments.length}`);
  
  if (invoice.payments.length > 0) {
    console.log(`\n✅ Invoice now has payment proof!`);
    invoice.payments.forEach((payment, idx) => {
      console.log(`\n${idx + 1}. Amount: Rp ${payment.amount.toLocaleString('id-ID')}`);
      console.log(`   Method: ${payment.paymentMethod}`);
      console.log(`   Proof File: ${payment.proofFileName}`);
      console.log(`   Proof URL: ${payment.proofFileUrl}`);
      console.log(`   MIME Type: ${payment.proofMimeType}`);
    });
  } else {
    console.log(`\n❌ Invoice still has no payment proof`);
  }

  await prisma.$disconnect();
}

verifyInvoiceFix().catch(console.error);
