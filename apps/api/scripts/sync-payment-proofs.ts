/**
 * Script to sync payment proofs from MemberPackages to InvoicePayments
 * 
 * This script finds all invoices that:
 * 1. Have status PAID
 * 2. Have no payment records
 * 3. Have packages with payment proof
 * 
 * Then creates InvoicePayment records with the proof from the package
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncPaymentProofs() {
  console.log('🔄 Starting payment proof sync...\n');

  try {
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

    console.log(`Found ${invoices.length} PAID invoices\n`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const invoice of invoices) {
      // Skip if invoice already has payments
      if (invoice.payments.length > 0) {
        skippedCount++;
        continue;
      }

      // Get the first package item to find payment proof
      const packageItem = invoice.items.find(item => item.itemType === 'PACKAGE');
      
      if (!packageItem) {
        console.log(`⚠️  Invoice ${invoice.invoiceNumber}: No package items found`);
        skippedCount++;
        continue;
      }

      // Get the package with payment proof
      const memberPackage = await prisma.memberPackage.findUnique({
        where: { id: packageItem.itemId },
        select: {
          paymentProofUrl: true,
          paymentProofFileName: true,
          paymentProofFileSize: true,
          paymentProofMimeType: true,
          verifiedBy: true,
          paidAt: true,
        },
      });

      if (!memberPackage || !memberPackage.paymentProofUrl) {
        console.log(`⚠️  Invoice ${invoice.invoiceNumber}: No payment proof found on package`);
        skippedCount++;
        continue;
      }

      try {
        // Create payment record
        await prisma.invoicePayment.create({
          data: {
            invoiceId: invoice.id,
            amount: invoice.totalAmount,
            paymentMethod: 'TRANSFER', // Assuming transfer since there's proof
            proofFileUrl: memberPackage.paymentProofUrl,
            proofFileName: memberPackage.paymentProofFileName,
            proofFileSize: memberPackage.paymentProofFileSize,
            proofMimeType: memberPackage.paymentProofMimeType,
            receivedBy: memberPackage.verifiedBy || invoice.verifiedBy || invoice.createdBy,
            receivedAt: memberPackage.paidAt || invoice.paidAt || new Date(),
          },
        });

        console.log(`✅ Invoice ${invoice.invoiceNumber}: Payment record created with proof ${memberPackage.paymentProofFileName}`);
        syncedCount++;
      } catch (error) {
        console.error(`❌ Invoice ${invoice.invoiceNumber}: Error creating payment record:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`   Total invoices: ${invoices.length}`);
    console.log(`   ✅ Synced: ${syncedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✅ Payment proof sync completed!');
  } catch (error) {
    console.error('❌ Error during sync:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
syncPaymentProofs()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
