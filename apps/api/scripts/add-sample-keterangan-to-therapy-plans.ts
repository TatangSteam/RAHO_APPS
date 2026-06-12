/**
 * Script to add sample keterangan to existing therapy plans
 * This helps test the keterangan display feature
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleKeteranganList = [
  'Terapi infus nano bubble untuk meningkatkan oksigenasi sel',
  'Dosis standar untuk sesi pertama, monitoring tekanan darah ketat',
  'Pasien dengan riwayat hipertensi, gunakan dosis IFA 250ml',
  'Therapy plan khusus untuk meningkatkan stamina dan metabolisme',
  'Rencana terapi jangka panjang dengan fokus detoksifikasi',
  'Kombinasi terapi untuk meningkatkan sistem imun',
  'Terapi maintenance dengan dosis standar',
  'Dosis disesuaikan berdasarkan hasil lab terakhir',
  'Fokus pada regenerasi sel dan anti-aging',
  'Terapi intensif untuk kondisi khusus pasien',
];

async function addSampleKeterangan() {
  console.log('🔍 Mencari therapy plans tanpa keterangan...\n');

  // Get therapy plans without keterangan
  const plansWithoutKeterangan = await prisma.therapyPlan.findMany({
    where: {
      OR: [
        { keterangan: null },
        { keterangan: '' },
      ],
    },
    select: {
      id: true,
      planCode: true,
      memberId: true,
      treatmentSessionId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`📊 Ditemukan ${plansWithoutKeterangan.length} therapy plans tanpa keterangan\n`);

  if (plansWithoutKeterangan.length === 0) {
    console.log('✅ Semua therapy plans sudah memiliki keterangan!');
    return;
  }

  console.log('✏️ Menambahkan sample keterangan...\n');

  let updated = 0;
  for (const plan of plansWithoutKeterangan) {
    // Pick random keterangan from list
    const randomKeterangan = sampleKeteranganList[Math.floor(Math.random() * sampleKeteranganList.length)];

    await prisma.therapyPlan.update({
      where: { id: plan.id },
      data: {
        keterangan: randomKeterangan,
      },
    });

    updated++;
    console.log(`✅ [${updated}/${plansWithoutKeterangan.length}] Updated ${plan.planCode}: "${randomKeterangan.substring(0, 50)}..."`);
  }

  console.log(`\n🎉 Berhasil menambahkan keterangan ke ${updated} therapy plans!`);
  console.log('\n💡 Tips: Refresh browser untuk melihat perubahan di UI');
}

async function showStats() {
  console.log('\n📊 Statistik Therapy Plans:');
  console.log('━'.repeat(60));

  const total = await prisma.therapyPlan.count();
  const withKeterangan = await prisma.therapyPlan.count({
    where: {
      AND: [
        { keterangan: { not: null } },
        { keterangan: { not: '' } },
      ],
    },
  });
  const withoutKeterangan = total - withKeterangan;

  console.log(`Total Therapy Plans       : ${total}`);
  console.log(`Dengan Keterangan         : ${withKeterangan} (${((withKeterangan / total) * 100).toFixed(1)}%)`);
  console.log(`Tanpa Keterangan          : ${withoutKeterangan} (${((withoutKeterangan / total) * 100).toFixed(1)}%)`);
  console.log('━'.repeat(60));
}

async function main() {
  console.log('🚀 Starting: Add Sample Keterangan to Therapy Plans\n');

  try {
    await showStats();
    await addSampleKeterangan();
    await showStats();

    console.log('\n✅ Script selesai!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
