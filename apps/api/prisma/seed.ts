/**
 * RAHO Klinik - Complete Database Seeder
 * 
 * This seed file runs BOTH:
 * 1. Essential seed (production-safe data)
 * 2. Testing seed (dummy data for development)
 * 
 * Run with: npm run db:seed
 * Or: npx tsx prisma/seed.ts
 * 
 * For production, use: npm run db:seed:essential
 * For testing only, use: npm run db:seed:testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Running COMPLETE database seed...');
  console.log('ℹ️  This will run both essential and testing seeds\n');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // ══════════════════════════════════════════════════════════
    // STEP 1: ESSENTIAL SEED (Master Data Only)
    // ══════════════════════════════════════════════════════════
    console.log('\n📦 STEP 1/2: Running Essential Seed...\n');
    
    // Import and run essential seed logic
    const { seedProducts } = await import('./seeds');
    const { seedConsolidatedInventoryItems } = await import('./seeds/inventory-items-consolidated.seed');
    const { cleanupOrphanProducts } = await import('./seeds/cleanup-orphan-products.seed');

    console.log('📦 Seeding master products...');
    const products = await seedProducts(prisma);

    console.log('📦 Seeding consolidated inventory items...');
    await seedConsolidatedInventoryItems(prisma);

    console.log('\n✅ Essential seed completed!\n');

    // ══════════════════════════════════════════════════════════
    // STEP 2: TESTING SEED (Dummy Data for Development)
    // ══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📦 STEP 2/2: Running Testing Seed...\n');

    const { seedBranches, assignBranchesToManager, seedUsers, assignStaffToBranches, assignManagerToBranches, seedPackagePricing, seedReferralCodes, seedMembersMultiBranch, seedMaterials } = await import('./seeds');

    console.log('🏢 Seeding branches...');
    const { branchPusat, branchBandung, branchSurabaya } = await seedBranches(prisma);

    console.log('👥 Seeding admin users...');
    await seedUsers(prisma, branchPusat.id, branchBandung.id, branchSurabaya.id);

    console.log('🔗 Assigning branches to manager...');
    await assignBranchesToManager(prisma);

    console.log('🎫 Seeding referral codes...');
    await seedReferralCodes(prisma);

    console.log('💰 Seeding package pricing...');
    await seedPackagePricing(prisma, [branchPusat, branchBandung, branchSurabaya]);

    console.log('🔗 Assigning staff to branches...');
    await assignStaffToBranches(prisma);
    await assignManagerToBranches(prisma);

    console.log('\n💊 Seeding therapy materials...');
    await seedMaterials(prisma);

    // Cleanup: Remove any orphan MasterProducts that have no InventoryItem
    // This prevents "Belum ada cabang" entries showing up in Master Products UI
    console.log('\n🧹 Cleaning up orphan products...');
    await cleanupOrphanProducts(prisma);

    console.log('\n📊 Seeding test members with packages...\n');
    const allUsers = await prisma.user.findMany({ where: { role: { not: 'MEMBER' } } });
    await seedMembersMultiBranch(prisma, [branchPusat, branchBandung, branchSurabaya], allUsers);

    console.log('\n📄 Generating invoices for packages...\n');
    const invoicesGenerated = await generateMissingInvoices(prisma);
    console.log(`✅ Generated ${invoicesGenerated} invoices\n`);

    console.log('🔐 Creating audit logs...');
    await createAuditLogs(prisma);

    console.log('\n✅ Testing seed completed!\n');

    // ══════════════════════════════════════════════════════════
    // SUCCESS SUMMARY
    // ══════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n🎉 COMPLETE SEED FINISHED SUCCESSFULLY!\n');
    console.log('──────────────────────────────────────────');
    console.log('📧 Admin accounts:');
    console.log('  superadmin@raho.id   → SuperAdmin@123  [SUPER_ADMIN]');
    console.log('  manager@raho.id      → Manager@123     [ADMIN_MANAGER]');
    console.log('──────────────────────────────────────────');
    console.log('\n📊 Data summary:');
    console.log(`  • ${products.length} master products`);
    console.log(`  • 40 consolidated medical supplies`);
    console.log(`  • 35 therapy materials (for sessions)`);
    console.log(`  • ${3} branches (Jakarta, Bandung, Surabaya)`);
    console.log(`  • ${2} admin users + ${12} branch staff`);
    console.log(`  • ${3} referral codes`);
    console.log(`  • Package pricings (BASIC + BOOSTER) for all branches`);
    console.log(`  • 28 test members with packages`);
    console.log(`  • ${invoicesGenerated} invoices`);
    
    const auditLogCount = await prisma.auditLog.count();
    console.log(`  • ${auditLogCount} audit log entries`);
    
    console.log('\n✅ System is ready for development!');
    console.log('\n💡 Next steps:');
    console.log('  1. Start API: npm run dev');
    console.log('  2. Login as superadmin@raho.id');
    console.log('  3. Test member: budi.santoso@example.com → member123');
    console.log('\n📝 Note:');
    console.log('  • For production: npm run db:seed:essential (master data only)');
    console.log('  • For testing: npm run db:seed:testing (dummy data)');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════
// HELPER: Generate Missing Invoices
// ══════════════════════════════════════════════════════════

async function generateInvoiceNumber(branchCode: string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  const prefix = `INV-${branchCode}-${year}${month}`;
  const lastInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
    sequence = lastSeq + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

async function generateMissingInvoices(prisma: PrismaClient): Promise<number> {
  const packagesWithoutInvoices = await prisma.memberPackage.findMany({
    where: { status: 'ACTIVE', paidAt: { not: null } },
    include: { member: { include: { registrationBranch: true } } },
  });

  let created = 0;

  for (const pkg of packagesWithoutInvoices) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: { items: { some: { itemType: 'PACKAGE', itemId: pkg.id } } },
    });

    if (existingInvoice) continue;

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
// HELPER: Create Audit Logs
// ══════════════════════════════════════════════════════════

async function createAuditLog(
  userId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VERIFY',
  resource: string,
  resourceId: string,
  branchId?: string | null,
  meta?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        branchId: branchId || null,
        action,
        resource,
        resourceId,
        meta: meta || {},
        ipAddress: '127.0.0.1',
        userAgent: 'Database Seeder (Complete)',
      },
    });
  } catch (error) {
    console.error(`  ⚠️  Failed to create audit log for ${resource}:`, error);
  }
}

async function createAuditLogs(prisma: PrismaClient) {
  const superAdminUser = await prisma.user.findFirst({
    where: { email: 'superadmin@raho.id' }
  });

  if (!superAdminUser) {
    console.log('  ⚠️  SUPER_ADMIN not found, skipping audit logs');
    return;
  }

  // Log all users
  const allUsers = await prisma.user.findMany();
  for (const user of allUsers) {
    if (user.email !== 'superadmin@raho.id' && user.email !== 'manager@raho.id') {
      const shouldIncludeBranch = user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN_MANAGER';
      await createAuditLog(
        superAdminUser.id, 
        'CREATE', 
        'User', 
        user.id, 
        shouldIncludeBranch ? user.branchId : null,
        { email: user.email, role: user.role, source: 'complete_seeder' }
      );
    }
  }
  
  // Log all members
  const members = await prisma.member.findMany({ include: { user: true } });
  for (const member of members) {
    await createAuditLog(
      superAdminUser.id, 
      'CREATE', 
      'Member', 
      member.id, 
      member.user?.branchId || null, 
      { memberNo: member.memberNo, source: 'complete_seeder' }
    );
  }
  
  // Log all packages
  const packages = await prisma.memberPackage.findMany();
  for (const pkg of packages) {
    await createAuditLog(
      superAdminUser.id, 
      'CREATE', 
      'MemberPackage', 
      pkg.id, 
      pkg.branchId, 
      { packageCode: pkg.packageCode, packageType: pkg.packageType, status: pkg.status, source: 'complete_seeder' }
    );
  }
  
  // Log all invoices
  const invoices = await prisma.invoice.findMany();
  for (const invoice of invoices) {
    await createAuditLog(
      superAdminUser.id, 
      'CREATE', 
      'Invoice', 
      invoice.id, 
      invoice.branchId, 
      { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount.toString(), source: 'complete_seeder' }
    );
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
