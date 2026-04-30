import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Seed complete member data across all branches
 * - Creates 30 members total (10 per branch)
 * - Each branch has isolated member data
 * - Assigns various package combinations (BASIC, BOOSTER, BUNDLED)
 * - Some packages are ACTIVE (paid), some PENDING_PAYMENT
 */

export async function seedMembersMultiBranch(prisma: PrismaClient, branches: any[], users: any[]) {
  console.log('📊 Seeding complete member data across all branches...');

  // Get all branches
  const branchPusat = branches[0];
  const branchBandung = branches[1];
  const branchSurabaya = branches[2];

  if (!branchPusat || !branchBandung || !branchSurabaya) {
    throw new Error('Not all branches found for member seeding');
  }

  console.log(`\n👥 Creating 30 members across 3 branches (10 per branch)...\n`);

  // Member data for each branch
  const membersByBranch = [
    {
      branch: branchPusat,
      branchName: 'Pusat',
      adminEmail: 'adminlayanan.pst@raho.id',
      members: [
        { fullName: 'Budi Santoso', email: 'budi.pst@example.com', phone: '081234567801', nik: '3201011503850001', city: 'Jakarta Pusat' },
        { fullName: 'Siti Nurhaliza', email: 'siti.pst@example.com', phone: '081234567803', nik: '3201012207900002', city: 'Jakarta Selatan' },
        { fullName: 'Agus Wijaya', email: 'agus.pst@example.com', phone: '081234567805', nik: '3201013011780003', city: 'Jakarta Barat' },
        { fullName: 'Rudi Hartono', email: 'rudi.pst@example.com', phone: '081234567809', nik: '3201012509820005', city: 'Jakarta Selatan' },
        { fullName: 'Maya Sari', email: 'maya.pst@example.com', phone: '081234567811', nik: '3201011012880006', city: 'Jakarta Selatan' },
        { fullName: 'Rina Kusuma', email: 'rina.pst@example.com', phone: '081234567815', nik: '3201011408870008', city: 'Jakarta Pusat' },
        { fullName: 'Hendra Gunawan', email: 'hendra.pst@example.com', phone: '081234567817', nik: '3201012006800009', city: 'Jakarta Pusat' },
        { fullName: 'Fitri Handayani', email: 'fitri.pst@example.com', phone: '081234567819', nik: '3201011005930010', city: 'Jakarta Selatan' },
      ]
    },
    {
      branch: branchBandung,
      branchName: 'Bandung',
      adminEmail: 'adminlayanan.bdg@raho.id',
      members: [
        { fullName: 'Bambang Sutrisno', email: 'bambang.bdg@example.com', phone: '082234567801', nik: '3204011503850011', city: 'Bandung' },
        { fullName: 'Sinta Wijaya', email: 'sinta.bdg@example.com', phone: '082234567803', nik: '3204012207900012', city: 'Bandung' },
        { fullName: 'Ahmad Hidayat', email: 'ahmad.bdg@example.com', phone: '082234567805', nik: '3204013011780013', city: 'Cimahi' },
        { fullName: 'Dina Kusuma', email: 'dina.bdg@example.com', phone: '082234567807', nik: '3204011805950014', city: 'Bandung' },
        { fullName: 'Rizki Pratama', email: 'rizki.bdg@example.com', phone: '082234567809', nik: '3204012509820015', city: 'Bandung' },
        { fullName: 'Nita Sari', email: 'nita.bdg@example.com', phone: '082234567811', nik: '3204011012880016', city: 'Bandung' },
        { fullName: 'Budi Santoso', email: 'budi2.bdg@example.com', phone: '082234567813', nik: '3204010804920017', city: 'Lembang' },
        { fullName: 'Ratna Kusuma', email: 'ratna.bdg@example.com', phone: '082234567815', nik: '3204011408870018', city: 'Bandung' },
        { fullName: 'Hendra Wijaya', email: 'hendra.bdg@example.com', phone: '082234567817', nik: '3204012006800019', city: 'Bandung' },
        { fullName: 'Fiona Handayani', email: 'fiona.bdg@example.com', phone: '082234567819', nik: '3204011005930020', city: 'Bandung' },
      ]
    },
    {
      branch: branchSurabaya,
      branchName: 'Surabaya',
      adminEmail: 'adminlayanan.sby@raho.id',
      members: [
        { fullName: 'Bambang Setiawan', email: 'bambang.sby@example.com', phone: '083234567801', nik: '3515011503850021', city: 'Surabaya' },
        { fullName: 'Sinta Rahayu', email: 'sinta.sby@example.com', phone: '083234567803', nik: '3515012207900022', city: 'Surabaya' },
        { fullName: 'Ahmad Suryanto', email: 'ahmad.sby@example.com', phone: '083234567805', nik: '3515013011780023', city: 'Sidoarjo' },
        { fullName: 'Dina Wijaya', email: 'dina.sby@example.com', phone: '083234567807', nik: '3515011805950024', city: 'Surabaya' },
        { fullName: 'Rizki Hermawan', email: 'rizki.sby@example.com', phone: '083234567809', nik: '3515012509820025', city: 'Surabaya' },
        { fullName: 'Nita Kusuma', email: 'nita.sby@example.com', phone: '083234567811', nik: '3515011012880026', city: 'Surabaya' },
        { fullName: 'Budi Hartono', email: 'budi2.sby@example.com', phone: '083234567813', nik: '3515010804920027', city: 'Gresik' },
        { fullName: 'Ratna Wijaya', email: 'ratna.sby@example.com', phone: '083234567815', nik: '3515011408870028', city: 'Surabaya' },
        { fullName: 'Hendra Santoso', email: 'hendra.sby@example.com', phone: '083234567817', nik: '3515012006800029', city: 'Surabaya' },
        { fullName: 'Fiona Rahayu', email: 'fiona.sby@example.com', phone: '083234567819', nik: '3515011005930030', city: 'Surabaya' },
      ]
    }
  ];

  // Process each branch
  for (const branchData of membersByBranch) {
    const { branch, branchName, adminEmail, members } = branchData;

    // Get admin user for this branch
    const adminUser = users.find((u: any) => u.email === adminEmail);
    if (!adminUser) {
      console.log(`  ⚠️  Admin user not found for ${branchName}, skipping...`);
      continue;
    }

    // Get package pricings for this branch - SESUAI LIST HARGA (PM = Premiere)
    const nb7pm = await prisma.packagePricing.findFirst({
      where: { 
        branchId: branch.id, 
        packageType: 'BASIC', 
        productCode: 'TNB-P7-PM' // 7X Premiere
      }
    });

    const boosterNO = await prisma.packagePricing.findFirst({
      where: { 
        branchId: branch.id, 
        packageType: 'BOOSTER',
        productCode: 'BST-NO-P1-PM' // Booster NO Premiere
      }
    });

    if (!nb7pm || !boosterNO) {
      console.log(`  ⚠️  Package pricings not found for ${branchName}, skipping...`);
      continue;
    }

    console.log(`\n📍 ${branchName} Branch - Creating 10 members...\n`);

    // Package configurations for variety
    // All packages are BASIC or BUNDLE to ensure therapy sessions are created
    const packageConfigs = [
      { type: 'BUNDLE', status: 'ACTIVE', discountPercent: 10, discountNote: 'Diskon bundling' },
      { type: 'BASIC', status: 'ACTIVE', discountPercent: 0, discountNote: '' },
      { type: 'BASIC', status: 'PENDING_PAYMENT', discountPercent: 0, discountNote: '' },
      { type: 'BASIC', status: 'ACTIVE', discountPercent: 0, discountNote: '' }, // Changed from BOOSTER
      { type: 'BUNDLE', status: 'ACTIVE', discountPercent: 15, discountNote: 'Diskon loyalitas' },
      { type: 'BASIC', status: 'ACTIVE', discountPercent: 5, discountNote: 'Diskon early bird' },
      { type: 'BASIC', status: 'ACTIVE', discountPercent: 0, discountNote: '' }, // Changed from BOOSTER
      { type: 'BUNDLE', status: 'ACTIVE', discountPercent: 0, discountNote: '' },
      { type: 'BASIC', status: 'ACTIVE', discountPercent: 0, discountNote: '' },
      { type: 'BUNDLE', status: 'PENDING_PAYMENT', discountPercent: 10, discountNote: 'Diskon bundling' },
    ];

    // Create members for this branch
    for (let i = 0; i < members.length; i++) {
      const data = members[i];
      const memberCode = `MBR-${branch.branchCode}-${(i + 1).toString().padStart(4, '0')}`;
      const password = await bcrypt.hash('member123', 10);

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (user) {
        console.log(`  ⏭️  ${data.fullName} - already exists, skipping...`);
        continue;
      }

      // Create user account
      user = await prisma.user.create({
        data: {
          email: data.email,
          password,
          role: 'MEMBER',
          isActive: true,
          profile: {
            create: {
              fullName: data.fullName,
              phone: data.phone,
            },
          },
        },
      });

      // Create member with complete data
      const member = await prisma.member.create({
        data: {
          userId: user.id,
          memberNo: memberCode,
          registrationBranchId: branch.id,
          nik: data.nik,
          tempatLahir: data.city,
          dateOfBirth: new Date(1985 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          jenisKelamin: Math.random() > 0.5 ? 'L' : 'P',
          address: `Jl. ${data.city} No. ${(i + 1) * 100}`,
          pekerjaan: 'Karyawan Swasta',
          statusNikah: ['MARRIED', 'SINGLE', 'DIVORCED'][Math.floor(Math.random() * 3)],
          emergencyContact: `Keluarga ${data.fullName} - 08${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
          sumberInfoRaho: 'Referensi Teman',
          postalCode: '12000',
          voucherCount: 0,
          isConsentToPhoto: true,
        },
      });

      console.log(`  ✅ ${data.fullName} (${memberCode})`);

      // Assign package
      const pkgConfig = packageConfigs[i];
      const now = new Date();
      const purchaseGroupId = pkgConfig.type === 'BUNDLE' 
        ? `GRP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
        : undefined;

      if (pkgConfig.type === 'BASIC' || pkgConfig.type === 'BUNDLE') {
        const basicPrice = Number(nb7pm.price);
        const discountPercent = (pkgConfig as any).discountPercent || 0;
        const basicDiscount = discountPercent 
          ? Math.round(basicPrice * (discountPercent / 100))
          : 0;
        const basicFinalPrice = basicPrice - basicDiscount;

        const basicPackage = await prisma.memberPackage.create({
          data: {
            memberId: member.id,
            branchId: branch.id,
            packageCode: `PKG-${branch.branchCode}-BSC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            packageType: 'BASIC',
            packagePricingId: nb7pm.id,
            productCode: 'TNB-P7-PM', // PM = Premiere
            serviceType: 'PM',
            totalSessions: nb7pm.totalSessions,
            usedSessions: 0,
            finalPrice: basicFinalPrice,
            discountPercent: (pkgConfig as any).discountPercent || 0,
            discountAmount: basicDiscount,
            discountNote: (pkgConfig as any).discountNote || null,
            status: pkgConfig.status as any,
            assignedBy: adminUser.id,
            purchaseGroupId,
            ...(pkgConfig.status === 'ACTIVE' && {
              paidAt: now,
              verifiedBy: adminUser.id,
              verifiedAt: now,
              activatedAt: now,
            }),
          },
        });

        if (pkgConfig.status === 'ACTIVE') {
          await prisma.member.update({
            where: { id: member.id },
            data: { voucherCount: { increment: nb7pm.totalSessions } },
          });
        }
      }

      if (pkgConfig.type === 'BOOSTER' || pkgConfig.type === 'BUNDLE') {
        // LIST HARGA LAMA - Service Type Pricing (PM = Premiere)
        const SERVICE_TYPE_PRICING: Record<string, number> = {
          PM: 1_000_000,   // Premiere
          PS: 650_000,     // Partnership
          PTY: 600_000,    // Partnership Attiya
          PDA: 65_000,     // Partnership Dr. Abhi (per ml)
          PHC: 750_000,    // Partnership Homecare
        };

        const serviceType = (pkgConfig as any).serviceType || 'PM';
        const boosterType = (pkgConfig as any).boosterType || 'NO';
        const quantity = (pkgConfig as any).quantity || 1;
        const pricePerSession = SERVICE_TYPE_PRICING[serviceType];
        const boosterPrice = pricePerSession * quantity;
        const discountPercent = (pkgConfig as any).discountPercent || 0;
        const boosterDiscount = discountPercent 
          ? Math.round(boosterPrice * (discountPercent / 100))
          : 0;
        const boosterFinalPrice = boosterPrice - boosterDiscount;

        const prismaBoosterType = boosterType;
        const productCode = `BST-${boosterType}-P1-${serviceType}`;

        await prisma.memberPackage.create({
          data: {
            memberId: member.id,
            branchId: branch.id,
            packageCode: `PKG-${branch.branchCode}-BST-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            packageType: 'BOOSTER',
            packagePricingId: boosterNO.id,
            productCode,
            serviceType,
            totalSessions: quantity,
            usedSessions: 0,
            finalPrice: boosterFinalPrice,
            discountPercent: (pkgConfig as any).discountPercent || 0,
            discountAmount: boosterDiscount,
            discountNote: (pkgConfig as any).discountNote || null,
            status: pkgConfig.status as any,
            boosterType: prismaBoosterType as any,
            assignedBy: adminUser.id,
            purchaseGroupId,
            ...(pkgConfig.status === 'ACTIVE' && {
              paidAt: now,
              verifiedBy: adminUser.id,
              verifiedAt: now,
              activatedAt: now,
            }),
          },
        });
      }
    }
  }

  console.log(`\n✅ Members: Created 30 members across all branches with packages\n`);
}
