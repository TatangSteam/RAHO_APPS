/**
 * Raho ERP - Testing/Sample Data Seeder
 * 
 * This seed file includes SAMPLE data for testing and development:
 * - Branches (Jakarta, Bandung, Surabaya)
 * - Admin users (SUPER_ADMIN, ADMIN_MANAGER)
 * - Branch staff users (doctors, nurses, admins)
 * - Referral codes
 * - Package pricing per branch
 * - Test members with packages
 * - Therapy sessions
 * - Invoices
 * - Audit logs
 * 
 * Run with: npm run db:seed:testing
 * Or: npx tsx prisma/seed-testing.ts
 * 
 * ⚠️ This seed is for DEVELOPMENT/TESTING only - NOT for production
 * 
 * Prerequisites:
 * - Essential data must be seeded first (run seed-essential.ts)
 */

import { PrismaClient } from '@prisma/client';
import {
  seedBranches,
  assignBranchesToManager,
  seedUsers,
  assignStaffToBranches,
  assignManagerToBranches,
  seedPackagePricing,
  seedReferralCodes,
  seedMembersMultiBranch,
  seedConsolidatedInventoryItems,
} from './seeds';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════
// HELPER: Create Audit Log
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
        userAgent: 'Database Seeder (Testing)',
      },
    });
  } catch (error) {
    console.error(`  ⚠️  Failed to create audit log for ${resource}:`, error);
  }
}

// ══════════════════════════════════════════════════════════
// HELPER: Generate Missing Invoices
// ══════════════════════════════════════════════════════════

async function generateInvoiceNumber(branchCode: string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  const suffix = `-${branchCode}-${month}-${year}`;
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        endsWith: suffix,
      },
    },
    orderBy: {
      invoiceNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-', 1)[0] || '0');
    sequence = lastSeq + 1;
  }

  return `${sequence.toString().padStart(5, '0')}-${branchCode}-${month}-${year}`;
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
  console.log('🌱 Seeding TESTING/SAMPLE data...');
  console.log('ℹ️  This seed includes test data for development\n');

  try {
    // ══════════════════════════════════════════════════════════
    // VERIFY ESSENTIAL DATA EXISTS
    // ══════════════════════════════════════════════════════════
    const productCount = await prisma.masterProduct.count();
    if (productCount === 0) {
      throw new Error(
        '❌ Essential data not found! Please run seed-essential.ts first:\n' +
        '   npm run db:seed:essential'
      );
    }

    // ══════════════════════════════════════════════════════════
    // 1. BRANCHES (Sample branches for testing)
    // ══════════════════════════════════════════════════════════
    console.log('🏢 Seeding branches...');
    const { branchPusat, branchBandung, branchSurabaya } = await seedBranches(prisma);

    // ══════════════════════════════════════════════════════════
    // 2. ADMIN USERS (SUPER_ADMIN & ADMIN_MANAGER)
    // ══════════════════════════════════════════════════════════
    console.log('👥 Seeding admin users...');
    await seedUsers(
      prisma,
      branchPusat.id,
      branchBandung.id,
      branchSurabaya.id
    );

    // Get superAdmin for audit logs
    const superAdminUser = await prisma.user.findFirst({
      where: { email: 'superadmin@raho.id' }
    });

    if (!superAdminUser) {
      throw new Error('❌ SUPER_ADMIN user not created!');
    }

    // ══════════════════════════════════════════════════════════
    // 3. ASSIGN BRANCHES TO MANAGER
    // ══════════════════════════════════════════════════════════
    console.log('🔗 Assigning branches to manager...');
    await assignBranchesToManager(prisma);

    // ══════════════════════════════════════════════════════════
    // 4. REFERRAL CODES
    // ══════════════════════════════════════════════════════════
    console.log('🎫 Seeding referral codes...');
    await seedReferralCodes(prisma);

    // ══════════════════════════════════════════════════════════
    // 5. PACKAGE PRICING (for all branches)
    // ══════════════════════════════════════════════════════════
    console.log('💰 Seeding package pricing...');
    await seedPackagePricing(prisma, [branchPusat, branchBandung, branchSurabaya]);

    // ══════════════════════════════════════════════════════════
    // 6. BRANCH STAFF USERS
    // ══════════════════════════════════════════════════════════
    console.log('👥 Checking branch staff users...');
    
    const existingStaff = await prisma.user.count({
      where: {
        role: { in: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'] }
      }
    });

    if (existingStaff === 0) {
      console.log('  ℹ️  Staff users already created in seedUsers');
    } else {
      console.log(`  ℹ️  Staff users already exist (${existingStaff} found)`);
    }

    // ══════════════════════════════════════════════════════════
    // 7. ASSIGN STAFF TO BRANCHES
    // ══════════════════════════════════════════════════════════
    console.log('🔗 Assigning staff to branches...');
    await assignStaffToBranches(prisma);
    await assignManagerToBranches(prisma);

    // ══════════════════════════════════════════════════════════
    // 7.5. INVENTORY ITEMS (Materials for sessions)
    // ══════════════════════════════════════════════════════════
    console.log('\n💊 Seeding inventory items...');
    await seedConsolidatedInventoryItems(prisma);

    // ══════════════════════════════════════════════════════════
    // 8. TEST MEMBERS WITH PACKAGES
    // ══════════════════════════════════════════════════════════
    console.log('\n📊 Seeding test members with packages...\n');

    const allUsers = await prisma.user.findMany({
      where: { role: { not: 'MEMBER' } }
    });
    
    await seedMembersMultiBranch(prisma, [branchPusat, branchBandung, branchSurabaya], allUsers);

    // ══════════════════════════════════════════════════════════
    // 9. GENERATE INVOICES
    // ══════════════════════════════════════════════════════════
    console.log('\n📄 Generating invoices for packages...\n');
    
    const invoicesGenerated = await generateMissingInvoices(prisma);
    console.log(`✅ Generated ${invoicesGenerated} invoices\n`);

    // ══════════════════════════════════════════════════════════
    // 10. CREATE AUDIT LOGS
    // ══════════════════════════════════════════════════════════
    console.log('🔐 Creating audit logs...');
    
    // Log all users
    const allUsersForAudit = await prisma.user.findMany();
    for (const user of allUsersForAudit) {
      if (user.email !== 'superadmin@raho.id' && user.email !== 'manager@raho.id') {
        const shouldIncludeBranch = user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN_MANAGER';
        await createAuditLog(
          superAdminUser.id, 
          'CREATE', 
          'User', 
          user.id, 
          shouldIncludeBranch ? user.branchId : null,
          { 
            email: user.email, 
            role: user.role,
            source: 'testing_seeder'
          }
        );
      }
    }
    
    // Log all members
    const members = await prisma.member.findMany({ include: { user: true } });
    for (const member of members) {
      await createAuditLog(superAdminUser.id, 'CREATE', 'Member', member.id, member.user?.branchId || null, { 
        memberNo: member.memberNo,
        source: 'testing_seeder'
      });
    }
    
    // Log all packages
    const packages = await prisma.memberPackage.findMany();
    for (const pkg of packages) {
      await createAuditLog(superAdminUser.id, 'CREATE', 'MemberPackage', pkg.id, pkg.branchId, { 
        packageCode: pkg.packageCode,
        packageType: pkg.packageType,
        status: pkg.status,
        source: 'testing_seeder'
      });
    }
    
    // Log all invoices
    const invoices = await prisma.invoice.findMany();
    for (const invoice of invoices) {
      await createAuditLog(superAdminUser.id, 'CREATE', 'Invoice', invoice.id, invoice.branchId, { 
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount.toString(),
        source: 'testing_seeder'
      });
    }

    const auditLogCount = await prisma.auditLog.count();

    // ══════════════════════════════════════════════════════════
    // SUCCESS SUMMARY
    // ══════════════════════════════════════════════════════════
    console.log('\n🎉 Testing data seeding completed successfully!\n');
    console.log('──────────────────────────────────────────');
    console.log('📧 Test accounts:');
    console.log('  ADMIN ACCOUNTS:');
    console.log('    superadmin@raho.id   → SuP3r4Dm1n  [SUPER_ADMIN]');
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
    console.log(`  • ${2} admin users + ${12} branch staff`);
    console.log(`  • ${3} referral codes`);
    console.log(`  • Package pricings (BASIC + BOOSTER) for all branches`);
    console.log(`  • 28 test members with packages`);
    console.log(`  • ${invoicesGenerated} invoices`);
    console.log(`  • ${auditLogCount} audit log entries`);
    console.log('\n✅ System is ready for testing!');
    console.log('\n💡 Testing tips:');
    console.log('  • Member accounts: budi.santoso@example.com → member123');
    console.log('  • Test multi-branch by logging in with different branch users');
    console.log('  • Dashboard testing: admincabang.jakarta@raho.id');
    console.log('  • Audit log testing: superadmin@raho.id');
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
