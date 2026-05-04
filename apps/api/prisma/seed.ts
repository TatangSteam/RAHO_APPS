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
  assignStaffToBranches,
  assignManagerToBranches,
  seedProducts,
  seedInventory,
  seedPackagePricing,
  seedReferralCodes,
  seedMembersMultiBranch,
} from './seeds';

// Import consolidated inventory seeding
import { seedConsolidatedInventoryItems } from './seeds/inventory-items-consolidated.seed';

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
        userAgent: 'Database Seeder',
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
    // Get SUPER_ADMIN user for audit logs
    let superAdminUser = await prisma.user.findFirst({
      where: { email: 'superadmin@raho.id' }
    });

    // ══════════════════════════════════════════════════════════
    // CORE DATA SEEDING
    // ══════════════════════════════════════════════════════════

    // 1. Seed Branches
    console.log('🏢 Seeding branches...');
    const { branchPusat, branchBandung, branchSurabaya } = await seedBranches(prisma);
    
    // Create audit logs for branches (if superAdmin exists)
    if (superAdminUser) {
      await createAuditLog(superAdminUser.id, 'CREATE', 'Branch', branchPusat.id, null, { 
        branchCode: branchPusat.branchCode, 
        name: branchPusat.name,
        source: 'database_seeder'
      });
      await createAuditLog(superAdminUser.id, 'CREATE', 'Branch', branchBandung.id, null, { 
        branchCode: branchBandung.branchCode, 
        name: branchBandung.name,
        source: 'database_seeder'
      });
      await createAuditLog(superAdminUser.id, 'CREATE', 'Branch', branchSurabaya.id, null, { 
        branchCode: branchSurabaya.branchCode, 
        name: branchSurabaya.name,
        source: 'database_seeder'
      });
    }

    // 2. Seed Users (Staff) for all branches
    console.log('👥 Seeding users...');
    await seedUsers(
      prisma,
      branchPusat.id,
      branchBandung.id,
      branchSurabaya.id
    );
    
    // Get superAdmin again after users are created
    if (!superAdminUser) {
      superAdminUser = await prisma.user.findFirst({
        where: { email: 'superadmin@raho.id' }
      });
    }
    
    // Create audit logs for all users
    if (superAdminUser) {
      const allUsers = await prisma.user.findMany();
      for (const user of allUsers) {
        // SUPER_ADMIN and ADMIN_MANAGER don't have branchId in audit log
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
            source: 'database_seeder'
          }
        );
      }
    }

    // 3. Assign branches to Admin Manager (must be after users are created)
    console.log('🔗 Assigning branches to manager...');
    await assignBranchesToManager(prisma);

    // 4. Assign doctors and nurses to multiple branches
    console.log('🔗 Assigning staff to branches...');
    await assignStaffToBranches(prisma);
    
    // 4a. Assign ADMIN_MANAGER to specific branches (NEW MULTI-BRANCH SYSTEM)
    await assignManagerToBranches(prisma);

    // 4. Seed Referral Codes
    console.log('🎫 Seeding referral codes...');
    await seedReferralCodes(prisma);
    
    // Create audit logs for referral codes
    if (superAdminUser) {
      const referralCodes = await prisma.referralCode.findMany({ include: { branch: true } });
      for (const code of referralCodes) {
        await createAuditLog(superAdminUser.id, 'CREATE', 'ReferralCode', code.id, code.branchId, { 
          code: code.code, 
          referrerName: code.referrerName,
          source: 'database_seeder'
        });
      }
    }

    // 5. Seed Master Products (OLD - for backward compatibility)
    console.log('📦 Seeding master products...');
    const products = await seedProducts(prisma);
    
    // Create audit logs for products (query with full fields)
    if (superAdminUser) {
      const fullProducts = await prisma.masterProduct.findMany({
        where: {
          id: { in: products.map(p => p.id) }
        }
      });
      
      for (const product of fullProducts) {
        await createAuditLog(superAdminUser.id, 'CREATE', 'MasterProduct', product.id, null, { 
          name: product.name, 
          category: product.category,
          source: 'database_seeder'
        });
      }
    }

    // 7. Seed Package Pricing (with HHO & NO2 booster types)
    console.log('💰 Seeding package pricing...');
    await seedPackagePricing(prisma, [branchPusat, branchBandung, branchSurabaya]);
    
    // Create audit logs for package pricing
    if (superAdminUser) {
      const packagePricings = await prisma.packagePricing.findMany({ include: { branch: true } });
      for (const pricing of packagePricings) {
        await createAuditLog(superAdminUser.id, 'CREATE', 'PackagePricing', pricing.id, pricing.branchId, { 
          packageType: pricing.packageType,
          price: pricing.price.toString(),
          source: 'database_seeder'
        });
      }
    }

    // 8. Seed CONSOLIDATED Inventory Items (40 products - no duplicates!)
    console.log('📦 Seeding consolidated inventory...');
    await seedConsolidatedInventoryItems(prisma);
    
    // Create audit logs for inventory items
    if (superAdminUser) {
      const inventoryItems = await prisma.inventoryItem.findMany({
        include: { masterProduct: true }
      });
      for (const item of inventoryItems) {
        await createAuditLog(superAdminUser.id, 'CREATE', 'InventoryItem', item.id, item.branchId, { 
          productName: item.masterProduct.name,
          stock: item.stock.toString(),
          source: 'database_seeder'
        });
      }
    }

    // ══════════════════════════════════════════════════════════
    // MEMBER DATA SEEDING (NEW: Complete member data with packages)
    // ══════════════════════════════════════════════════════════

    console.log('\n📊 Seeding complete member data with packages...\n');

    // Get all users for passing to seed function
    const allUsers = await prisma.user.findMany({
      where: { role: { not: 'MEMBER' } }
    });
    
    await seedMembersMultiBranch(prisma, [branchPusat, branchBandung, branchSurabaya], allUsers);
    
    // Create audit logs for members and packages
    if (superAdminUser) {
      const members = await prisma.member.findMany({ include: { user: true } });
      for (const member of members) {
        // Members are tied to branches through their user account
        await createAuditLog(superAdminUser.id, 'CREATE', 'Member', member.id, member.user?.branchId || null, { 
          memberNo: member.memberNo,
          source: 'database_seeder'
        });
      }
      
      const packages = await prisma.memberPackage.findMany();
      for (const pkg of packages) {
        await createAuditLog(superAdminUser.id, 'CREATE', 'MemberPackage', pkg.id, pkg.branchId, { 
          packageCode: pkg.packageCode,
          packageType: pkg.packageType,
          status: pkg.status,
          source: 'database_seeder'
        });
      }
    }

    // ══════════════════════════════════════════════════════════
    // GENERATE MISSING INVOICES (for packages without invoices)
    // ══════════════════════════════════════════════════════════

    console.log('\n📄 Generating invoices for packages...\n');
    
    const invoicesGenerated = await generateMissingInvoices(prisma);
    
    // Create audit logs for invoices
    if (superAdminUser) {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: invoicesGenerated
      });
      for (const invoice of invoices) {
        await createAuditLog(superAdminUser.id, 'CREATE', 'Invoice', invoice.id, invoice.branchId, { 
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount.toString(),
          source: 'database_seeder'
        });
      }
    }
    
    console.log(`✅ Generated ${invoicesGenerated} invoices for existing packages\n`);

    // ══════════════════════════════════════════════════════════
    // SUCCESS SUMMARY
    // ══════════════════════════════════════════════════════════

    // Count audit logs
    const auditLogCount = await prisma.auditLog.count();

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
    console.log(`  • 40 CONSOLIDATED medical supplies (no duplicates!)`);
    console.log(`  • Package pricings (BASIC + BOOSTER) for all branches`);
    console.log(`  • 10 complete members with packages (base data)`);
    console.log(`  • 18 additional members for dashboard testing`);
    console.log(`  • ${invoicesGenerated} invoices auto-generated`);
    console.log(`  • ${auditLogCount} audit log entries created 🔐`);
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
    console.log('\n📊 Dashboard Testing:');
    console.log('  • Login as: admincabang.pst@raho.id → AdminCabang@123');
    console.log('  • Dashboard URL: /dashboard');
    console.log('  • Test filters: Hari Ini (3 txn), 7 Hari (8 txn), Bulan Ini (15 txn)');
    console.log('  • Revenue growth comparison available');
    console.log('  • Top packages and recent transactions populated');
    console.log('\n🔐 Audit Log Testing:');
    console.log('  • Login as: superadmin@raho.id → SuperAdmin@123');
    console.log('  • Audit Log URL: /admin/audit-logs');
    console.log(`  • ${auditLogCount} audit entries available for testing`);
    console.log('  • All seeding operations are logged');
    console.log('  • Filter by action: CREATE, UPDATE, DELETE, VERIFY');
    console.log('  • Filter by resource: Branch, User, Member, Package, Invoice, etc.');
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
