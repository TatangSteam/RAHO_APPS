/**
 * Script to generate invoices for old packages that were verified before auto-invoice feature
 * Run with: npx tsx scripts/generateMissingInvoices.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateInvoiceNumber(branchCode: string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  const prefix = `INV-${branchCode}-${year}${month}`;
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
    sequence = lastSeq + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

async function main() {
  console.log('🔍 Finding packages without invoices...\n');

  // Find all ACTIVE packages that don't have invoices
  const packagesWithoutInvoices = await prisma.memberPackage.findMany({
    where: {
      status: 'ACTIVE',
      paidAt: { not: null },
    },
    include: {
      member: {
        include: {
          registrationBranch: true,
        },
      },
    },
  });

  console.log(`Found ${packagesWithoutInvoices.length} packages to check\n`);

  let created = 0;
  let skipped = 0;

  for (const pkg of packagesWithoutInvoices) {
    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        items: {
          some: {
            itemType: 'PACKAGE',
            itemId: pkg.id,
          },
        },
      },
    });

    if (existingInvoice) {
      console.log(`⏭️  Skipped ${pkg.packageCode} - Invoice already exists`);
      skipped++;
      continue;
    }

    // Generate invoice
    try {
      const branch = pkg.member.registrationBranch;
      const invoiceNumber = await generateInvoiceNumber(branch.branchCode);

      const itemSubtotal = Number(pkg.finalPrice);
      const productCode = pkg.productCode || pkg.packageCode;
      
      // Use product code in both code field and description
      const itemDescription = pkg.productCode 
        ? `${pkg.packageType} Package`
        : `${pkg.packageType} Package - ${pkg.packageCode}`;

      await prisma.invoice.create({
        data: {
          invoiceNumber,
          memberId: pkg.memberId,
          branchId: pkg.branchId,
          subtotal: itemSubtotal,
          discountPercent: pkg.discountPercent || 0,
          discountAmount: pkg.discountAmount || 0,
          discountNote: pkg.discountNote,
          taxPercent: 0,
          taxAmount: 0,
          totalAmount: itemSubtotal,
          status: 'PAID',
          paidAt: pkg.paidAt,
          paymentMethod: 'CASH',
          createdBy: pkg.verifiedBy || pkg.assignedBy,
          verifiedBy: pkg.verifiedBy,
          verifiedAt: pkg.verifiedAt,
          items: {
            create: {
              itemType: 'PACKAGE',
              itemId: pkg.id,
              code: productCode,
              description: itemDescription,
              quantity: 1,
              pricePerUnit: itemSubtotal,
              subtotal: itemSubtotal,
              discountAmount: Number(pkg.discountAmount) || 0,
              totalAmount: itemSubtotal,
            },
          },
        },
      });

      console.log(`✅ Created invoice ${invoiceNumber} for ${pkg.packageCode}`);
      created++;
    } catch (error) {
      console.error(`❌ Failed to create invoice for ${pkg.packageCode}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${packagesWithoutInvoices.length}`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
