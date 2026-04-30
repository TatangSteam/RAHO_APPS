import { PrismaClient, PackageType } from '@prisma/client';

/**
 * OFFICIAL PRICING STRUCTURE (Sesuai List Harga.md)
 * 
 * THERAPY PACKAGES (9 items):
 * - TNB-P1-PM: Terapi Nano Bubble 1X Premiere = Rp 2,000,000
 * - TNB-P7-PM: Terapi Nano Bubble 7X Premiere = Rp 12,500,000
 * - TNB-P15-PM: Terapi Nano Bubble 15X Premiere = Rp 22,500,000
 * - TNB-P1-PS: Terapi Nano Bubble 1X Partnership = Rp 850,000
 * - TNB-P1-PHC: Terapi Nano Bubble 1X Partnership Homecare = Rp 1,000,000
 * - FRE-TRP-F2-PM: FREE 2X Premiere = Rp 0
 * - FRE-TRP-F3-PM: FREE 3X Premiere = Rp 0
 * - FRE-TRP-F4-PM: FREE 4X Premiere = Rp 0
 * - FRE-TRP-F5-PM: FREE 5X Premiere = Rp 0
 * 
 * BOOSTER PACKAGES (7 types: NO, GT, MB, KCL, H2S, HK, O3):
 * Each booster type has 5 service type variants with different pricing:
 * - PM (Premiere): Rp 1,000,000 per session
 * - PS (Partnership): Rp 650,000 per session
 * - PTY (Partnership Attiya): Rp 600,000 per session
 * - PDA (Partnership Dr. Abhi): Rp 65,000 per ml
 * - PHC (Partnership Homecare): Rp 750,000 per session
 * 
 * Total: 7 booster types × 5 service types = 35 booster packages per branch
 * 
 * NOTE: HC code is ONLY for actual Homecare service type (PHC), not for main Premiere packages.
 * NOTE: All prices are stored in database and can be edited independently.
 */

export async function seedPackagePricing(prisma: PrismaClient, branches: { id: string; name: string }[]) {
  console.log('📦 Seeding package pricings...');

  for (const branch of branches) {
    console.log(`  📦 Creating package pricings for: ${branch.name}`);

    // ============================================================
    // THERAPY PACKAGES - SESUAI LIST HARGA
    // ============================================================
    
    const therapyPackages = [
      // Premiere (PM) - Main packages
      { name: 'Terapi Nano Bubble 1X Premiere', totalSessions: 1, price: 2_000_000, code: 'NB1PM', productCode: 'TNB-P1-PM' },
      { name: 'Terapi Nano Bubble 7X Premiere', totalSessions: 7, price: 12_500_000, code: 'NB7PM', productCode: 'TNB-P7-PM' },
      { name: 'Terapi Nano Bubble 15X Premiere', totalSessions: 15, price: 22_500_000, code: 'NB15PM', productCode: 'TNB-P15-PM' },
      
      // Partnership (PS)
      { name: 'Terapi Nano Bubble 1X Partnership', totalSessions: 1, price: 850_000, code: 'NB1PS', productCode: 'TNB-P1-PS' },
      
      // Partnership Homecare (PHC)
      { name: 'Terapi Nano Bubble 1X Partnership Homecare', totalSessions: 1, price: 1_000_000, code: 'NB1PHC', productCode: 'TNB-P1-PHC' },
      
      // Free Packages (Bonus) - Premiere
      { name: 'FREE Terapi Nano Bubble dan Booster 2X Premiere', totalSessions: 2, price: 0, code: 'FREF2PM', productCode: 'FRE-TRP-F2-PM' },
      { name: 'FREE Terapi Nano Bubble dan Booster 3X Premiere', totalSessions: 3, price: 0, code: 'FREF3PM', productCode: 'FRE-TRP-F3-PM' },
      { name: 'FREE Terapi Nano Bubble dan Booster 4X Premiere', totalSessions: 4, price: 0, code: 'FREF4PM', productCode: 'FRE-TRP-F4-PM' },
      { name: 'FREE Terapi Nano Bubble dan Booster 5X Premiere', totalSessions: 5, price: 0, code: 'FREF5PM', productCode: 'FRE-TRP-F5-PM' },
    ];

    for (const pkg of therapyPackages) {
      // Find existing pricing by productCode (unique identifier)
      const existing = await prisma.packagePricing.findFirst({
        where: {
          branchId: branch.id,
          packageType: PackageType.BASIC,
          productCode: pkg.productCode,
        },
      });

      if (existing) {
        // Update existing
        await prisma.packagePricing.update({
          where: { id: existing.id },
          data: {
            name: pkg.name,
            price: pkg.price,
            totalSessions: pkg.totalSessions,
          },
        });
      } else {
        // Create new
        await prisma.packagePricing.create({
          data: {
            branchId: branch.id,
            packageType: PackageType.BASIC,
            boosterType: null,
            name: pkg.name,
            totalSessions: pkg.totalSessions,
            price: pkg.price,
            productCode: pkg.productCode,
            isActive: true,
          },
        });
      }
      console.log(`    ✅ ${pkg.name} (${pkg.code})`);
    }

    // ============================================================
    // BOOSTER PACKAGES - SESUAI LIST HARGA
    // ============================================================
    
    // 7 booster types × 5 service types = 35 booster packages per branch
    
    const boosterTypes = [
      { code: 'NO', name: 'NO' },
      { code: 'GT', name: 'GT' },
      { code: 'MB', name: 'MB' },
      { code: 'KCL', name: 'KCL' },
      { code: 'H2S', name: 'H2S' },
      { code: 'HK', name: 'H2S Konsentrat' },
      { code: 'O3', name: 'O3' },
    ];

    const serviceTypes = [
      { code: 'PM', name: 'Premiere', price: 1_000_000 },
      { code: 'PS', name: 'Partnership', price: 650_000 },
      { code: 'PTY', name: 'Partnership Attiya', price: 600_000 },
      { code: 'PDA', name: 'Partnership Dr. Abhi', price: 65_000 }, // per ml
      { code: 'PHC', name: 'Partnership Homecare', price: 750_000 },
    ];

    for (const boosterType of boosterTypes) {
      for (const serviceType of serviceTypes) {
        const name = `Booster ${boosterType.code} (${boosterType.name}) 1X - ${serviceType.name}`;
        const productCode = `BST-${boosterType.code}-P1-${serviceType.code}`;

        // Find existing pricing
        const existing = await prisma.packagePricing.findFirst({
          where: {
            branchId: branch.id,
            packageType: PackageType.BOOSTER,
            productCode: productCode,
          },
        });

        if (existing) {
          // Update existing
          await prisma.packagePricing.update({
            where: { id: existing.id },
            data: {
              name,
              price: serviceType.price,
              boosterType: boosterType.code as any,
              serviceType: serviceType.code,
            },
          });
        } else {
          // Create new
          await prisma.packagePricing.create({
            data: {
              branchId: branch.id,
              packageType: PackageType.BOOSTER,
              boosterType: boosterType.code as any,
              serviceType: serviceType.code,
              name,
              totalSessions: 1,
              price: serviceType.price,
              productCode,
              isActive: true,
            },
          });
        }
        console.log(`    ✅ ${name} - Rp ${serviceType.price.toLocaleString('id-ID')}`);
      }
    }
  }

  console.log(`\n✅ Package pricings: Created for ${branches.length} branches`);
  console.log(`\n📋 PRICING REFERENCE (Sesuai List Harga):`);
  console.log(`\n   THERAPY PACKAGES (9 items):`);
  console.log(`   - TNB-P1-PM (1X Premiere): Rp 2,000,000`);
  console.log(`   - TNB-P7-PM (7X Premiere): Rp 12,500,000`);
  console.log(`   - TNB-P15-PM (15X Premiere): Rp 22,500,000`);
  console.log(`   - TNB-P1-PS (1X Partnership): Rp 850,000`);
  console.log(`   - TNB-P1-PHC (1X Partnership Homecare): Rp 1,000,000`);
  console.log(`   - FRE-TRP-F2-PM (FREE 2X Premiere): Rp 0`);
  console.log(`   - FRE-TRP-F3-PM (FREE 3X Premiere): Rp 0`);
  console.log(`   - FRE-TRP-F4-PM (FREE 4X Premiere): Rp 0`);
  console.log(`   - FRE-TRP-F5-PM (FREE 5X Premiere): Rp 0`);
  console.log(`\n   BOOSTER PACKAGES (7 types × 5 service types = 35 per branch):`);
  console.log(`   Booster Types:`);
  console.log(`   - NO, GT, MB, KCL, H2S, HK (H2S Konsentrat), O3`);
  console.log(`\n   Service Types & Pricing:`);
  console.log(`   - PM (Premiere): Rp 1,000,000/session`);
  console.log(`   - PS (Partnership): Rp 650,000/session`);
  console.log(`   - PTY (Partnership Attiya): Rp 600,000/session`);
  console.log(`   - PDA (Partnership Dr. Abhi): Rp 65,000/ml`);
  console.log(`   - PHC (Partnership Homecare): Rp 750,000/session`);
  console.log(`\n   ℹ️  NO DUPLICATES - Each booster has unique productCode`);
  console.log(`   ℹ️  Format: BST-{TYPE}-P1-{SERVICE}`);
}

