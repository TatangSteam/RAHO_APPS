import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const HASH_ROUNDS = 12;

type SeedUser = {
  email: string;
  password: string;
  role: Role;
  branchId: string | null | undefined;
  staffCode: string;
  fullName: string;
  phone: string;
};

export async function seedUsers(
  prisma: PrismaClient, 
  branchPusatId: string, 
  branchBandungId?: string,
  branchSurabayaId?: string
) {
  console.log('👥 Seeding users for all branches...');

  const usersToSeed: SeedUser[] = [
    // ============================================================
    // SUPER ADMIN & MANAGER
    // ============================================================
    {
      email: 'superadmin@raho.id',
      password: 'SuP3r4Dm1n',
      role: Role.SUPER_ADMIN,
      branchId: null, // SUPER_ADMIN tidak perlu branchId
      staffCode: 'SA-20260413-RAHO',
      fullName: 'Super Admin RAHO',
      phone: '0811-0000-0001',
    },
    {
      email: 'manager1@raho.id',
      password: 'Manager@123',
      role: Role.ADMIN_MANAGER,
      branchId: branchPusatId, // Assign ke Pusat Jakarta
      staffCode: 'AM-20260413-REG1',
      fullName: 'Admin Manager Regional 1',
      phone: '0811-0000-0002',
    },
    {
      email: 'manager2@raho.id',
      password: 'Manager@123',
      role: Role.ADMIN_MANAGER,
      branchId: branchSurabayaId, // Assign ke Surabaya (bukan Bandung)
      staffCode: 'AM-20260413-REG2',
      fullName: 'Admin Manager Regional 2',
      phone: '0811-0000-0003',
    },

    // ============================================================
    // CABANG PUSAT JAKARTA
    // ============================================================
    {
      email: 'admincabang.pst@raho.id',
      password: 'AdminCabang@123',
      role: Role.ADMIN_CABANG,
      branchId: branchPusatId,
      staffCode: 'AC-20260413-PST1',
      fullName: 'Admin Cabang Pusat',
      phone: '0811-1000-0001',
    },
    {
      email: 'adminlayanan.pst@raho.id',
      password: 'AdminLayanan@123',
      role: Role.ADMIN_LAYANAN,
      branchId: branchPusatId,
      staffCode: 'AL-20260413-PST1',
      fullName: 'Admin Layanan Pusat',
      phone: '0811-1000-0002',
    },

    // ============================================================
    // CABANG BANDUNG
    // ============================================================
    {
      email: 'admincabang.bdg@raho.id',
      password: 'AdminCabang@123',
      role: Role.ADMIN_CABANG,
      branchId: branchBandungId,
      staffCode: 'AC-20260413-BDG1',
      fullName: 'Admin Cabang Bandung',
      phone: '0811-2000-0001',
    },
    {
      email: 'adminlayanan.bdg@raho.id',
      password: 'AdminLayanan@123',
      role: Role.ADMIN_LAYANAN,
      branchId: branchBandungId,
      staffCode: 'AL-20260413-BDG1',
      fullName: 'Admin Layanan Bandung',
      phone: '0811-2000-0002',
    },

    // ============================================================
    // CABANG SURABAYA
    // ============================================================
    {
      email: 'admincabang.sby@raho.id',
      password: 'AdminCabang@123',
      role: Role.ADMIN_CABANG,
      branchId: branchSurabayaId,
      staffCode: 'AC-20260413-SBY1',
      fullName: 'Admin Cabang Surabaya',
      phone: '0811-3000-0001',
    },
    {
      email: 'adminlayanan.sby@raho.id',
      password: 'AdminLayanan@123',
      role: Role.ADMIN_LAYANAN,
      branchId: branchSurabayaId,
      staffCode: 'AL-20260413-SBY1',
      fullName: 'Admin Layanan Surabaya',
      phone: '0811-3000-0002',
    },

    // ============================================================
    // SHARED DOCTORS & NURSES (Cross-Branch Access)
    // ============================================================
    {
      email: 'dokter@raho.id',
      password: 'Dokter@123',
      role: Role.DOCTOR,
      branchId: branchPusatId, // Primary branch
      staffCode: 'DR-20260413-SHARED1',
      fullName: 'dr. Ahmad Fauzi, SpPD',
      phone: '0811-1000-0003',
    },
    {
      email: 'dokter2@raho.id',
      password: 'Dokter@123',
      role: Role.DOCTOR,
      branchId: branchBandungId, // Primary branch
      staffCode: 'DR-20260413-SHARED2',
      fullName: 'dr. Budi Santoso, SpPD',
      phone: '0811-2000-0003',
    },
    {
      email: 'dokter3@raho.id',
      password: 'Dokter@123',
      role: Role.DOCTOR,
      branchId: branchSurabayaId, // Primary branch
      staffCode: 'DR-20260413-SHARED3',
      fullName: 'dr. Citra Wijaya, SpPD',
      phone: '0811-3000-0003',
    },
    {
      email: 'nakes@raho.id',
      password: 'Nakes@123',
      role: Role.NURSE,
      branchId: branchPusatId, // Primary branch
      staffCode: 'NR-20260413-SHARED1',
      fullName: 'Siti Rahayu, Amd.Kep',
      phone: '0811-1000-0004',
    },
    {
      email: 'nakes2@raho.id',
      password: 'Nakes@123',
      role: Role.NURSE,
      branchId: branchBandungId, // Primary branch
      staffCode: 'NR-20260413-SHARED2',
      fullName: 'Dewi Lestari, Amd.Kep',
      phone: '0811-2000-0004',
    },
    {
      email: 'nakes3@raho.id',
      password: 'Nakes@123',
      role: Role.NURSE,
      branchId: branchSurabayaId, // Primary branch
      staffCode: 'NR-20260413-SHARED3',
      fullName: 'Eko Prasetyo, Amd.Kep',
      phone: '0811-3000-0004',
    },
  ];

  const createdUsers: { id: string; email: string; role: Role; branchId: string | null }[] = [];
  
  for (const u of usersToSeed) {
    const hashed = await bcrypt.hash(u.password, HASH_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: hashed,
        role: u.role,
        branchId: u.branchId ?? null,
        staffCode: u.staffCode,
        profile: {
          create: {
            fullName: u.fullName,
            phone: u.phone,
          },
        },
      },
    });
    createdUsers.push({ id: user.id, email: user.email, role: user.role, branchId: user.branchId });
    
    const branchName = u.branchId === branchPusatId ? 'Pusat' : 
                       u.branchId === branchBandungId ? 'Bandung' : 
                       u.branchId === branchSurabayaId ? 'Surabaya' : 'All';
    console.log(`  ✅ User [${u.role}] ${branchName}: ${u.email}`);
  }

  const superAdminUser = createdUsers.find(u => u.role === Role.SUPER_ADMIN)!;
  const adminLayananUser = createdUsers.find(u => u.role === Role.ADMIN_LAYANAN && u.branchId === branchPusatId)!;
  const doctorUser = createdUsers.find(u => u.role === Role.DOCTOR && u.branchId === branchPusatId)!;
  const nurseUser = createdUsers.find(u => u.role === Role.NURSE && u.branchId === branchPusatId)!;

  console.log(`✅ Users: ${createdUsers.length} staff users created across all branches`);

  return { superAdminUser, adminLayananUser, doctorUser, nurseUser, allUsers: createdUsers };
}

/**
 * Assign doctors and nurses to multiple branches
 * This allows them to work across different locations
 */
export async function assignStaffToBranches(prisma: PrismaClient) {
  console.log('🔗 Assigning doctors and nurses to multiple branches...');

  // Get all branches
  const branches = await prisma.branch.findMany();
  
  // Get all doctors and nurses
  const doctors = await prisma.user.findMany({
    where: { role: Role.DOCTOR, isActive: true }
  });
  
  const nurses = await prisma.user.findMany({
    where: { role: Role.NURSE, isActive: true }
  });

  let assignmentCount = 0;

  // Assign each doctor to ALL branches
  for (const doctor of doctors) {
    for (const branch of branches) {
      const existing = await prisma.staffBranch.findUnique({
        where: {
          userId_branchId: {
            userId: doctor.id,
            branchId: branch.id
          }
        }
      });

      if (!existing) {
        await prisma.staffBranch.create({
          data: {
            userId: doctor.id,
            branchId: branch.id
          }
        });
        assignmentCount++;
      }
    }
  }

  // Assign each nurse to ALL branches
  for (const nurse of nurses) {
    for (const branch of branches) {
      const existing = await prisma.staffBranch.findUnique({
        where: {
          userId_branchId: {
            userId: nurse.id,
            branchId: branch.id
          }
        }
      });

      if (!existing) {
        await prisma.staffBranch.create({
          data: {
            userId: nurse.id,
            branchId: branch.id
          }
        });
        assignmentCount++;
      }
    }
  }

  console.log(`✅ Assigned ${doctors.length} doctors and ${nurses.length} nurses to ${branches.length} branches`);
  console.log(`   Total assignments: ${assignmentCount}`);
}

/**
 * Assign ADMIN_MANAGER to specific branches
 * Manager 1: Jakarta Pusat & Bandung
 * Manager 2: Surabaya & Jakarta Pusat (overlap for testing)
 */
export async function assignManagerToBranches(prisma: PrismaClient) {
  console.log('🔗 Assigning ADMIN_MANAGER to specific branches...');

  // Get all branches
  const branchPusat = await prisma.branch.findFirst({ where: { branchCode: 'PST' } });
  const branchBandung = await prisma.branch.findFirst({ where: { branchCode: 'BDG' } });
  const branchSurabaya = await prisma.branch.findFirst({ where: { branchCode: 'SBY' } });

  if (!branchPusat || !branchBandung || !branchSurabaya) {
    console.log('⚠️  Some branches not found, skipping manager assignment');
    return;
  }

  // Get managers
  const manager1 = await prisma.user.findUnique({ where: { email: 'manager1@raho.id' } });
  const manager2 = await prisma.user.findUnique({ where: { email: 'manager2@raho.id' } });

  if (!manager1 || !manager2) {
    console.log('⚠️  Managers not found, skipping assignment');
    return;
  }

  let assignmentCount = 0;

  // Manager 1: Jakarta Pusat & Bandung
  const manager1Branches = [branchPusat, branchBandung];
  for (const branch of manager1Branches) {
    const existing = await prisma.managerBranch.findUnique({
      where: {
        userId_branchId: {
          userId: manager1.id,
          branchId: branch.id
        }
      }
    });

    if (!existing) {
      await prisma.managerBranch.create({
        data: {
          userId: manager1.id,
          branchId: branch.id
        }
      });
      assignmentCount++;
      console.log(`  ✅ Manager 1 (${manager1.email}) → ${branch.name}`);
    }
  }

  // Manager 2: Surabaya & Jakarta Pusat
  const manager2Branches = [branchSurabaya, branchPusat];
  for (const branch of manager2Branches) {
    const existing = await prisma.managerBranch.findUnique({
      where: {
        userId_branchId: {
          userId: manager2.id,
          branchId: branch.id
        }
      }
    });

    if (!existing) {
      await prisma.managerBranch.create({
        data: {
          userId: manager2.id,
          branchId: branch.id
        }
      });
      assignmentCount++;
      console.log(`  ✅ Manager 2 (${manager2.email}) → ${branch.name}`);
    }
  }

  console.log(`✅ Branch assignments completed:`);
  console.log(`   - Manager 1: Jakarta Pusat, Bandung`);
  console.log(`   - Manager 2: Surabaya, Jakarta Pusat`);
  console.log(`   Total assignments: ${assignmentCount}`);
}
