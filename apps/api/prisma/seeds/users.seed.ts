import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '../../src/modules/iam/permission-catalog';

const HASH_ROUNDS = 12;
const FINANCE_DUMMY_EMAIL = 'finance@raho.id';
const ADMIN_LOGISTIK_DUMMY_EMAIL = 'adminlogistik@raho.id';
const FINANCE_DUMMY_TEMPLATE_CODE = 'FINANCE_DUMMY';
const FINANCE_PERMISSION_BOOTSTRAP = [
  {
    code: PERMISSIONS.WORKFLOW_APPROVAL_READ,
    name: 'Lihat Approval',
    module: 'WORKFLOW',
    description: 'Melihat inbox dan audit approval.',
    isSensitive: false,
  },
] as const;

const FINANCE_DUMMY_PERMISSION_CODES = [
  PERMISSIONS.BRANCH_READ,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.AUDIT_EXPORT,
  PERMISSIONS.INVOICE_READ,
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_UPDATE,
  PERMISSIONS.INVOICE_FINALIZE,
  PERMISSIONS.INVOICE_PAYMENT,
  PERMISSIONS.INVOICE_CANCEL,
  PERMISSIONS.INVOICE_PROOF_READ,
  PERMISSIONS.PAYMENT_SUBMIT,
  PERMISSIONS.PAYMENT_VERIFY,
  PERMISSIONS.PAYMENT_REJECT,
  PERMISSIONS.PAYMENT_REFUND,
  PERMISSIONS.CASH_BANK_READ,
  PERMISSIONS.CASH_BANK_MANAGE,
  PERMISSIONS.OPENING_BALANCE_READ,
  PERMISSIONS.OPENING_BALANCE_MANAGE,
  PERMISSIONS.OPENING_BALANCE_POST,
  PERMISSIONS.EXPENSE_READ,
  PERMISSIONS.EXPENSE_CREATE,
  PERMISSIONS.EXPENSE_APPROVE,
  PERMISSIONS.EXPENSE_PAY,
  PERMISSIONS.ACCOUNT_READ,
  PERMISSIONS.ACCOUNT_MANAGE,
  PERMISSIONS.JOURNAL_READ,
  PERMISSIONS.JOURNAL_POST,
  PERMISSIONS.ACCOUNTING_PERIOD_READ,
  PERMISSIONS.ACCOUNTING_PERIOD_MANAGE,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.INVENTORY_VALUATION_READ,
  PERMISSIONS.SUPPLIER_READ,
  PERMISSIONS.SUPPLIER_MANAGE,
  PERMISSIONS.PURCHASE_REQUEST_READ,
  PERMISSIONS.PURCHASE_REQUEST_CREATE,
  PERMISSIONS.PURCHASE_REQUEST_APPROVE,
  PERMISSIONS.PURCHASE_ORDER_READ,
  PERMISSIONS.PURCHASE_ORDER_CREATE,
  PERMISSIONS.GOODS_RECEIPT_READ,
  PERMISSIONS.AP_READ,
  PERMISSIONS.AP_INVOICE_POST,
  PERMISSIONS.AP_PAY,
  PERMISSIONS.DEFERRED_REVENUE_READ,
  PERMISSIONS.REVENUE_POLICY_MANAGE,
  PERMISSIONS.REVENUE_RECOGNIZE,
  PERMISSIONS.WORKFLOW_APPROVAL_READ,
] as const;

type SeedUser = {
  email: string;
  password: string;
  role: Role;
  branchId: string | null | undefined;
  staffCode: string;
  fullName: string;
  phone: string;
  roleTemplateId?: string;
};

async function ensureFinanceDummyRoleTemplate(prisma: PrismaClient) {
  for (const definition of FINANCE_PERMISSION_BOOTSTRAP) {
    await prisma.permission.upsert({
      where: { code: definition.code },
      update: { isActive: true },
      create: {
        ...definition,
        isActive: true,
      },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: {
      code: { in: [...FINANCE_DUMMY_PERMISSION_CODES] },
      isActive: true,
    },
    select: { id: true, code: true },
  });

  const foundCodes = new Set(permissions.map((permission) => permission.code));
  const missingCodes = FINANCE_DUMMY_PERMISSION_CODES.filter((code) => !foundCodes.has(code));
  if (missingCodes.length > 0) {
    throw new Error(
      `Finance dummy seed requires missing IAM permissions: ${missingCodes.join(', ')}. Run all Prisma migrations first.`,
    );
  }

  const template = await prisma.roleTemplate.upsert({
    where: { code: FINANCE_DUMMY_TEMPLATE_CODE },
    update: {
      name: 'Finance',
      description: 'Finance-only permission template for development and UAT.',
      isActive: true,
    },
    create: {
      code: FINANCE_DUMMY_TEMPLATE_CODE,
      name: 'Finance',
      description: 'Finance-only permission template for development and UAT.',
      isSystem: false,
      isActive: true,
    },
  });

  await prisma.$transaction([
    prisma.roleTemplatePermission.deleteMany({
      where: { roleTemplateId: template.id },
    }),
    prisma.roleTemplatePermission.createMany({
      data: permissions.map((permission) => ({
        roleTemplateId: template.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    }),
  ]);

  const adminLogistikTemplate = await prisma.roleTemplate.findUnique({
    where: { baseRole: Role.ADMIN_LOGISTIK },
    select: { id: true },
  });
  const workflowReadPermission = permissions.find(
    (permission) => permission.code === PERMISSIONS.WORKFLOW_APPROVAL_READ,
  );
  if (adminLogistikTemplate && workflowReadPermission) {
    await prisma.roleTemplatePermission.upsert({
      where: {
        roleTemplateId_permissionId: {
          roleTemplateId: adminLogistikTemplate.id,
          permissionId: workflowReadPermission.id,
        },
      },
      update: {},
      create: {
        roleTemplateId: adminLogistikTemplate.id,
        permissionId: workflowReadPermission.id,
      },
    });
  }

  return template;
}

export async function seedUsers(
  prisma: PrismaClient, 
  branchPusatId: string, 
  branchBandungId?: string,
  branchSurabayaId?: string
) {
  console.log('👥 Seeding users for all branches...');

  // FINANCE is represented by a restricted ADMIN_MANAGER template because
  // the current database Role enum has no dedicated FINANCE value.
  const financeRoleTemplate = await ensureFinanceDummyRoleTemplate(prisma);

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
    {
      email: ADMIN_LOGISTIK_DUMMY_EMAIL,
      password: 'AdminLogistik@123',
      role: Role.ADMIN_LOGISTIK,
      branchId: branchPusatId,
      staffCode: 'LG-20260723-RAHO',
      fullName: 'Admin Logistik RAHO',
      phone: '0811-0000-0004',
    },
    {
      email: FINANCE_DUMMY_EMAIL,
      password: 'Finance@123',
      role: Role.ADMIN_MANAGER,
      branchId: branchPusatId,
      staffCode: 'FN-20260723-RAHO',
      fullName: 'Finance RAHO',
      phone: '0811-0000-0005',
      roleTemplateId: financeRoleTemplate.id,
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
      update: {
        role: u.role,
        branchId: u.branchId ?? null,
        staffCode: u.staffCode,
        isActive: true,
        ...(u.roleTemplateId ? { roleTemplateId: u.roleTemplateId } : {}),
        profile: {
          upsert: {
            update: {
              fullName: u.fullName,
              phone: u.phone,
            },
            create: {
              fullName: u.fullName,
              phone: u.phone,
            },
          },
        },
      },
      create: {
        email: u.email,
        password: hashed,
        role: u.role,
        branchId: u.branchId ?? null,
        staffCode: u.staffCode,
        roleTemplateId: u.roleTemplateId,
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

  // Assign doctors to SELECTED branches (more realistic for testing multi-branch assignment)
  // Dr. Ahmad Fauzi → Jakarta + Surabaya
  // Dr. Budi Santoso → Jakarta only (primary)
  // Dr. Citra Wijaya → Surabaya + Bandung
  
  const doctorBranchMapping = [
    { doctor: doctors[0], branches: [branches[0], branches[1]] }, // Ahmad Fauzi → Jakarta, Surabaya
    { doctor: doctors[1], branches: [branches[0]] },               // Budi Santoso → Jakarta only
    { doctor: doctors[2], branches: [branches[1], branches[2]] },  // Citra Wijaya → Surabaya, Bandung
  ];

  for (const mapping of doctorBranchMapping) {
    for (const branch of mapping.branches) {
      const existing = await prisma.staffBranch.findUnique({
        where: {
          userId_branchId: {
            userId: mapping.doctor.id,
            branchId: branch.id
          }
        }
      });

      if (!existing) {
        await prisma.staffBranch.create({
          data: {
            userId: mapping.doctor.id,
            branchId: branch.id
          }
        });
        assignmentCount++;
      }
    }
  }

  // Assign nurses to SELECTED branches
  // Dewi Lestari → Jakarta + Bandung
  // Eko Prasetyo → Surabaya only
  // Siti Rahayu → Jakarta + Surabaya
  
  const nurseBranchMapping = [
    { nurse: nurses[0], branches: [branches[0], branches[2]] }, // Dewi Lestari → Jakarta, Bandung
    { nurse: nurses[1], branches: [branches[1]] },              // Eko Prasetyo → Surabaya only
    { nurse: nurses[2], branches: [branches[0], branches[1]] }, // Siti Rahayu → Jakarta, Surabaya
  ];

  for (const mapping of nurseBranchMapping) {
    for (const branch of mapping.branches) {
      const existing = await prisma.staffBranch.findUnique({
        where: {
          userId_branchId: {
            userId: mapping.nurse.id,
            branchId: branch.id
          }
        }
      });

      if (!existing) {
        await prisma.staffBranch.create({
          data: {
            userId: mapping.nurse.id,
            branchId: branch.id
          }
        });
        assignmentCount++;
      }
    }
  }

  const adminLogistik = await prisma.user.findUnique({
    where: { email: ADMIN_LOGISTIK_DUMMY_EMAIL },
  });

  if (adminLogistik) {
    for (const branch of branches) {
      const existing = await prisma.staffBranch.findUnique({
        where: {
          userId_branchId: {
            userId: adminLogistik.id,
            branchId: branch.id,
          },
        },
      });

      if (!existing) {
        await prisma.staffBranch.create({
          data: {
            userId: adminLogistik.id,
            branchId: branch.id,
          },
        });
        assignmentCount++;
      }
    }
  }

  console.log(`✅ Assigned ${doctors.length} doctors, ${nurses.length} nurses, and logistics admin to branches`);
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
  const financeUser = await prisma.user.findUnique({ where: { email: FINANCE_DUMMY_EMAIL } });

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

  if (financeUser) {
    for (const branch of [branchPusat, branchBandung, branchSurabaya]) {
      const existing = await prisma.managerBranch.findUnique({
        where: {
          userId_branchId: {
            userId: financeUser.id,
            branchId: branch.id,
          },
        },
      });

      if (!existing) {
        await prisma.managerBranch.create({
          data: {
            userId: financeUser.id,
            branchId: branch.id,
          },
        });
        assignmentCount++;
        console.log(`  Finance (${financeUser.email}) -> ${branch.name}`);
      }
    }
  }

  console.log(`✅ Branch assignments completed:`);
  console.log(`   - Manager 1: Jakarta Pusat, Bandung`);
  console.log(`   - Manager 2: Surabaya, Jakarta Pusat`);
  console.log(`   - Finance: all active seeded branches`);
  console.log(`   Total assignments: ${assignmentCount}`);
}
