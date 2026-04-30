import { PrismaClient } from '@prisma/client';

/**
 * Seed Therapy Sessions with proper staff assignment
 * - Each session handled by 1 doctor, 1 nurse, 1 admin layanan
 * - All sessions are completed
 * - Distributed across different dates
 */

export async function seedTherapySessions(prisma: PrismaClient) {
  console.log('\n🏥 Seeding therapy sessions with proper staff assignment...\n');

  // Get all branches
  const branches = await prisma.branch.findMany({
    orderBy: { branchCode: 'asc' }
  });

  for (const branch of branches) {
    console.log(`📍 Processing ${branch.name}...\n`);

    // Get staff for this branch
    const doctor = await prisma.user.findFirst({
      where: { branchId: branch.id, role: 'DOCTOR', isActive: true },
      include: { profile: true }
    });

    const nurse = await prisma.user.findFirst({
      where: { branchId: branch.id, role: 'NURSE', isActive: true },
      include: { profile: true }
    });

    const adminLayanan = await prisma.user.findFirst({
      where: { branchId: branch.id, role: 'ADMIN_LAYANAN', isActive: true },
      include: { profile: true }
    });

    if (!doctor || !nurse || !adminLayanan) {
      console.log(`  ⚠️  Missing staff (Doctor: ${!!doctor}, Nurse: ${!!nurse}, Admin: ${!!adminLayanan}), skipping...\n`);
      continue;
    }

    // Get active packages for this branch
    const activePackages = await prisma.memberPackage.findMany({
      where: {
        branchId: branch.id,
        status: 'ACTIVE',
        packageType: 'BASIC',
      },
      include: {
        member: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
      },
      take: 10, // Limit to 10 packages per branch
    });

    console.log(`  Found ${activePackages.length} active packages\n`);

    let sessionCount = 0;

    for (const pkg of activePackages) {
      // Determine how many sessions to create (random between 1 and totalSessions)
      const sessionsToCreate = Math.min(
        Math.floor(Math.random() * pkg.totalSessions) + 1,
        pkg.totalSessions
      );

      // Create encounter
      const encounterCode = `ENC-${branch.branchCode}-${pkg.member.memberNo.slice(-4)}-${Date.now().toString().slice(-6)}`;
      
      let encounter = await prisma.encounter.findUnique({
        where: { encounterCode }
      });

      if (!encounter) {
        encounter = await prisma.encounter.create({
          data: {
            encounterCode,
            memberId: pkg.memberId,
            branchId: branch.id,
            memberPackageId: pkg.id,
            adminLayananId: adminLayanan.id,
            doctorId: doctor.id,
            nurseId: nurse.id,
            status: 'ONGOING',
          },
        });
      }

      // Create sessions
      for (let i = 1; i <= sessionsToCreate; i++) {
        const sessionCode = `SES-${branch.branchCode}-${Date.now().toString().slice(-8)}-${i}`;
        
        const existingSession = await prisma.treatmentSession.findUnique({
          where: { sessionCode }
        });

        if (!existingSession) {
          // Calculate session date (spread over last 30 days)
          const daysAgo = Math.floor(Math.random() * 30);
          const sessionDate = new Date();
          sessionDate.setDate(sessionDate.getDate() - daysAgo);

          await prisma.treatmentSession.create({
            data: {
              sessionCode,
              encounterId: encounter.id,
              branchId: branch.id,
              infusKe: i,
              pelaksanaan: 'ON_SITE',
              treatmentDate: sessionDate,
              adminLayananId: adminLayanan.id,
              doctorId: doctor.id,
              nurseId: nurse.id,
              isCompleted: true, // All sessions completed
              createdAt: sessionDate,
            },
          });

          sessionCount++;
        }
      }

      // Update package used sessions
      await prisma.memberPackage.update({
        where: { id: pkg.id },
        data: { usedSessions: sessionsToCreate },
      });

      console.log(`  ✅ ${pkg.member.user.profile?.fullName}: ${sessionsToCreate} sesi`);
    }

    console.log(`\n  📊 Total: ${sessionCount} sesi untuk ${branch.name}`);
    console.log(`  👨‍⚕️ Dokter: ${doctor.profile?.fullName}`);
    console.log(`  👩‍⚕️ Nakes: ${nurse.profile?.fullName}`);
    console.log(`  👤 Admin Layanan: ${adminLayanan.profile?.fullName}\n`);
  }

  console.log('✅ Therapy sessions seeding completed!\n');
}

// Standalone execution
if (require.main === module) {
  const prisma = new PrismaClient();

  async function main() {
    console.log('🌱 Running therapy sessions seeder...\n');
    await seedTherapySessions(prisma);
  }

  main()
    .catch((e) => {
      console.error('\n❌ Seeding failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
