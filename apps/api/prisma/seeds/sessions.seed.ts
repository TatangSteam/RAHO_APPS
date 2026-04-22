import { PrismaClient, PackageType, PackageStatus, SessionType, EncounterStatus } from '@prisma/client';
import { generateEncounterCode, generateSessionCode } from '../../src/utils/codeGenerator';

export async function seedSessions(
  prisma: PrismaClient,
  members: { id: string; memberNo: string }[],
  branchId: string,
  branchCode: string,
  adminLayananId: string,
  doctorId: string,
  nurseId: string,
  count: number = 5
) {
  console.log(`🔄 Seeding ${count} treatment sessions for ${branchCode}...`);

  let sessionCounter = 1;
  let encounterCounter = 1;
  const today = new Date();

  for (let i = 0; i < Math.min(count, members.length); i++) {
    const member = members[i];

    // Get member's BASIC package
    const basicPackage = await prisma.memberPackage.findFirst({
      where: {
        memberId: member.id,
        packageType: PackageType.BASIC,
        status: PackageStatus.ACTIVE,
      },
    });

    if (!basicPackage) {
      console.log(`  ⚠️  Member ${member.memberNo} tidak punya BASIC package, skip`);
      continue;
    }

    // Get member's BOOSTER package (if any)
    const boosterPackage = await prisma.memberPackage.findFirst({
      where: {
        memberId: member.id,
        packageType: PackageType.BOOSTER,
        status: PackageStatus.ACTIVE,
      },
    });

    // Create encounter
    const encounterCode = `ENC-${branchCode}-2604-${String(encounterCounter).padStart(5, '0')}`;
    encounterCounter++;

    let encounter = await prisma.encounter.findUnique({ where: { encounterCode } });

    if (!encounter) {
      encounter = await prisma.encounter.create({
        data: {
          encounterCode,
          memberId: member.id,
          branchId: branchId,
          memberPackageId: basicPackage.id,
          adminLayananId,
          doctorId,
          nurseId,
          status: EncounterStatus.ONGOING,
        },
      });
    }

    // Create therapy plan first (use upsert for safe re-running)
    const planCode = `TP-${branchCode}-2604-${String(i + 1).padStart(5, '0')}`;
    const therapyPlan = await prisma.therapyPlan.upsert({
      where: { planCode },
      update: {},
      create: {
        planCode,
        memberId: member.id,
        ifa: 2,
        hho: 3,
        h2: 3,
        no: 1,
        gaso: 1,
        o2: 2,
        o3: 1,
        edta: 2,
        mb: 1,
        h2s: 1,
        kcl: 1,
        jmlNb: 500,
      },
    });

    // Create session
    const sessionCode = `SES-${branchCode}-${String(i + 1).padStart(2, '0')}-2604-${String(sessionCounter).padStart(5, '0')}`;
    sessionCounter++;

    const existingSession = await prisma.treatmentSession.findUnique({ where: { sessionCode } });

    if (!existingSession) {
      const session = await prisma.treatmentSession.create({
        data: {
          sessionCode,
          encounterId: encounter.id,
          branchId: branchId,
          infusKe: i + 1,
          pelaksanaan: i % 2 === 0 ? SessionType.ON_SITE : SessionType.HOME_CARE,
          treatmentDate: today,
          adminLayananId,
          doctorId,
          nurseId,
          boosterPackageId: boosterPackage?.id, // Assign booster if available
          isCompleted: false,
        },
      });

      // Link therapy plan to session (use session.id, not sessionCode)
      await prisma.therapyPlan.update({
        where: { id: therapyPlan.id },
        data: { treatmentSessionId: session.id },
      });

      console.log(`  ✅ Session ${sessionCode} ${boosterPackage ? '(with booster)' : '(no booster)'}`);
    }
  }

  console.log(`✅ Treatment sessions: ${count} sessions created for ${branchCode}`);
}

export async function seedBoosterPackagesForMembers(
  prisma: PrismaClient,
  members: { id: string; memberNo: string }[],
  branchId: string,
  branchCode: string,
  adminLayananId: string,
  boosterCount: number = 10
) {
  console.log(`💉 Seeding ${boosterCount} booster packages for ${branchCode}...`);

  let packageCounter = 1;
  const boosterTypes = ['HHO', 'NO2'] as const;

  for (let i = 0; i < Math.min(boosterCount, members.length); i++) {
    const member = members[i];
    const boosterType = boosterTypes[i % 2]; // Alternate between HHO and NO2
    
    // Distribute sessions: 1, 7, 15 only (official pricing)
    const sessionOptions = [1, 7, 15];
    const sessions = sessionOptions[i % sessionOptions.length];
    const price = sessions * 1_000_000; // Official pricing: 1 sesi = 1M

    const packageCode = `PKG-${branchCode}-BST-${boosterType}-2604-${String(packageCounter).padStart(5, '0')}`;
    packageCounter++;

    // Check if package already exists
    const existingPackage = await prisma.memberPackage.findUnique({ where: { packageCode } });

    if (!existingPackage) {
      await prisma.memberPackage.create({
        data: {
          packageCode,
          memberId: member.id,
          branchId: branchId,
          packageType: PackageType.BOOSTER,
          boosterType: boosterType, // Set boosterType at MemberPackage level
          totalSessions: sessions,
          usedSessions: 0,
          finalPrice: price,
          status: PackageStatus.ACTIVE,
          assignedBy: adminLayananId,
          verifiedBy: adminLayananId,
          paidAt: new Date(),
          verifiedAt: new Date(),
          activatedAt: new Date(),
        },
      });

      console.log(`  ✅ Booster ${boosterType} ${sessions} sesi for ${member.memberNo}`);
    }
  }

  console.log(`✅ Booster packages: ${boosterCount} packages created`);
}
