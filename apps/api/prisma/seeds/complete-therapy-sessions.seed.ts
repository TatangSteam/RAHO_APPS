import { PrismaClient, DiagnosisCategory, SessionType, VitalType, VitalTiming, BottleType } from '@prisma/client';

/**
 * Seed complete therapy sessions with:
 * - Diagnosis (per member)
 * - Therapy Plan (per member - used as template for all sessions)
 * - Treatment Sessions (multiple sessions using the same therapy plan)
 * - Doctor Evaluation
 * 
 * THERAPY PLAN STRUCTURE:
 * - ✅ 1 MEMBER = 1 THERAPY PLAN (rencana terapi untuk member)
 * - ✅ 3 SESI TERAPI = MENGGUNAKAN THERAPY PLAN YANG SAMA
 * - ✅ Therapy plan dibuat SEBELUM sesi terapi
 * - ✅ Therapy plan linked to member (memberId), NOT to session
 * 
 * IMPORTANT:
 * - Minimum 3 sessions for all members with diagnosis
 * - Distribution: 7/7, 6/7, 5/7, 4/7, 3/7 (NEVER 0/7, 1/7, or 2/7)
 * - Idempotent: Can be run multiple times without creating duplicates
 * - Checks existing data before creating new records
 */
export async function seedCompleteTherapySessions(prisma: PrismaClient) {
  console.log('\n🏥 Seeding complete therapy sessions with diagnosis and therapy plans...\n');

  // Get all branches
  const branches = await prisma.branch.findMany();
  
  if (branches.length === 0) {
    console.log('⚠️  No branches found, skipping therapy sessions');
    return;
  }

  let totalSessionCount = 0;
  let totalEncounterCount = 0;
  let totalDiagnosisCount = 0;
  let totalSkippedCount = 0;

  // Process each branch
  for (const branch of branches) {
    console.log(`\n📍 Processing branch: ${branch.name} (${branch.branchCode})\n`);

    // Get staff for this branch
    const doctor = await prisma.user.findFirst({
      where: { role: 'DOCTOR', branchId: branch.id }
    });
    
    const nurse = await prisma.user.findFirst({
      where: { role: 'NURSE', branchId: branch.id }
    });
    
    const adminLayanan = await prisma.user.findFirst({
      where: { role: 'ADMIN_LAYANAN', branchId: branch.id }
    });

    if (!doctor || !nurse || !adminLayanan) {
      console.log(`⚠️  Required staff not found for ${branch.name}, skipping...\n`);
      continue;
    }

  // Get ONLY FIRST 3 members with ACTIVE BASIC packages for this branch
  const membersWithPackages = await prisma.member.findMany({
    where: {
      registrationBranchId: branch.id,
      memberPackages: {
        some: {
          status: 'ACTIVE',
          packageType: 'BASIC'
        }
      }
    },
    include: {
      user: {
        include: {
          profile: true
        }
      },
      memberPackages: {
        where: {
          status: 'ACTIVE',
          packageType: 'BASIC'
        },
        take: 1
      }
    },
    take: 3 // ONLY 3 members per branch
  });

  console.log(`📋 Found ${membersWithPackages.length} members with active packages\n`);

  if (membersWithPackages.length === 0) {
    console.log(`No members found for ${branch.name}\n`);
    continue;
  }

  let sessionCount = 0;
  let encounterCount = 0;
  let diagnosisCount = 0;
  let skippedCount = 0;
  let memberIndex = 0;

  for (const member of membersWithPackages) {
    const memberPackage = member.memberPackages[0];
    if (!memberPackage) continue;

    const memberName = member.user.profile?.fullName || 'Unknown';
    
    // ============================================================
    // CHECK IF MEMBER ALREADY HAS THERAPY DATA
    // ============================================================
    const existingDiagnosis = await prisma.diagnosis.findFirst({
      where: { memberId: member.id }
    });

    const existingEncounter = await prisma.encounter.findFirst({
      where: { 
        memberId: member.id,
        memberPackageId: memberPackage.id
      }
    });

    const existingSessions = await prisma.treatmentSession.count({
      where: {
        encounter: {
          memberId: member.id,
          memberPackageId: memberPackage.id
        }
      }
    });

    // If member already has diagnosis and at least 3 sessions, skip
    if (existingDiagnosis && existingSessions >= 3) {
      console.log(`⏭️  Skipping: ${memberName} (${member.memberNo}) - Already has ${existingSessions} sessions`);
      skippedCount++;
      memberIndex++;
      continue;
    }

    console.log(`👤 Processing: ${memberName} (${member.memberNo})`);

    // ============================================================
    // 1. CREATE OR GET DIAGNOSIS
    // ============================================================
    let diagnosis = existingDiagnosis;
    
    if (!diagnosis) {
      const diagnosisCode = `DGN-${branch.branchCode}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      diagnosis = await prisma.diagnosis.create({
        data: {
          diagnosisCode,
          memberId: member.id,
          doktorPemeriksa: doctor.id,
          diagnosa: 'Hipertensi Grade 2 dengan komplikasi kardiovaskular. Pasien mengeluhkan sakit kepala, pusing, dan mudah lelah. Riwayat hipertensi 5 tahun.',
          kategoriDiagnosa: DiagnosisCategory.HIPERTENSI,
          icdPrimer: 'I10',
          icdSekunder: 'I11.9',
          keluhanRiwayatSekarang: 'Pasien mengeluhkan sakit kepala hebat sejak 2 minggu terakhir, terutama di pagi hari. Disertai pusing berputar dan mudah lelah saat beraktivitas ringan. Tekanan darah tidak terkontrol meskipun sudah minum obat rutin.',
          riwayatPenyakitTerdahulu: 'Hipertensi sejak 5 tahun yang lalu, diabetes mellitus tipe 2 sejak 3 tahun yang lalu, riwayat stroke ringan 1 tahun yang lalu.',
          riwayatSosialKebiasaan: 'Merokok 1 bungkus per hari selama 20 tahun (sudah berhenti 6 bulan), konsumsi kopi 3-4 cangkir per hari, jarang olahraga, pola makan tinggi garam.',
          riwayatPengobatan: 'Amlodipine 10mg 1x1, Valsartan 80mg 1x1, Metformin 500mg 2x1, Aspirin 100mg 1x1',
          pemeriksaanFisik: 'TD: 180/110 mmHg, Nadi: 92x/menit regular, RR: 20x/menit, Suhu: 36.8°C, SpO2: 97%. Kepala: normocephali, Mata: konjungtiva anemis (-/-), sklera ikterik (-/-), Thorax: simetris, suara napas vesikuler, ronkhi (-/-), wheezing (-/-), Cor: S1S2 reguler, murmur (-), gallop (-), Abdomen: supel, BU(+) normal, nyeri tekan (-), Ekstremitas: akral hangat, CRT <2 detik, edema (-/-)',
          pemeriksaanTambahan: {
            'GDP': '145 mg/dL',
            'GD2PP': '198 mg/dL',
            'HbA1c': '7.2%',
            'Cholesterol': '245 mg/dL',
            'LDL': '165 mg/dL',
            'HDL': '38 mg/dL',
            'Triglyceride': '210 mg/dL',
            'Ureum': '45 mg/dL',
            'Creatinine': '1.2 mg/dL',
            'EKG': 'Sinus rhythm, HR 92 bpm, LVH (+)',
            'Echo': 'EF 55%, LVH (+), diastolic dysfunction grade 1'
          }
        }
      });

      diagnosisCount++;
      console.log(`  ✅ Diagnosis created: ${diagnosisCode}`);
    } else {
      console.log(`  ℹ️  Using existing diagnosis: ${diagnosis.diagnosisCode}`);
    }

    // ============================================================
    // 2. CREATE OR GET ENCOUNTER
    // ============================================================
    let encounter = existingEncounter;
    
    if (!encounter) {
      const encounterCode = `ENC-${branch.branchCode}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      encounter = await prisma.encounter.create({
        data: {
          encounterCode,
          memberId: member.id,
          branchId: branch.id,
          memberPackageId: memberPackage.id,
          adminLayananId: adminLayanan.id,
          doctorId: doctor.id,
          nurseId: nurse.id,
          status: 'ONGOING',
          diagnoses: {
            connect: { id: diagnosis.id }
          }
        }
      });

      encounterCount++;
      console.log(`  ✅ Encounter created: ${encounterCode}`);
    } else {
      console.log(`  ℹ️  Using existing encounter: ${encounter.encounterCode}`);
    }

    // ============================================================
    // 3. CREATE THERAPY PLAN FOR MEMBER (Rencana Terapi)
    // This therapy plan will be used for ALL sessions of this member
    // ============================================================
    let therapyPlan = await prisma.therapyPlan.findFirst({
      where: { 
        memberId: member.id,
        treatmentSessionId: null // Member-level therapy plan
      }
    });

    if (!therapyPlan) {
      const therapyPlanCode = `TPL-${branch.branchCode}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      therapyPlan = await prisma.therapyPlan.create({
        data: {
          planCode: therapyPlanCode,
          memberId: member.id,
          treatmentSessionId: null, // ✅ NULL = Member-level therapy plan
          keterangan: 'Rencana Terapi Nano Bubble untuk member ini. Fokus pada perbaikan sirkulasi dan penurunan tekanan darah. Kombinasi HHO, NO, dan O2 untuk meningkatkan oksigenasi jaringan.',
          ifa250: 1, // IFA 250ml - 1 botol per terapi (default)
          hho: 300,
          h2: 200,
          no: 250,
          o2: 300,
          o3: 150,
          edta: 100,
          mb: 50,
          jmlNb: 1850
        }
      });

      console.log(`  ✅ Therapy plan created: ${therapyPlanCode}`);
    } else {
      console.log(`  ℹ️  Using existing therapy plan: ${therapyPlan.planCode}`);
    }

    // ============================================================
    // 4. CREATE TREATMENT SESSIONS (EXACTLY 3 FOR ALL)
    // ============================================================
    const totalSessions = memberPackage.totalSessions;
    
    // Simple: All members get exactly 3 sessions
    // This makes data consistent and easy to understand
    const sessionsToComplete = Math.min(totalSessions, 3);

    // Create sessions starting from existingSessions + 1
    for (let sessionNum = existingSessions + 1; sessionNum <= sessionsToComplete; sessionNum++) {
      const sessionCode = `SES-${branch.branchCode}-${Date.now()}-${sessionNum}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      // Calculate session date (spread over past days)
      const daysAgo = sessionsToComplete - sessionNum;
      const sessionDate = new Date();
      sessionDate.setDate(sessionDate.getDate() - daysAgo);
      sessionDate.setHours(9 + (sessionNum % 8), 0, 0, 0);

      const session = await prisma.treatmentSession.create({
        data: {
          sessionCode,
          encounterId: encounter.id,
          branchId: branch.id,
          infusKe: sessionNum,
          pelaksanaan: sessionNum % 3 === 0 ? SessionType.HOME_CARE : SessionType.ON_SITE,
          treatmentDate: sessionDate,
          isCompleted: true,
          adminLayananId: adminLayanan.id,
          doctorId: doctor.id,
          nurseId: nurse.id
        }
      });

      // 4a. SKIP - Therapy plan sudah dibuat di level member
      // Sesi ini akan menggunakan therapy plan yang sudah ada
      // (therapy plan linked to member, not to session)

      // 4b. CREATE VITAL SIGNS (before and after)
      const vitals = [
        { type: VitalType.SISTOL, timing: VitalTiming.SEBELUM, value: 180 - (sessionNum * 5) },
        { type: VitalType.DIASTOL, timing: VitalTiming.SEBELUM, value: 110 - (sessionNum * 3) },
        { type: VitalType.HR, timing: VitalTiming.SEBELUM, value: 92 - (sessionNum * 2) },
        { type: VitalType.SATURASI, timing: VitalTiming.SEBELUM, value: 96 + (sessionNum * 0.3) },
        { type: VitalType.PI, timing: VitalTiming.SEBELUM, value: 3.5 + (sessionNum * 0.2) },
        { type: VitalType.SISTOL, timing: VitalTiming.SESUDAH, value: 160 - (sessionNum * 5) },
        { type: VitalType.DIASTOL, timing: VitalTiming.SESUDAH, value: 95 - (sessionNum * 3) },
        { type: VitalType.HR, timing: VitalTiming.SESUDAH, value: 85 - (sessionNum * 2) },
        { type: VitalType.SATURASI, timing: VitalTiming.SESUDAH, value: 98 + (sessionNum * 0.2) },
        { type: VitalType.PI, timing: VitalTiming.SESUDAH, value: 5.0 + (sessionNum * 0.3) },
      ];

      for (const vital of vitals) {
        await prisma.vitalSign.create({
          data: {
            treatmentSessionId: session.id,
            pencatatan: vital.type,
            waktuCatat: vital.timing,
            value: vital.value,
            unit: vital.type === VitalType.SATURASI || vital.type === VitalType.PI ? '%' : 'mmHg',
            recordedBy: nurse.id
          }
        });
      }

      // 4c. CREATE INFUSION EXECUTION (using therapy plan values)
      // NOTE: Material usage akan AUTO-CREATE dari infusion service
      // Tidak perlu manual create material usage di sini
      await prisma.infusionExecution.create({
        data: {
          treatmentSessionId: session.id,
          ifa250: therapyPlan.ifa250,
          ifa500: therapyPlan.ifa500,
          hho: therapyPlan.hho,
          h2: therapyPlan.h2,
          no: therapyPlan.no,
          o2: therapyPlan.o2,
          o3: therapyPlan.o3,
          edta: therapyPlan.edta,
          mb: therapyPlan.mb,
          jmlNb: therapyPlan.jmlNb,
          bottleType: BottleType.IFA,
          jenisCairan: 'NaCl 0.9%',
          volumeCarrier: 500,
          jumlahJarum: 1,
          tanggalProduksi: new Date(sessionDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          deviationNotes: sessionNum === 1 ? 'Pasien sedikit nervous pada sesi pertama, dilakukan pendekatan psikologis' : null
        }
      });

      // 4d. MATERIAL USAGE - SKIPPED
      // Material usage akan otomatis dibuat oleh infusion service
      // ketika infusion execution dibuat melalui API endpoint
      // Untuk seeding, kita skip manual creation karena:
      // 1. Infusion service sudah handle auto-create
      // 2. Menghindari duplikasi
      // 3. Konsisten dengan flow production

      // 4e. CREATE DOCTOR EVALUATION
      const evaluationCode = `EVL-${branch.branchCode}-${Date.now()}-S${sessionNum}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      const evaluations = [
        {
          subjective: 'Pasien mengeluhkan sakit kepala berkurang, masih terasa pusing ringan di pagi hari',
          objective: 'TD 180/110 → 160/95 mmHg, HR 92 → 85 bpm, SpO2 96% → 98%',
          assessment: 'Hipertensi grade 2, respons awal terapi baik, tekanan darah mulai turun',
          plan: 'Lanjutkan terapi nano bubble, monitoring ketat TD, evaluasi dosis obat antihipertensi',
          notes: 'Pasien kooperatif, edukasi pola hidup sehat'
        },
        {
          subjective: 'Sakit kepala berkurang signifikan, pusing sudah jarang, stamina membaik',
          objective: 'TD 175/107 → 155/92 mmHg, HR 90 → 83 bpm, SpO2 96.3% → 98.2%',
          assessment: 'Respons terapi sangat baik, tekanan darah terkontrol lebih baik',
          plan: 'Lanjutkan terapi, tingkatkan dosis HHO dan NO, evaluasi lab follow-up',
          notes: 'Pasien mulai rutin olahraga ringan'
        },
        {
          subjective: 'Kondisi membaik, sakit kepala hilang, aktivitas sehari-hari normal',
          objective: 'TD 170/104 → 150/89 mmHg, HR 88 → 81 bpm, SpO2 96.6% → 98.4%',
          assessment: 'Hipertensi terkontrol, fungsi kardiovaskular membaik',
          plan: 'Maintenance therapy, evaluasi pengurangan dosis obat',
          notes: 'Pasien sangat puas dengan hasil terapi'
        }
      ];

      const evalIndex = Math.min(sessionNum - 1, evaluations.length - 1);
      const evalData = evaluations[evalIndex];

      await prisma.doctorEvaluation.create({
        data: {
          evaluationCode,
          treatmentSessionId: session.id,
          subjective: evalData.subjective,
          objective: evalData.objective,
          assessment: evalData.assessment,
          plan: evalData.plan,
          generalNotes: evalData.notes,
          writtenBy: doctor.id
        }
      });

      sessionCount++;
      console.log(`    ✅ Session ${sessionNum}/${totalSessions} completed with full data`);
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Update package used sessions
    await prisma.memberPackage.update({
      where: { id: memberPackage.id },
      data: { usedSessions: sessionsToComplete }
    });

    // Update encounter status if all sessions completed
    if (sessionsToComplete >= totalSessions) {
      await prisma.encounter.update({
        where: { id: encounter.id },
        data: { status: 'CLOSED' }
      });
    }

    console.log(`  ✅ Package updated: ${sessionsToComplete}/${totalSessions} sessions completed\n`);
    
    memberIndex++;
  }

  // Update totals for this branch
  totalSessionCount += sessionCount;
  totalEncounterCount += encounterCount;
  totalDiagnosisCount += diagnosisCount;
  totalSkippedCount += skippedCount;

  console.log(`📊 ${branch.name} Summary:`);
  console.log(`   • ${diagnosisCount} new diagnoses`);
  console.log(`   • ${encounterCount} new encounters`);
  console.log(`   • ${sessionCount} new sessions`);
  console.log(`   • ${skippedCount} members skipped\n`);
  }

  console.log('══════════════════════════════════════════');
  console.log(`✅ Complete therapy sessions seeding finished!`);
  console.log(`   • ${totalDiagnosisCount} total new diagnoses created`);
  console.log(`   • ${totalEncounterCount} total new encounters created`);
  console.log(`   • ${totalSessionCount} total new treatment sessions created`);
  console.log(`   • ${totalSkippedCount} total members skipped (already have data)`);
  console.log(`   ℹ️  All members have exactly 3 sessions (3/7)`);
  console.log(`   ℹ️  Only 3 members per branch for simple testing`);
  console.log(`   ℹ️  Seeding is idempotent - safe to run multiple times`);
  console.log('══════════════════════════════════════════\n');
}
