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
    // SUPER ADMIN & MANAGER (No Branch)
    // ============================================================
    {
      email: 'superadmin@raho.id',
      password: 'SuperAdmin@123',
      role: Role.SUPER_ADMIN,
      branchId: null,
      staffCode: 'SA-20260413-RAHO',
      fullName: 'Super Admin RAHO',
      phone: '0811-0000-0001',
    },
    {
      email: 'manager@raho.id',
      password: 'Manager@123',
      role: Role.ADMIN_MANAGER,
      branchId: null,
      staffCode: 'AM-20260413-RAHO',
      fullName: 'Admin Manager RAHO',
      phone: '0811-0000-0002',
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
