/**
 * Script untuk assign cabang existing ke ADMIN_MANAGER
 * Jalankan dengan: npx ts-node scripts/assignBranchesToAdminManager.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Mengupdate cabang existing...\n');

  // Ambil semua ADMIN_MANAGER
  const adminManagers = await prisma.user.findMany({
    where: { role: 'ADMIN_MANAGER' },
    select: { id: true, email: true, profile: { select: { fullName: true } } },
  });

  if (adminManagers.length === 0) {
    console.log('❌ Tidak ada ADMIN_MANAGER di database');
    return;
  }

  console.log(`✅ Ditemukan ${adminManagers.length} ADMIN_MANAGER:\n`);
  adminManagers.forEach((admin, idx) => {
    console.log(`${idx + 1}. ${admin.profile?.fullName} (${admin.email})`);
  });

  // Ambil cabang yang belum punya createdBy
  const branchesWithoutCreator = await prisma.branch.findMany({
    where: { createdBy: null },
    select: { id: true, branchCode: true, name: true },
  });

  if (branchesWithoutCreator.length === 0) {
    console.log('\n✅ Semua cabang sudah punya creator');
    return;
  }

  console.log(`\n📦 Ditemukan ${branchesWithoutCreator.length} cabang tanpa creator:\n`);
  branchesWithoutCreator.forEach((branch, idx) => {
    console.log(`${idx + 1}. ${branch.branchCode} - ${branch.name}`);
  });

  // PILIHAN 1: Assign semua cabang ke ADMIN_MANAGER pertama
  const firstAdminManager = adminManagers[0];
  
  console.log(`\n🔄 Mengassign semua cabang ke: ${firstAdminManager.profile?.fullName}...\n`);

  const result = await prisma.branch.updateMany({
    where: { createdBy: null },
    data: { createdBy: firstAdminManager.id },
  });

  console.log(`✅ Berhasil update ${result.count} cabang`);
  console.log(`\n✨ Sekarang ${firstAdminManager.profile?.fullName} bisa melihat semua cabang!`);

  // ALTERNATIF: Jika ingin assign ke ADMIN_MANAGER tertentu berdasarkan email
  // Uncomment dan ganti email di bawah:
  /*
  const targetEmail = 'adminmanager@example.com';
  const targetAdmin = adminManagers.find(a => a.email === targetEmail);
  
  if (targetAdmin) {
    const result = await prisma.branch.updateMany({
      where: { createdBy: null },
      data: { createdBy: targetAdmin.id },
    });
    console.log(`✅ Berhasil assign ${result.count} cabang ke ${targetAdmin.profile?.fullName}`);
  }
  */
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
