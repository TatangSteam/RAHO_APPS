import { prisma } from './src/lib/prisma';

async function checkInvoicePaymentProof() {
  const invoiceNumbers = ['INV-PST-2604-0012', 'INV-PST-2604-0013'];

  for (const invoiceNumber of invoiceNumbers) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Invoice: ${invoiceNumber}`);
    console.log('='.repeat(60));

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        items: true,
        payments: true,
        member: {
          select: {
            memberNo: true,
            memberPackages: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!invoice) {
      console.log('❌ Invoice not found\n');
      continue;
    }

    console.log(`\n👤 Member: ${invoice.member.memberNo}`);
    console.log(`💰 Total: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);
    console.log(`📦 Items: ${invoice.items.length}`);
    
    console.log(`\n📦 Invoice Items:`);
    invoice.items.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.description} (${item.itemType})`);
      console.log(`   Item ID: ${item.itemId || 'none'}`);
    });

    console.log(`\n💳 Invoice Payments: ${invoice.payments.length}`);
    invoice.payments.forEach((payment, idx) => {
      console.log(`${idx + 1}. Amount: Rp ${payment.amount.toLocaleString('id-ID')}`);
      console.log(`   Method: ${payment.paymentMethod}`);
      console.log(`   Proof: ${payment.proofFileName || 'none'}`);
      console.log(`   URL: ${payment.proofFileUrl || 'none'}`);
    });

    // Check member packages for payment proof
    console.log(`\n📦 Member Packages (recent):`);
    invoice.member.memberPackages.forEach((pkg, idx) => {
      console.log(`${idx + 1}. ${pkg.packageCode} (${pkg.packageType})`);
      console.log(`   Status: ${pkg.status}`);
      console.log(`   Payment Proof: ${pkg.paymentProofFileName || 'none'}`);
      console.log(`   Proof URL: ${pkg.paymentProofUrl || 'none'}`);
      console.log(`   Purchase Group: ${pkg.purchaseGroupId || 'none'}`);
    });

    // Check if any invoice items match member packages
    console.log(`\n🔗 Matching Invoice Items to Packages:`);
    for (const item of invoice.items) {
      if (item.itemType === 'PACKAGE' && item.itemId) {
        const pkg = invoice.member.memberPackages.find(p => p.id === item.itemId);
        if (pkg) {
          console.log(`✅ Item "${item.description}" matches package ${pkg.packageCode}`);
          console.log(`   Package has proof: ${pkg.paymentProofFileName || 'none'}`);
        } else {
          console.log(`❌ Item "${item.description}" (ID: ${item.itemId}) - package not found in recent packages`);
        }
      }
    }
  }

  await prisma.$disconnect();
}

checkInvoicePaymentProof().catch(console.error);
