/**
 * Raho ERP - Essential System Data Seeder
 * 
 * This seed file includes ONLY essential data required for system operation:
 * - Super Admin user (first admin account)
 * - Master products (medical supplies catalog)
 * - Consolidated inventory items (medical supplies list)
 * 
 * Run with: npm run db:seed:essential
 * Or: npx tsx prisma/seed-essential.ts
 * 
 * ⚠️ This seed is safe for PRODUCTION use
 * 
 * NOTE: This does NOT include:
 * - Branches (will be created by admin in production)
 * - Admin Manager users (will be created by super admin in production)
 * - Referral codes (will be created by admin in production)
 */

import { PrismaClient } from '@prisma/client';
import { seedProducts } from './seeds';
import bcrypt from 'bcryptjs';

// Import consolidated inventory seeding
import { seedConsolidatedInventoryItems } from './seeds/inventory-items-consolidated.seed';
// Import master types seeding
import { seedMasterTypes } from './seeds/master-types.seed';
// Import realistic stock levels seeding
import { seedRealisticStock } from './seeds/realistic-stock.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding ESSENTIAL system data...');
  console.log('ℹ️  This seed includes only master data + Super Admin\n');

  try {
    // ══════════════════════════════════════════════════════════
    // 1. SUPER ADMIN USER (First admin account)
    // ══════════════════════════════════════════════════════════
    console.log('👤 Creating Super Admin user...');
    
    const hashedPassword = await bcrypt.hash('Sup3r4dM1n@123', 10);
    
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@raho.id' },
      update: {},
      create: {
        email: 'superadmin@raho.id',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        profile: {
          create: {
            fullName: 'Super Administrator',
            phone: '+62-811-1234-5678',
          },
        },
      },
    });
    
    console.log(`  ✅ Super Admin created: ${superAdmin.email}`);

    // ══════════════════════════════════════════════════════════
    // 2. MASTER PRODUCTS (Medical Supplies Catalog)
    // ══════════════════════════════════════════════════════════
    console.log('📦 Seeding master products...');
    const products = await seedProducts(prisma);

    // ══════════════════════════════════════════════════════════
    // 3. CONSOLIDATED INVENTORY ITEMS (Medical Supplies List)
    // ══════════════════════════════════════════════════════════
    console.log('📦 Seeding consolidated inventory items...');
    await seedConsolidatedInventoryItems(prisma);

    // ══════════════════════════════════════════════════════════
    // 4. MASTER TYPES (Booster & Service Types)
    // ══════════════════════════════════════════════════════════
    console.log('⚙️ Seeding master types...');
    await seedMasterTypes();

    // ══════════════════════════════════════════════════════════
    // 5. REALISTIC STOCK LEVELS (Per Branch)
    // ══════════════════════════════════════════════════════════
    console.log('📦 Seeding realistic stock levels per branch...');
    await seedRealisticStock(prisma);

    // ══════════════════════════════════════════════════════════
    // SUCCESS SUMMARY
    // ══════════════════════════════════════════════════════════
    console.log('\n🎉 Essential data seeding completed successfully!\n');
    console.log('──────────────────────────────────────────');
    console.log('📧 Super Admin Account:');
    console.log('  superadmin@raho.id → Sup3r4dM1n@123 [SUPER_ADMIN]');
    console.log('──────────────────────────────────────────');
    console.log('\n📊 Data summary:');
    console.log(`  • 1 Super Admin user`);
    console.log(`  • ${products.length} master products`);
    console.log(`  • 40 consolidated medical supplies`);
    console.log(`  • 7 booster types (NO, GT, MB, KCL, H2S, HK, O3)`);
    console.log(`  • 5 service types (PM, PS, PTY, PDA, PHC)`);
    console.log('──────────────────────────────────────────');
    console.log('\n✅ Master data is ready!');
    console.log('\n💡 Next steps for production:');
    console.log('  1. Login as superadmin@raho.id');
    console.log('  2. Create branches via admin panel');
    console.log('  3. Create Admin Manager users');
    console.log('  4. Create package pricing for each branch');
    console.log('  5. Create referral codes as needed');
    console.log('  6. Adjust inventory stock levels per branch');
    console.log('\n⚠️  To add testing data (branches, users, members), run:');
    console.log('     npm run db:seed:testing');
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
