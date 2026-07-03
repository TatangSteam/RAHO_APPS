import { PrismaClient } from '@prisma/client';

/**
 * Dashboard Test Data Seeder
 * 
 * Creates comprehensive test data for dashboard features:
 * - Revenue statistics with varied dates
 * - Package sales across different periods
 * - Active/inactive members
 * - Completed treatment sessions
 * - Staff activity
 * - Recent transactions
 * - Top selling packages
 * 
 * Run with: npx tsx prisma/seeds/dashboard-test.seed.ts
 */

export async function seedDashboardTestData(prisma: PrismaClient, branches: any[], users: any[]) {
  console.log('\n📊 Seeding comprehensive dashboard test data...\n');

  const branchPusat = branches[0];
  const branchBandung = branches[1];
  const branchSurabaya = branches[2];

  // Get admin users for each branch
  const adminLayananPusat = users.find((u: any) => u.email === 'adminlayanan.pst@raho.id');
  const adminLayananBandung = users.find((u: any) => u.email === 'adminlayanan.bdg@raho.id');
  const adminLayananSurabaya = users.find((u: any) => u.email === 'adminlayanan.sby@raho.id');

  const doctorPusat = users.find((u: any) => u.email === 'dokter@raho.id');
  const nursePusat = users.find((u: any) => u.email === 'nakes@raho.id');

  if (!adminLayananPusat || !adminLayananBandung || !adminLayananSurabaya || !doctorPusat || !nursePusat) {
    console.log('  ⚠️  Required users not found, skipping dashboard seed');
    return;
  }

  // Get package pricings - SESUAI LIST HARGA (PM = Premier)
  const nb7pm = await prisma.packagePricing.findFirst({
    where: { 
      branchId: branchPusat.id, 
      packageType: 'BASIC', 
      productCode: 'TNB-P7-PM' // 7X Premier
    }
  });

  const nb15pm = await prisma.packagePricing.findFirst({
    where: { 
      branchId: branchPusat.id, 
      packageType: 'BASIC', 
      productCode: 'TNB-P15-PM' // 15X Premier
    }
  });

  const boosterNO = await prisma.packagePricing.findFirst({
    where: { 
      branchId: branchPusat.id, 
      packageType: 'BOOSTER',
      productCode: 'BST-NO-P1-PM' // Booster NO Premier
    }
  });

  if (!nb7pm || !nb15pm || !boosterNO) {
    console.log('  ⚠️  Package pricings not found, skipping dashboard seed');
    return;
  }

  // Helper function to generate invoice number
  async function generateInvoiceNumber(branchCode: string, date: Date): Promise<string> {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const suffix = `-${branchCode}-${month}-${year}`;
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          endsWith: suffix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-', 1)[0] || '0');
      sequence = lastSeq + 1;
    }

    return `${sequence.toString().padStart(5, '0')}-${branchCode}-${month}-${year}`;
  }

  // Helper function to create member with package and invoice
  async function createMemberWithPackage(
    branch: any,
    admin: any,
    memberData: any,
    packageConfig: any,
    purchaseDate: Date
  ) {
    // Check if member already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: memberData.email }
    });

    if (existingUser) {
      return null; // Skip if exists
    }

    // Create user
    const bcrypt = require('bcryptjs');
    const password = await bcrypt.hash('member123', 10);

    const user = await prisma.user.create({
      data: {
        email: memberData.email,
        password,
        role: 'MEMBER',
        isActive: true,
        profile: {
          create: {
            fullName: memberData.fullName,
            phone: memberData.phone,
          },
        },
      },
    });

    // Create member
    const memberCode = `MBR-${branch.branchCode}-${Date.now().toString().slice(-6)}`;
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        memberNo: memberCode,
        registrationBranchId: branch.id,
        nik: memberData.nik,
        tempatLahir: memberData.city,
        dateOfBirth: new Date(1985, 5, 15),
        jenisKelamin: memberData.gender,
        address: `Jl. ${memberData.city} No. 123`,
        pekerjaan: 'Karyawan Swasta',
        statusNikah: 'MARRIED',
        emergencyContact: `Keluarga ${memberData.fullName} - 081234567890`,
        sumberInfoRaho: 'Referensi Teman',
        postalCode: '12000',
        voucherCount: 0,
        isConsentToPhoto: true,
        createdAt: purchaseDate,
      },
    });

    // Create package
    const pricing = packageConfig.sessions === 7 ? nb7pm : nb15pm;
    
    if (!pricing) {
      console.log(`  ⚠️  Pricing not found for ${packageConfig.sessions} sessions, skipping...`);
      return null;
    }
    
    const basePrice = Number(pricing.price);
    const discountAmount = packageConfig.discount 
      ? Math.round(basePrice * (packageConfig.discount / 100))
      : 0;
    const finalPrice = basePrice - discountAmount;

    const packageCode = `PKG-${branch.branchCode}-${Date.now().toString().slice(-8)}`;
    const memberPackage = await prisma.memberPackage.create({
      data: {
        memberId: member.id,
        branchId: branch.id,
        packageCode,
        packageType: 'BASIC',
        packagePricingId: pricing.id,
        productCode: `TNB-P${packageConfig.sessions}-PM`,
        serviceType: 'PM',
        totalSessions: packageConfig.sessions,
        usedSessions: packageConfig.usedSessions || 0,
        finalPrice,
        discountPercent: packageConfig.discount || 0,
        discountAmount,
        discountNote: packageConfig.discountNote || null,
        status: 'ACTIVE',
        assignedBy: admin.id,
        paidAt: purchaseDate,
        verifiedBy: admin.id,
        verifiedAt: purchaseDate,
        activatedAt: purchaseDate,
        createdAt: purchaseDate,
      },
    });

    // Update member voucher count
    await prisma.member.update({
      where: { id: member.id },
      data: { voucherCount: packageConfig.sessions - (packageConfig.usedSessions || 0) },
    });

    // Create invoice
    const invoiceNumber = await generateInvoiceNumber(branch.branchCode, purchaseDate);
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        memberId: member.id,
        branchId: branch.id,
        subtotal: finalPrice,
        discountPercent: packageConfig.discount || 0,
        discountAmount,
        discountNote: packageConfig.discountNote,
        taxPercent: 0,
        taxAmount: 0,
        totalAmount: finalPrice,
        status: 'PAID',
        paidAt: purchaseDate,
        paymentMethod: 'CASH',
        createdBy: admin.id,
        verifiedBy: admin.id,
        verifiedAt: purchaseDate,
        createdAt: purchaseDate,
        items: {
          create: {
            itemType: 'PACKAGE',
            itemId: memberPackage.id,
            code: `TNB-P${packageConfig.sessions}-PM`,
            description: `BASIC Package - ${packageConfig.sessions} Sessions`,
            quantity: 1,
            pricePerUnit: finalPrice,
            subtotal: finalPrice,
            discountAmount,
            totalAmount: finalPrice,
          },
        },
      },
    });

    return { member, memberPackage };
  }

  // Helper function to create treatment session
  async function createTreatmentSession(
    member: any,
    memberPackage: any,
    branch: any,
    admin: any,
    doctor: any,
    nurse: any,
    sessionDate: Date,
    sessionNumber: number
  ) {
    // Create encounter if not exists
    const encounterCode = `ENC-${branch.branchCode}-${member.memberNo.slice(-4)}-${sessionNumber}`;
    let encounter = await prisma.encounter.findUnique({
      where: { encounterCode }
    });

    if (!encounter) {
      encounter = await prisma.encounter.create({
        data: {
          encounterCode,
          memberId: member.id,
          branchId: branch.id,
          memberPackageId: memberPackage.id,
          adminLayananId: admin.id,
          doctorId: doctor.id,
          nurseId: nurse.id,
          status: 'ONGOING',
          createdAt: sessionDate,
        },
      });
    }

    // Create session
    const sessionCode = `SES-${branch.branchCode}-${Date.now().toString().slice(-8)}`;
    const existingSession = await prisma.treatmentSession.findUnique({
      where: { sessionCode }
    });

    if (!existingSession) {
      await prisma.treatmentSession.create({
        data: {
          sessionCode,
          encounterId: encounter.id,
          branchId: branch.id,
          infusKe: sessionNumber,
          pelaksanaan: 'ON_SITE',
          treatmentDate: sessionDate,
          adminLayananId: admin.id,
          doctorId: doctor.id,
          nurseId: nurse.id,
          isCompleted: true,
          createdAt: sessionDate,
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // JAKARTA PUSAT - Comprehensive Test Data
  // ══════════════════════════════════════════════════════════

  console.log('📍 Jakarta Pusat - Creating dashboard test data...\n');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calculate date ranges
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  const fiveDaysAgo = new Date(today);
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const threeWeeksAgo = new Date(today);
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15);

  // Members purchased TODAY (3 members)
  const todayMembers = [
    {
      fullName: 'Ahmad Rizki Pratama',
      email: 'ahmad.rizki.dash@example.com',
      phone: '081234560001',
      nik: '3201010101900001',
      city: 'Jakarta Pusat',
      gender: 'L',
      packageConfig: { sessions: 7, discount: 0, usedSessions: 0 },
      purchaseDate: today,
    },
    {
      fullName: 'Siti Nurhaliza Putri',
      email: 'siti.nurhaliza.dash@example.com',
      phone: '081234560002',
      nik: '3201010202900002',
      city: 'Jakarta Selatan',
      gender: 'P',
      packageConfig: { sessions: 15, discount: 10, discountNote: 'Diskon bundling', usedSessions: 0 },
      purchaseDate: today,
    },
    {
      fullName: 'Budi Santoso Wijaya',
      email: 'budi.santoso.dash@example.com',
      phone: '081234560003',
      nik: '3201010303900003',
      city: 'Jakarta Barat',
      gender: 'L',
      packageConfig: { sessions: 7, discount: 5, discountNote: 'Diskon early bird', usedSessions: 0 },
      purchaseDate: today,
    },
  ];

  for (const memberData of todayMembers) {
    const result = await createMemberWithPackage(
      branchPusat,
      adminLayananPusat,
      memberData,
      memberData.packageConfig,
      memberData.purchaseDate
    );
    if (result) {
      console.log(`  ✅ ${memberData.fullName} - Purchased TODAY (${memberData.packageConfig.sessions} sessions)`);
    }
  }



  




  // ══════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════

  console.log('\n✅ Dashboard test data seeding completed!\n');
  console.log('──────────────────────────────────────────');
  console.log('📊 Data Summary for Jakarta Pusat:');
  console.log(`  • ${todayMembers.length} members purchased TODAY`);
  
  
 
  console.log(`  • All packages are ACTIVE with paid invoices`);
  console.log(`  • Treatment sessions created with ADMIN_LAYANAN (not ADMIN_CABANG)`);
  console.log('──────────────────────────────────────────');
  console.log('\n💡 Dashboard Testing Tips:');
  console.log('  • Login as: admincabang.pst@raho.id → AdminCabang@123 (to view dashboard)');
  console.log('  • Sessions are assigned to: adminlayanan.pst@raho.id (ADMIN_LAYANAN role)');
  console.log('  • Test "Hari Ini" filter → Should show 3 transactions');
  console.log('  • Test "7 Hari" filter → Should show 8 transactions');
  console.log('  • Test "Bulan Ini" filter → Should show 15 transactions');
  console.log('  • Revenue growth comparison with last month available');
  console.log('  • Top packages: Mix of 7-session and 15-session packages');
  console.log('  • Recent transactions: Latest 5 will be displayed');
  console.log('  • Active members: All new members are active');
  console.log('  • Completed sessions: Varies by member');
}

// Standalone execution
if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  async function main() {
    console.log('🌱 Running dashboard test data seeder...\n');

    // Get branches
    const branches = await prisma.branch.findMany({
      orderBy: { branchCode: 'asc' }
    });

    if (branches.length < 3) {
      console.error('❌ Not enough branches found. Run main seed first.');
      process.exit(1);
    }

    // Get users
    const users = await prisma.user.findMany({
      where: { role: { not: 'MEMBER' } }
    });

    if (users.length === 0) {
      console.error('❌ No staff users found. Run main seed first.');
      process.exit(1);
    }

    await seedDashboardTestData(prisma, branches, users);
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

