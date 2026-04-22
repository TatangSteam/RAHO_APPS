import { PrismaClient, PackageType } from '@prisma/client';

/**
 * OFFICIAL PRICING STRUCTURE (April 2026)
 * 
 * THERAPY PACKAGES:
 * - NB1PM: Terapi Nano Bubble 1X = Rp 2,000,000
 * - NB7PM: Terapi Nano Bubble 7X = Rp 12,500,000
 * - NB15PM: Terapi Nano Bubble 15X = Rp 22,500,000
 * - NB15F2PM-F5PM: With bonus sessions (17-20 total)
 * - NB1PS: Partnership = Rp 850,000
 * - NB1HCPHC: Partnership Homecare = Rp 1,000,000
 * 
 * BOOSTER PACKAGES (7 types: NO, GT, MB, KCL, H2S, HK, O3):
 * - PM (Premiere): Rp 1,000,000 per session
 * - PS (Partnership): Rp 650,000 per session
 * - PTY (Partnership Attiya): Rp 600,000 per session
 * - PDA (Partnership Dr. Abhi): Rp 65,000 per ml
 * - PHC (Partnership Homecare): Rp 750,000 per session
 * 
 * NOTE: Frontend will handle booster type (NO/GT/MB/etc) and service type (HC/PS/etc) selection
 * Pricing is calculated dynamically based on service type in frontend and backend
 */

export async function seedPackagePricing(prisma: PrismaClient, branches: { id: string; name: string }[]) {
  console.log('📦 Seeding package pricings...');

  for (const branch of branches) {
    console.log(`  📦 Creating package pricings for: ${branch.name}`);

    // ============================================================
    // THERAPY PACKAGES (Terapi Nano Bubble)
    // ============================================================
    
    const therapyPackages = [
      // Standard Premiere (PM)
      { name: 'Terapi Nano Bubble 1X', totalSessions: 1, price: 2_000_000, code: 'NB1PM' },
      { name: 'Terapi Nano Bubble 7X', totalSessions: 7, price: 12_500_000, code: 'NB7PM' },
      { name: 'Terapi Nano Bubble 15X', totalSessions: 15, price: 22_500_000, code: 'NB15PM' },
      
      // Bonus packages - totalSessions = actual total (15 paid + bonus)
      { name: 'Terapi Nano Bubble 15X FREE 2X', totalSessions: 17, price: 22_500_000, code: 'NB15F2PM' },
      { name: 'Terapi Nano Bubble 15X FREE 3X', totalSessions: 18, price: 22_500_000, code: 'NB15F3PM' },
      { name: 'Terapi Nano Bubble 15X FREE 4X', totalSessions: 19, price: 22_500_000, code: 'NB15F4PM' },
      { name: 'Terapi Nano Bubble 15X FREE 5X', totalSessions: 20, price: 22_500_000, code: 'NB15F5PM' },
      
      // Partnership (PS) - Use session 4 to avoid constraint with session 1
      { name: 'Terapi Nano Bubble 1X Partnership', totalSessions: 1, price: 850_000, code: 'NB1PS' },
      
      // Partnership Homecare (PHC) - Use session 5 to avoid constraint
      { name: 'Terapi Nano Bubble 1X Partnership Homecare', totalSessions: 1, price: 1_000_000, code: 'NB1HCPHC' },
    ];

    for (const pkg of therapyPackages) {
      await prisma.packagePricing.upsert({
        where: {
          branchId_packageType_totalSessions: {
            branchId: branch.id,
            packageType: PackageType.BASIC,
            totalSessions: pkg.totalSessions,
          },
        },
        update: {
          name: pkg.name,
          price: pkg.price,
        },
        create: {
          branchId: branch.id,
          packageType: PackageType.BASIC,
          name: pkg.name,
          totalSessions: pkg.totalSessions,
          price: pkg.price,
          isActive: true,
        },
      });
      console.log(`    ✅ ${pkg.name} (${pkg.code})`);
    }

    // ============================================================
    // BOOSTER PACKAGES
    // ============================================================
    
    // Seed only 1X booster (per official pricing table)
    // Frontend will handle:
    // - Booster type selection (NO, GT, MB, KCL, H2S, HK, O3)
    // - Service type selection (HC, PS, PTY, PDA, PHC)
    // - Dynamic price calculation based on service type
    // - Quantity selection for multiple sessions
    
    const boosterPricing = {
      name: 'Booster 1X',
      totalSessions: 1,
      price: 1_000_000,
      note: 'PM base price - multiply by quantity for multiple sessions'
    };

    await prisma.packagePricing.upsert({
      where: {
        branchId_packageType_totalSessions: {
          branchId: branch.id,
          packageType: PackageType.BOOSTER,
          totalSessions: boosterPricing.totalSessions,
        },
      },
      update: {
        name: boosterPricing.name,
        price: boosterPricing.price,
      },
      create: {
        branchId: branch.id,
        packageType: PackageType.BOOSTER,
        name: boosterPricing.name,
        totalSessions: boosterPricing.totalSessions,
        price: boosterPricing.price,
        isActive: true,
      },
    });
    console.log(`    ✅ ${boosterPricing.name} (${boosterPricing.note})`);
  }

  console.log(`\n✅ Package pricings: Created for ${branches.length} branches`);
  console.log(`\n📋 PRICING REFERENCE:`);
  console.log(`\n   THERAPY PACKAGES:`);
  console.log(`   - NB1PM (1X): Rp 2,000,000`);
  console.log(`   - NB7PM (7X): Rp 12,500,000`);
  console.log(`   - NB15PM (15X): Rp 22,500,000`);
  console.log(`   - NB15F2PM-F5PM (17-20X with bonus): Rp 22,500,000`);
  console.log(`   - NB1PS (Partnership): Rp 850,000`);
  console.log(`   - NB1HCPHC (Partnership Homecare): Rp 1,000,000`);
  console.log(`\n   BOOSTER PACKAGES (7 types × 5 service types):`);
  console.log(`   Types: NO, GT, MB, KCL, H2S, HK, O3`);
  console.log(`   Service Types & Pricing:`);
  console.log(`   - PM (Premiere): Rp 1,000,000/session`);
  console.log(`   - PS (Partnership): Rp 650,000/session`);
  console.log(`   - PTY (Partnership Attiya): Rp 600,000/session`);
  console.log(`   - PDA (Partnership Dr. Abhi): Rp 65,000/ml`);
  console.log(`   - PHC (Partnership Homecare): Rp 750,000/session`);
  console.log(`\n   ℹ️  Booster type & service type selected in UI during package assignment`);
  console.log(`   ℹ️  Price calculated dynamically based on service type selection`);
}

