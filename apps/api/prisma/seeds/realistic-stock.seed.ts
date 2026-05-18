import { PrismaClient } from '@prisma/client';

/**
 * REALISTIC STOCK SEEDER
 *
 * Purpose:
 *   Reset semua InventoryItem ke level stok yang masuk akal untuk klinik kecil-menengah,
 *   dengan distribusi per cabang dan beberapa kondisi stok bermasalah agar UI indikator
 *   (low stock / out of stock) bisa diuji.
 *
 * Strategi:
 *   - Stok dasar dihitung dari minThreshold × multiplier yang reasonable (5-15× threshold)
 *   - Cabang Pusat (PST): 100% (gudang utama)
 *   - Cabang Bandung (BDG): 50-70% (cabang aktif)
 *   - Cabang Surabaya (SBY): 20-40% (cabang lebih kecil + ada beberapa low/out of stock)
 *
 * Idempotent — aman dijalankan ulang.
 * Run: npx tsx prisma/seeds/realistic-stock.seed.ts
 */

interface StockProfile {
  // Base values, akan di-multiply per cabang
  threshold: number;
  baseMultiplier: number; // PST stock = threshold × baseMultiplier
}

const CATEGORY_PROFILES: Record<string, StockProfile> = {
  // Obat & cairan: stok sedang, threshold ketat (cepat habis)
  MEDICINE: { threshold: 10, baseMultiplier: 8 },
  // Alat medis: stok lebih kecil, threshold lebih kecil (lebih awet)
  DEVICE: { threshold: 5, baseMultiplier: 6 },
  // Bahan habis pakai: stok besar, threshold besar (cepat habis)
  CONSUMABLE: { threshold: 20, baseMultiplier: 10 },
};

// Profile per cabang (% dari PST, plus chance some items are low/empty)
interface BranchProfile {
  multiplier: number;        // Berapa persen dari stok PST
  lowStockChance: number;    // Probabilitas (0-1) item akan low stock (di bawah threshold)
  outOfStockChance: number;  // Probabilitas item akan habis total
}

const BRANCH_PROFILES: Record<string, BranchProfile> = {
  PST: { multiplier: 1.0, lowStockChance: 0.0, outOfStockChance: 0.0 },   // Pusat: stok penuh
  BDG: { multiplier: 0.6, lowStockChance: 0.15, outOfStockChance: 0.05 }, // Bandung: cukup
  SBY: { multiplier: 0.35, lowStockChance: 0.25, outOfStockChance: 0.10 }, // Surabaya: tipis
};

// Default for unknown branches
const DEFAULT_BRANCH_PROFILE: BranchProfile = { multiplier: 0.5, lowStockChance: 0.2, outOfStockChance: 0.05 };

export async function seedRealisticStock(prisma: PrismaClient) {
  console.log('\n📦 Seeding realistic inventory stock levels...\n');

  const branches = await prisma.branch.findMany();
  const products = await prisma.masterProduct.findMany({
    where: { isActive: true },
  });

  if (branches.length === 0) {
    console.log('⚠️  No branches found. Skipping.');
    return;
  }
  if (products.length === 0) {
    console.log('⚠️  No master products found. Skipping.');
    return;
  }

  console.log(`🏢 ${branches.length} branches × 📦 ${products.length} products\n`);

  let created = 0;
  let updated = 0;

  // Stable pseudo-random generator from product+branch id for reproducibility
  const seededRandom = (seed: string): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(Math.sin(hash)) % 1;
  };

  for (const product of products) {
    const profile = CATEGORY_PROFILES[product.category] || CATEGORY_PROFILES.CONSUMABLE;

    for (const branch of branches) {
      const branchProfile = BRANCH_PROFILES[branch.branchCode] || DEFAULT_BRANCH_PROFILE;

      // Base stock for PST
      const baseStock = profile.threshold * profile.baseMultiplier;
      const targetStock = Math.round(baseStock * branchProfile.multiplier);
      const targetThreshold = profile.threshold;

      // Determine final stock level using stable seed
      const rand1 = seededRandom(`${product.id}-${branch.id}-stock`);
      const rand2 = seededRandom(`${product.id}-${branch.id}-out`);

      let finalStock: number;
      let stockNote: string;

      if (rand2 < branchProfile.outOfStockChance) {
        // Out of stock
        finalStock = 0;
        stockNote = '🔴';
      } else if (rand1 < branchProfile.lowStockChance) {
        // Low stock: between 10% and 90% of threshold
        finalStock = Math.max(1, Math.floor(targetThreshold * (0.1 + rand1 * 0.8)));
        stockNote = '🟡';
      } else {
        // Normal stock with some variance (±20%)
        const variance = 0.8 + rand1 * 0.4;
        finalStock = Math.max(targetThreshold + 1, Math.round(targetStock * variance));
        stockNote = '🟢';
      }

      const existing = await prisma.inventoryItem.findUnique({
        where: {
          masterProductId_branchId: {
            masterProductId: product.id,
            branchId: branch.id,
          },
        },
      });

      if (existing) {
        await prisma.inventoryItem.update({
          where: { id: existing.id },
          data: {
            stock: finalStock,
            minThreshold: targetThreshold,
          },
        });
        updated++;
      } else {
        await prisma.inventoryItem.create({
          data: {
            masterProductId: product.id,
            branchId: branch.id,
            stock: finalStock,
            minThreshold: targetThreshold,
          },
        });
        created++;
      }

      // Optional verbose log for first few products
      if (created + updated <= 9) {
        console.log(
          `   ${stockNote} ${branch.branchCode} | ${product.name.padEnd(28)} → ${String(finalStock).padStart(4)} ${product.baseUnit} (threshold ${targetThreshold})`
        );
      }
    }
  }

  console.log(`\n✅ Stock seeded: ${created} created, ${updated} updated\n`);

  // Summary per branch
  console.log('📊 Stock summary per branch:');
  for (const branch of branches) {
    const stats = await prisma.inventoryItem.groupBy({
      by: ['branchId'],
      where: { branchId: branch.id },
      _count: { _all: true },
    });

    const allItems = await prisma.inventoryItem.findMany({
      where: { branchId: branch.id },
      select: { stock: true, minThreshold: true },
    });

    const total = allItems.length;
    const outOfStock = allItems.filter(i => Number(i.stock) <= 0).length;
    const lowStock = allItems.filter(i => Number(i.stock) > 0 && Number(i.stock) <= Number(i.minThreshold)).length;
    const healthy = total - outOfStock - lowStock;

    console.log(`   🏢 ${branch.branchCode} ${branch.name}`);
    console.log(`      Total ${total} items | 🟢 ${healthy} healthy | 🟡 ${lowStock} menipis | 🔴 ${outOfStock} habis`);
  }

  console.log('\n💡 Stok ini bisa di-edit manual via halaman:');
  console.log('   - /admin/master-products (Super Admin: lihat semua + edit langsung)');
  console.log('   - /inventory (Admin Cabang: edit cabang sendiri)\n');
}

// Allow running this seed standalone
if (require.main === module) {
  const prisma = new PrismaClient();
  seedRealisticStock(prisma)
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
