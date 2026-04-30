/**
 * Test payment proof for member MBR-PST-0021
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPaymentProof() {
  try {
    console.log('🔍 Checking payment proof for member MBR-PST-0021...\n');
    
    // Find member
    const member = await prisma.member.findFirst({
      where: { memberNo: 'MBR-PST-0021' },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });
    
    if (!member) {
      console.log('❌ Member MBR-PST-0021 not found');
      return;
    }
    
    console.log(`✅ Member found: ${member.user.profile?.fullName} (${member.memberNo})`);
    console.log(`   Member ID: ${member.id}\n`);
    
    // Find all packages for this member
    const packages = await prisma.memberPackage.findMany({
      where: { memberId: member.id },
      include: {
        branch: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📦 Found ${packages.length} package(s):\n`);
    
    for (const pkg of packages) {
      console.log(`Package:`);
      console.log(`  Package ID: ${pkg.id}`);
      console.log(`  Package Code: ${pkg.packageCode}`);
      console.log(`  Product Code: ${pkg.productCode}`);
      console.log(`  Status: ${pkg.status}`);
      console.log(`  Total Sessions: ${pkg.totalSessions}`);
      console.log(`  Remaining Sessions: ${pkg.remainingSessions}`);
      console.log(`  Final Price: Rp ${pkg.finalPrice.toLocaleString('id-ID')}`);
      console.log(`  Branch: ${pkg.branch.name}`);
      console.log(`  Created At: ${pkg.createdAt.toISOString()}`);
      
      // Find invoice for this package
      const invoiceItems = await prisma.invoiceItem.findMany({
        where: {
          itemType: 'PACKAGE',
          itemId: pkg.id
        },
        include: {
          invoice: {
            include: {
              payments: true
            }
          }
        }
      });
      
      if (invoiceItems.length > 0) {
        const invoice = invoiceItems[0].invoice;
        console.log(`  📄 Invoice:`);
        console.log(`     Invoice ID: ${invoice.id}`);
        console.log(`     Invoice No: ${invoice.invoiceNumber}`);
        console.log(`     Total Amount: Rp ${invoice.totalAmount.toLocaleString('id-ID')}`);
        console.log(`     Status: ${invoice.status}`);
        console.log(`     Paid At: ${invoice.paidAt ? invoice.paidAt.toISOString() : 'Not paid'}`);
        
        if (invoice.payments && invoice.payments.length > 0) {
          console.log(`  💳 Payments (${invoice.payments.length}):`);
          invoice.payments.forEach((payment, idx) => {
            console.log(`     Payment ${idx + 1}:`);
            console.log(`       Amount: Rp ${payment.amount.toLocaleString('id-ID')}`);
            console.log(`       Method: ${payment.paymentMethod}`);
            console.log(`       Received At: ${payment.receivedAt.toISOString()}`);
            
            if (payment.proofFileUrl) {
              console.log(`       ✅ Payment Proof EXISTS:`);
              console.log(`          File Name: ${payment.proofFileName}`);
              console.log(`          File URL: ${payment.proofFileUrl}`);
              console.log(`          File Size: ${payment.proofFileSize} bytes`);
              console.log(`          MIME Type: ${payment.proofMimeType}`);
            } else {
              console.log(`       ❌ Payment Proof NOT FOUND`);
            }
          });
        } else {
          console.log(`  ❌ No payments found for this invoice`);
        }
      } else {
        console.log(`  ❌ Invoice NOT FOUND for this package`);
      }
      
      console.log('');
    }
    
    // Check all invoices for this member
    const allInvoices = await prisma.invoice.findMany({
      where: { memberId: member.id },
      include: {
        payments: true,
        items: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`\n📊 Total invoices for this member: ${allInvoices.length}`);
    
    if (allInvoices.length > 0) {
      console.log('\nAll invoices:');
      allInvoices.forEach((invoice, idx) => {
        const hasProof = invoice.payments.some(p => p.proofFileUrl);
        console.log(`  ${idx + 1}. ${invoice.invoiceNumber} - Status: ${invoice.status} - Payments: ${invoice.payments.length} - Has Proof: ${hasProof ? '✅' : '❌'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentProof();
