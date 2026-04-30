import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

/**
 * Seed complete therapy sessions with all steps
 * - Diagnosis
 * - Therapy Plan
 * - Vital Signs (Before & After)
 * - Infusion Execution
 * - Material Usage
 * - Doctor Evaluation
 * 
 * Distribution: 7/7, 6/7, 5/7, 4/7, 3/7 (minimum 3 sessions)
 */

interface SessionData {
  memberId: string;
  memberNo: string;
  fullName: string;
  packageId: string;
  packageCode: string;
  totalSessions: number;
  branchId: string;
  branchCode: string;
  doctorId: string;
  nurseId: string;
  adminLayananId: string;
}

// Helper: Generate codes
function generateCode(prefix: string, branchCode: string): string {
  const timestamp = Date.now();
  const random = nanoid(5).toUpperCase();
  return `${prefix}-${branchCode}-${timestamp}-${random}`;
}

// Helper: Create diagnosis
async function createDiagnosis(
  encounterId: string,
  doctorId: string,
  branchCode: string
) {
  const diagnosisCode = generateCode('DGN', branchCode);
  
  return await prisma.diagnosis.create({
    data: {
      diagnosisCode,
      memberId: '', // Will be set by the caller
      encounterId,
      doktorPemeriksa: doctorId,
      diagnosa: 'Hipertensi Grade 1',
      kategoriDiagnosa: 'KARDIOVASKULAR',
      icdPrimer: 'I10',
      keluhanRiwayatSekarang: 'Tekanan darah tinggi, pusing, mudah lelah',
      riwayatPenyakitTerdahulu: 'Hipertensi sejak 2 tahun yang lalu',
      riwayatSosialKebiasaan: 'Tidak ada',
    },
  });
}

// Helper: Create therapy plan
async function createTherapyPlan(
  sessionId: string,
  infusKe: number,
  doctorId: string,
  branchCode: string
) {
  const planCode = generateCode('TPL', branchCode);
  
  return await prisma.therapyPlan.create({
    data: {
      planCode,
      treatmentSessionId: sessionId,
      ifa: 500,
      hho: 30,
      keterangan: 'Terapi infus nano bubble untuk meningkatkan oksigenasi',
    },
  });
}

// Helper: Create vital signs
async function createVitalSigns(
  sessionId: string,
  waktuCatat: 'SEBELUM' | 'SESUDAH',
  nurseId: string
) {
  const vitalTypes = [
    { type: 'SPO2', value: waktuCatat === 'SEBELUM' ? 95 : 98, unit: '%' },
    { type: 'SUHU_TUBUH', value: waktuCatat === 'SEBELUM' ? 36.8 : 36.5, unit: '°C' },
    { type: 'TEKANAN_DARAH_SISTOLIK', value: waktuCatat === 'SEBELUM' ? 140 : 120, unit: 'mmHg' },
    { type: 'TEKANAN_DARAH_DIASTOLIK', value: waktuCatat === 'SEBELUM' ? 90 : 80, unit: 'mmHg' },
    { type: 'NADI', value: waktuCatat === 'SEBELUM' ? 88 : 75, unit: 'bpm' },
  ];

  const results = [];
  for (const vital of vitalTypes) {
    const result = await prisma.vitalSign.create({
      data: {
        treatmentSessionId: sessionId,
        pencatatan: vital.type as any,
        waktuCatat: waktuCatat as any,
        value: vital.value,
        unit: vital.unit,
        recordedBy: nurseId,
      },
    });
    results.push(result);
  }

  return results;
}

// Helper: Create infusion execution
async function createInfusion(
  sessionId: string,
  therapyPlanId: string,
  nurseId: string,
  branchId: string
) {
  // Get inventory items for infusion
  const naclItem = await prisma.inventoryItem.findFirst({
    where: {
      branchId,
      masterProduct: { name: { contains: 'NaCl' } },
    },
  });

  if (!naclItem) {
    throw new Error('NaCl inventory item not found');
  }

  return await prisma.infusionExecution.create({
    data: {
      treatmentSessionId: sessionId,
      ifa: 500,
      hho: 30,
      bottleType: 'IFA',
      jenisCairan: 'NaCl 0.9%',
      volumeCarrier: 500,
      deviationNotes: 'Infus berjalan lancar',
    },
  });
}

// Helper: Create material usage
async function createMaterialUsage(
  sessionId: string,
  nurseId: string,
  branchId: string
) {
  // Get common materials
  const materials = await prisma.inventoryItem.findMany({
    where: {
      branchId,
      masterProduct: {
        name: {
          in: ['NaCl 0.9% 500ml', 'IV Catheter 22G', 'Infusion Set'],
        },
      },
    },
    include: {
      masterProduct: true,
    },
    take: 3,
  });

  if (materials.length === 0) {
    console.log('⚠️  No materials found, skipping material usage');
    return [];
  }

  const usages = [];
  for (const material of materials) {
    const usage = await prisma.materialUsage.create({
      data: {
        treatmentSessionId: sessionId,
        inventoryItemId: material.id,
        quantity: 1,
        unit: material.masterProduct.unit,
        recordedBy: nurseId,
      },
    });
    usages.push(usage);
  }

  return usages;
}

// Helper: Create doctor evaluation
async function createEvaluation(
  sessionId: string,
  doctorId: string,
  branchCode: string
) {
  const evaluationCode = generateCode('EVL', branchCode);
  
  return await prisma.doctorEvaluation.create({
    data: {
      evaluationCode,
      treatmentSessionId: sessionId,
      subjective: 'Merasa lebih segar dan tidak pusing',
      objective: 'Tekanan darah menurun, SpO2 meningkat',
      assessment: 'Hipertensi terkontrol',
      plan: 'Lanjutkan terapi infus, kontrol tekanan darah rutin',
      generalNotes: 'Pasien merespon baik terhadap terapi',
      writtenBy: doctorId,
    },
  });
}

// Main function: Create complete session
async function createCompleteSession(
  data: SessionData,
  infusKe: number,
  treatmentDate: Date
) {
  const { memberId, branchId, branchCode, packageId, doctorId, nurseId, adminLayananId } = data;

  // 1. Create encounter
  const encounterCode = generateCode('ENC', branchCode);
  const encounter = await prisma.encounter.create({
    data: {
      encounterCode,
      memberId,
      memberPackageId: packageId,
      branchId,
      doctorId,
      adminLayananId,
      nurseId,
      status: 'CLOSED',
    },
  });

  // 2. Create diagnosis (only for first session)
  let diagnosis = null;
  if (infusKe === 1) {
    diagnosis = await createDiagnosis(encounter.id, doctorId, branchCode);
    // Update diagnosis with memberId
    await prisma.diagnosis.update({
      where: { id: diagnosis.id },
      data: { memberId },
    });
  } else {
    // Use existing diagnosis
    diagnosis = await prisma.diagnosis.findFirst({
      where: {
        memberId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 3. Create treatment session
  const sessionCode = generateCode('SES', branchCode);
  const session = await prisma.treatmentSession.create({
    data: {
      sessionCode,
      encounterId: encounter.id,
      branchId,
      infusKe,
      pelaksanaan: 'ON_SITE',
      treatmentDate,
      adminLayananId,
      doctorId,
      nurseId,
      isCompleted: true,
    },
  });

  // 4. Create therapy plan
  const therapyPlan = await createTherapyPlan(session.id, infusKe, doctorId, branchCode);

  // 5. Create vital signs (before)
  await createVitalSigns(session.id, 'SEBELUM', nurseId);

  // 6. Create infusion execution
  await createInfusion(session.id, therapyPlan.id, nurseId, branchId);

  // 7. Create material usage
  await createMaterialUsage(session.id, nurseId, branchId);

  // 8. Create vital signs (after)
  await createVitalSigns(session.id, 'SESUDAH', nurseId);

  // 9. Create doctor evaluation
  await createEvaluation(session.id, doctorId, branchCode);

  return session;
}

// Main seeding function
export async function seedNewTherapySessions(prisma: PrismaClient) {
  console.log('\n🏥 Seeding NEW therapy sessions with complete data...\n');

  try {
    // Get all branches
    const branches = await prisma.branch.findMany({
      select: {
        id: true,
        branchCode: true,
        name: true,
      },
    });

    let totalSessions = 0;

    for (const branch of branches) {
      console.log(`\n📍 Processing branch: ${branch.name} (${branch.branchCode})\n`);

      // Get staff for this branch
      const doctor = await prisma.user.findFirst({
        where: { branchId: branch.id, role: 'DOCTOR' },
      });

      const nurse = await prisma.user.findFirst({
        where: { branchId: branch.id, role: 'NURSE' },
      });

      const adminLayanan = await prisma.user.findFirst({
        where: { branchId: branch.id, role: 'ADMIN_LAYANAN' },
      });

      if (!doctor || !nurse || !adminLayanan) {
        console.log(`⚠️  Missing staff for ${branch.name}, skipping...`);
        continue;
      }

      // Get members with ACTIVE BASIC packages
      const members = await prisma.member.findMany({
        where: {
          registrationBranchId: branch.id,
          memberPackages: {
            some: {
              status: 'ACTIVE',
              packageType: 'BASIC',
            },
          },
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          memberPackages: {
            where: {
              status: 'ACTIVE',
              packageType: 'BASIC',
            },
            take: 1,
          },
        },
        take: 10, // Limit to 10 members per branch
      });

      console.log(`📋 Found ${members.length} members with ACTIVE BASIC packages\n`);

      // Session distribution: 7, 6, 5, 4, 3 (minimum 3)
      const distributions = [7, 6, 5, 4, 3];
      let distributionIndex = 0;

      for (const member of members) {
        const pkg = member.memberPackages[0];
        if (!pkg) continue;

        const fullName = member.user.profile?.fullName || 'Unknown';
        const sessionsToCreate = distributions[distributionIndex % distributions.length];
        distributionIndex++;

        console.log(`👤 Processing: ${fullName} (${member.memberNo})`);
        console.log(`   Creating ${sessionsToCreate} sessions...`);

        const sessionData: SessionData = {
          memberId: member.id,
          memberNo: member.memberNo,
          fullName,
          packageId: pkg.id,
          packageCode: pkg.packageCode,
          totalSessions: pkg.totalSessions,
          branchId: branch.id,
          branchCode: branch.branchCode,
          doctorId: doctor.id,
          nurseId: nurse.id,
          adminLayananId: adminLayanan.id,
        };

        // Create sessions
        for (let i = 1; i <= sessionsToCreate; i++) {
          const treatmentDate = new Date();
          treatmentDate.setDate(treatmentDate.getDate() - (sessionsToCreate - i) * 3); // 3 days apart

          await createCompleteSession(sessionData, i, treatmentDate);
          console.log(`    ✅ Session ${i}/${pkg.totalSessions} completed`);
        }

        // Update package usedSessions
        await prisma.memberPackage.update({
          where: { id: pkg.id },
          data: { usedSessions: sessionsToCreate },
        });

        console.log(`  ✅ Package updated: ${sessionsToCreate}/${pkg.totalSessions} sessions\n`);
        totalSessions += sessionsToCreate;
      }

      console.log(`📊 ${branch.name} Summary: ${totalSessions} sessions created\n`);
    }

    console.log('══════════════════════════════════════════');
    console.log(`✅ Therapy sessions seeding completed!`);
    console.log(`   • Total sessions created: ${totalSessions}`);
    console.log(`   • Distribution: 7/7, 6/7, 5/7, 4/7, 3/7`);
    console.log(`   • All sessions have complete data`);
    console.log('══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error seeding therapy sessions:', error);
    throw error;
  }
}

// Run directly if called as script
if (require.main === module) {
  seedNewTherapySessions(prisma)
    .catch((e) => {
      console.error('❌ Error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
