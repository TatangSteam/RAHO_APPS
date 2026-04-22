/**
 * RAHO Klinik - Modular Database Seeder (WITH SESSIONS & BOOSTER)
 * 
 * This seed file includes:
 * - Core data (branches, users, products, etc.)
 * - Member data (members, packages)
 * - Booster packages (HHO & NO2)
 * - Treatment sessions (with booster assigned)
 * 
 * Run with: npm run db:seed
 * Or: npx tsx prisma/seed.new.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  seedBranches,
  assignBranchesToManager,
  seedUsers,
  seedProducts,
  seedInventory,
  seedPackagePricing,
  seedReferralCodes,
  seedInventoryItems,
} from './seeds';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════
// HELPER: Generate Missing Invoices
// ══════════════════════════════════════════════════════════

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

async function generateMissingInvoices(prisma: PrismaClient): Promise<number> {
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

  let created = 0;

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
      continue; // Skip if invoice already exists
    }

    // Generate invoice
    try {
      const branch = pkg.member.registrationBranch;
      const invoiceNumber = await generateInvoiceNumber(branch.branchCode);

      const itemSubtotal = Number(pkg.finalPrice);
      const productCode = pkg.productCode || pkg.packageCode;
      
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

      console.log(`  ✅ Invoice ${invoiceNumber} for ${pkg.packageCode}`);
      created++;
    } catch (error) {
      console.error(`  ❌ Failed for ${pkg.packageCode}:`, error);
    }
  }

  return created;
}

// ══════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ══════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');
  console.log('ℹ️  This seed can be run multiple times safely (uses upsert/skip logic)\n');

  try {
    // ══════════════════════════════════════════════════════════
    // CORE DATA SEEDING
    // ══════════════════════════════════════════════════════════

    // 1. Seed Branches
    const { branchPusat, branchBandung, branchSurabaya } = await seedBranches(prisma);

    // 2. Seed Users (Staff) for all branches
    await seedUsers(
      prisma,
      branchPusat.id,
      branchBandung.id,
      branchSurabaya.id
    );

    // 3. Assign branches to Admin Manager (must be after users are created)
    await assignBranchesToManager(prisma);

    // 4. Seed Referral Codes
    await seedReferralCodes(prisma);

    // 5. Seed Master Products
    const products = await seedProducts(prisma);

    // 6. Seed Inventory for All Branches
    await seedInventory(prisma, products, branchPusat.id);
    await seedInventory(prisma, products, branchBandung.id);
    await seedInventory(prisma, products, branchSurabaya.id);

    // 7. Seed Package Pricing (with HHO & NO2 booster types)
    await seedPackagePricing(prisma, [branchPusat, branchBandung, branchSurabaya]);

    // 8. Seed Inventory Items (Medical supplies for infusion)
    await seedInventoryItems(prisma);

    // 9. Seed Non-Therapy Products (Air Nano & Rokok Kenkou) - SKIPPED (table not migrated yet)
    // await seedNonTherapyProducts(prisma);

    // ══════════════════════════════════════════════════════════
    // MEMBER DATA SEEDING (NEW: Complete member data with packages)
    // ══════════════════════════════════════════════════════════

    console.log('\n📊 Seeding complete member data with packages...\n');

    // Import new member seed
    const { seedMembersMultiBranch } = await import('./seeds/members-multibranch.seed');
    
    // Get all users for passing to seed function
    const allUsers = await prisma.user.findMany({
      where: { role: { not: 'MEMBER' } }
    });
    
    await seedMembersMultiBranch(prisma, [branchPusat, branchBandung, branchSurabaya], allUsers);

    // ══════════════════════════════════════════════════════════
    // GENERATE MISSING INVOICES (for packages without invoices)
    // ══════════════════════════════════════════════════════════

    console.log('\n📄 Generating invoices for packages...\n');
    
    const invoicesGenerated = await generateMissingInvoices(prisma);
    
    console.log(`✅ Generated ${invoicesGenerated} invoices for existing packages\n`);

    // ══════════════════════════════════════════════════════════
    // SUCCESS SUMMARY
    // ══════════════════════════════════════════════════════════

    console.log('\n🎉 Seeding completed successfully!\n');
    console.log('──────────────────────────────────────────');
    console.log('📧 Seed accounts (development only):');
    console.log('  GLOBAL ACCOUNTS:');
    console.log('    superadmin@raho.id   → SuperAdmin@123  [SUPER_ADMIN]');
    console.log('    manager@raho.id      → Manager@123     [ADMIN_MANAGER]');
    console.log('  JAKARTA BRANCH:');
    console.log('    admincabang.jakarta@raho.id  → AdminCabang@123 [ADMIN_CABANG]');
    console.log('    adminlayanan.jakarta@raho.id → AdminLayanan@123[ADMIN_LAYANAN]');
    console.log('    dokter.jakarta@raho.id       → Dokter@123      [DOCTOR]');
    console.log('    nakes.jakarta@raho.id        → Nakes@123       [NURSE]');
    console.log('  BANDUNG BRANCH:');
    console.log('    admincabang.bandung@raho.id  → AdminCabang@123 [ADMIN_CABANG]');
    console.log('    adminlayanan.bandung@raho.id → AdminLayanan@123[ADMIN_LAYANAN]');
    console.log('    dokter.bandung@raho.id       → Dokter@123      [DOCTOR]');
    console.log('    nakes.bandung@raho.id        → Nakes@123       [NURSE]');
    console.log('  SURABAYA BRANCH:');
    console.log('    admincabang.surabaya@raho.id  → AdminCabang@123 [ADMIN_CABANG]');
    console.log('    adminlayanan.surabaya@raho.id → AdminLayanan@123[ADMIN_LAYANAN]');
    console.log('    dokter.surabaya@raho.id       → Dokter@123      [DOCTOR]');
    console.log('    nakes.surabaya@raho.id        → Nakes@123       [NURSE]');
    console.log('──────────────────────────────────────────');
    console.log('\n📊 Data summary:');
    console.log(`  • ${3} branches (Jakarta, Bandung, Surabaya)`);
    console.log(`  • ${14} staff users across all branches`);
    console.log(`  • ${3} referral codes`);
    console.log(`  • ${products.length} master products`);
    console.log(`  • Inventory items for 3 branches with different stock levels`);
    console.log(`  • 40+ medical supplies & infusion materials`);
    console.log(`  • Package pricings (BASIC + BOOSTER) for all branches`);
    console.log(`  • 10 complete members with packages`);
    console.log(`  • ${invoicesGenerated} invoices auto-generated`);
    console.log(`  • Mix of ACTIVE and PENDING_PAYMENT packages`);
    console.log(`  • Multi-branch inventory isolation for testing`);
    console.log(`  • Ready for multi-branch stock deduction testing`);
    console.log('\n✅ Database is ready for development!');
    console.log('\n💡 Tips:');
    console.log('  • Member accounts: budi.santoso@example.com → member123');
    console.log('  • All members have complete profile data');
    console.log('  • ACTIVE packages can generate invoices');
    console.log('  • Correct pricing: NB7HC = Rp 12,500,000');
    console.log('  • Stock levels: Jakarta (100%), Bandung (70%), Surabaya (50%)');
    console.log('  • Test multi-branch by logging in with different branch users');
    console.log('  • Each branch has isolated inventory for stock deduction testing');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
