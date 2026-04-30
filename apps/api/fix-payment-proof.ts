/**
 * Fix payment proof for existing invoices
 * Add InvoicePayment records for packages that have payment proof but no invoice payment
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPaymentProof() {
  try {
    console.log('🔧 Fixing payment proof for existing invoices...\n');
    
    // Find all ACTIVE packages with payment proof but no invoice payment
    const packages = await prisma.memberPackage.findMany({
      where: {
        status: 'ACTIVE',
        paymentProofUrl: { not: null },
      },
      include: {
        member: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
        verifiedByUser: true
      }
    });
    
    console.log(`📦 Found ${packages.length} packages with payment proof\n`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const pkg of packages) {
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
      
      if (invoiceItems.length === 0) {
        console.log(`⚠️  No invoice found for package ${pkg.packageCode} (${pkg.member.memberNo})`);
        skipped++;
        continue;
      }
      
      const invoice = invoiceItems[0].invoice;
      
      // Check if invoice already has payment with proof
      const hasPaymentProof = invoice.payments.some(p => p.proofFileUrl);
      
      if (hasPaymentProof) {
        console.log(`✅ Invoice ${invoice.invoiceNumber} already has payment proof - skipping`);
        skipped++;
        continue;
      }
      
      // Create invoice payment record
      await prisma.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          paymentMethod: 'TRANSFER',
          notes: `Payment verified for ${pkg.packageCode}`,
          proofFileUrl: pkg.paymentProofUrl,
          proofFileName: pkg.paymentProofFileName,
          proofFileSize: pkg.paymentProofFileSize,
          proofMimeType: pkg.paymentProofMimeType,
          receivedBy: pkg.verifiedBy || pkg.assignedBy,
          receivedAt: pkg.paidAt || pkg.verifiedAt || new Date(),
        },
      });
      
      console.log(`✅ Fixed payment proof for invoice ${invoice.invoiceNumber} - Member: ${pkg.member.memberNo} (${pkg.member.user.profile?.fullName})`);
      fixed++;
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${packages.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPaymentProof();
