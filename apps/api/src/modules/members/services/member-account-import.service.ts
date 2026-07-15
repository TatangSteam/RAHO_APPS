import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AuditAction, Gender, Prisma, Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { generateMemberNo } from '../../../utils/codeGenerator';
import {
  cleanMemberName,
  hasMatchingMemberName,
  MemberIdentityType,
  parseMemberBirthDate,
  resolveMemberIdentityNumber,
} from './member-registration.helpers';

type DbClient = typeof prisma | Prisma.TransactionClient;

interface ImportActor {
  userId: string;
  role: string;
  branchId: string | null;
  branches?: string[];
}

interface ParsedMemberAccount {
  rowNumber: number;
  fullName: string;
  memberUsername: string | null;
  memberPassword: string | null;
  phone: string | null;
  identityType: string | null;
  nik: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
  gender: Gender | null;
  religion: string | null;
  email: string | null;
  address: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  emergencyContact: string | null;
  emergencyContactPhone: string | null;
  infoSource: string | null;
  postalCode: string | null;
  referralCode: string | null;
  isConsentToPhoto: boolean;
}

interface RowIssue {
  rowNumber: number;
  field: string;
  message: string;
  fullName?: string;
  nik?: string | null;
  birthDate?: string | null;
}

interface ExistingMemberMatch {
  id: string;
  userId: string;
  memberNo: string;
  user: {
    email: string;
    profile: {
      fullName: string | null;
      phone: string | null;
    } | null;
  };
  nik: string | null;
  tempatLahir: string | null;
  dateOfBirth: Date | null;
  jenisKelamin: Gender | null;
  agama: string | null;
  address: string | null;
  pekerjaan: string | null;
  statusNikah: string | null;
  emergencyContact: string | null;
  sumberInfoRaho: string | null;
  postalCode: string | null;
  isConsentToPhoto: boolean;
}

interface ImportPlan {
  row: ParsedMemberAccount;
  action: 'create' | 'update';
  existingMember?: ExistingMemberMatch;
}

const REQUIRED_HEADERS = ['nama_lengkap', 'tanggal_lahir', 'no_hp'];

const HEADER_ALIASES: Record<string, string> = {
  nama_lengkap: 'nama_lengkap',
  nama: 'nama_lengkap',
  full_name: 'nama_lengkap',
  username: 'username',
  member_username: 'username',
  password: 'password',
  member_password: 'password',
  no_hp: 'no_hp',
  phone: 'no_hp',
  nomor_hp: 'no_hp',
  nik: 'nik',
  tipe_identitas: 'tipe_identitas',
  identity_type: 'tipe_identitas',
  tempat_lahir: 'tempat_lahir',
  tanggal_lahir: 'tanggal_lahir',
  birth_date: 'tanggal_lahir',
  jenis_kelamin: 'jenis_kelamin',
  gender: 'jenis_kelamin',
  agama: 'agama',
  email: 'email',
  alamat: 'alamat',
  address: 'alamat',
  pekerjaan: 'pekerjaan',
  status_nikah: 'status_nikah',
  kontak_darurat: 'kontak_darurat',
  no_hp_kontak_darurat: 'no_hp_kontak_darurat',
  sumber_info_raho: 'sumber_info_raho',
  kode_pos: 'kode_pos',
  kode_referral: 'kode_referral',
  consent_foto: 'consent_foto',
};

export class MemberAccountImportService {
  async dryRun(input: {
    buffer: Buffer;
    fileName: string;
    actor: ImportActor;
    branchId?: string;
  }) {
    const branch = await this.resolveBranch(input.actor, input.branchId);
    const parsed = await this.parseWorkbook(input.buffer, input.fileName);
    const { issues, plans } = await this.validateRows(parsed);

    const invalidRowNumbers = new Set(issues.map((issue) => issue.rowNumber));
    const invalidRows = invalidRowNumbers.size;
    const validRows = parsed.length - invalidRows;
    const issuesByRow = this.groupIssuesByRow(issues);

    return {
      fileName: input.fileName,
      branch: {
        id: branch.id,
        branchCode: branch.branchCode,
        name: branch.name,
      },
      counts: {
        rows: parsed.length,
        validRows,
        invalidRows,
        createRows: plans.filter((plan) => plan.action === 'create' && !invalidRowNumbers.has(plan.row.rowNumber)).length,
        updateRows: plans.filter((plan) => plan.action === 'update' && !invalidRowNumbers.has(plan.row.rowNumber)).length,
      },
      preview: parsed.slice(0, 20).map((row) => ({
        rowNumber: row.rowNumber,
        fullName: row.fullName,
        username: row.memberUsername || this.generateUsername(row, row.rowNumber),
        phone: row.phone || null,
        birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
        gender: row.gender,
        action: plans.find((plan) => plan.row.rowNumber === row.rowNumber)?.action || 'create',
      })),
      invalidRows: parsed
        .filter((row) => issuesByRow.has(row.rowNumber))
        .map((row) => ({
          rowNumber: row.rowNumber,
          fullName: row.fullName || '-',
          nik: row.nik,
          birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
          phone: row.phone,
          issues: issuesByRow.get(row.rowNumber) || [],
        })),
      issues,
      canImport: validRows > 0,
    };
  }

  async execute(input: {
    buffer: Buffer;
    fileName: string;
    actor: ImportActor;
    branchId?: string;
    ipAddress?: string;
    userAgent?: string | string[];
  }) {
    const branch = await this.resolveBranch(input.actor, input.branchId);
    const parsed = await this.parseWorkbook(input.buffer, input.fileName);
    const { issues, plans } = await this.validateRows(parsed);
    const invalidRowNumbers = new Set(issues.map((issue) => issue.rowNumber));
    const issuesByRow = this.groupIssuesByRow(issues);
    const validPlans = plans.filter((plan) => !invalidRowNumbers.has(plan.row.rowNumber));
    const skipped = parsed
      .filter((row) => invalidRowNumbers.has(row.rowNumber))
      .map((row) => ({
        rowNumber: row.rowNumber,
        fullName: row.fullName || '-',
        nik: row.nik,
        birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
        phone: row.phone,
        issues: issuesByRow.get(row.rowNumber) || [],
      }));

    if (parsed.length === 0) {
      throw { status: 400, code: 'IMPORT_EMPTY', message: 'File Excel tidak memiliki data member.' };
    }

    if (validPlans.length === 0) {
      throw {
        status: 400,
        code: 'IMPORT_NO_VALID_ROWS',
        message: 'Import gagal. Tidak ada baris valid yang bisa diproses.',
        details: issues,
        skipped,
      };
    }

    const credentialsByRow = await this.prepareCreateCredentials(validPlans);

    const created = await prisma.$transaction(async (tx) => {
      const rows: Array<{
        action: 'created' | 'updated';
        rowNumber: number;
        memberId: string;
        memberNo: string;
        fullName: string;
        username?: string;
        password?: string;
      }> = [];

      for (const [index, plan] of validPlans.entries()) {
        const { row } = plan;

        if (plan.action === 'update' && plan.existingMember) {
          await this.updateExistingMemberFromImport(tx, plan.existingMember, row, branch.id, input.actor.userId);

          rows.push({
            action: 'updated',
            rowNumber: row.rowNumber,
            memberId: plan.existingMember.id,
            memberNo: plan.existingMember.memberNo,
            fullName: plan.existingMember.user.profile?.fullName || row.fullName,
            username: plan.existingMember.user.email,
          });
          continue;
        }

        const username = await this.uniqueUsername(tx, row.memberUsername || this.generateUsername(row, row.rowNumber));
        const credentials = credentialsByRow.get(row.rowNumber);
        if (!credentials) {
          throw { status: 500, code: 'IMPORT_CREDENTIALS_MISSING', message: 'Gagal menyiapkan password akun member.' };
        }

        const memberNo = await this.nextMemberNo(tx, branch.branchCode);
        const birthDate = row.birthDate!;
        const identityNumber = resolveMemberIdentityNumber(
          this.mapIdentityType(row.identityType),
          row.nik || undefined,
          memberNo,
        );
        const referralCode = row.referralCode
          ? await tx.referralCode.findFirst({ where: { code: row.referralCode, isActive: true } })
          : null;

        const user = await tx.user.create({
          data: {
            email: username,
            password: credentials.passwordHash,
            role: Role.MEMBER,
            branchId: branch.id,
            isActive: true,
            profile: {
              create: {
                fullName: row.fullName,
                phone: row.phone,
              },
            },
          },
        });

        const member = await tx.member.create({
          data: {
            userId: user.id,
            memberNo,
            registrationBranchId: branch.id,
            referralCodeId: referralCode?.id,
            nik: identityNumber,
            tempatLahir: row.birthPlace,
            dateOfBirth: birthDate,
            jenisKelamin: row.gender,
            agama: row.religion,
            address: row.address,
            pekerjaan: row.occupation,
            statusNikah: row.maritalStatus,
            emergencyContact: this.combineEmergencyContact(row),
            sumberInfoRaho: row.infoSource,
            postalCode: row.postalCode,
            isConsentToPhoto: row.isConsentToPhoto,
            isActive: true,
          },
        });

        await tx.branchMemberAccess.upsert({
          where: { memberId_branchId: { memberId: member.id, branchId: branch.id } },
          update: {},
          create: {
            memberId: member.id,
            branchId: branch.id,
            grantedBy: input.actor.userId,
            notes: 'Import akun member cabang dari Excel',
          },
        });

        await tx.notification.create({
          data: {
            userId: user.id,
            type: 'INFO',
            title: 'Selamat Datang di Raho ERP',
            body: `Halo ${row.fullName}, akun Anda telah berhasil dibuat. Member No: ${memberNo}`,
            status: 'UNREAD',
          },
        });

        rows.push({
          action: 'created',
          rowNumber: row.rowNumber,
          memberId: member.id,
          memberNo,
          fullName: row.fullName,
          username,
          password: credentials.password,
        });
      }

      return rows;
    }, { maxWait: 10000, timeout: 120000 });

    await logAudit({
      userId: input.actor.userId,
      branchId: branch.id,
      action: AuditAction.CREATE,
      resource: 'MemberAccountImport',
      resourceId: branch.id,
      meta: {
        fileName: input.fileName,
        createdCount: created.filter((row) => row.action === 'created').length,
        updatedCount: created.filter((row) => row.action === 'updated').length,
        skippedCount: skipped.length,
      },
      ipAddress: input.ipAddress,
      userAgent: Array.isArray(input.userAgent) ? input.userAgent.join(', ') : input.userAgent,
    });

    return {
      message: `Berhasil membuat ${created.filter((row) => row.action === 'created').length} akun member, melengkapi ${created.filter((row) => row.action === 'updated').length} member existing, dan skip ${skipped.length} baris tidak valid.`,
      branch: {
        id: branch.id,
        branchCode: branch.branchCode,
        name: branch.name,
      },
      createdCount: created.filter((row) => row.action === 'created').length,
      updatedCount: created.filter((row) => row.action === 'updated').length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }

  private async prepareCreateCredentials(plans: ImportPlan[]) {
    const credentialsByRow = new Map<number, { password: string; passwordHash: string }>();

    for (const plan of plans) {
      if (plan.action !== 'create') continue;

      const password = plan.row.memberPassword || this.generatePassword();
      credentialsByRow.set(plan.row.rowNumber, {
        password,
        passwordHash: await bcrypt.hash(password, 10),
      });
    }

    return credentialsByRow;
  }

  private async resolveBranch(actor: ImportActor, requestedBranchId?: string) {
    const role = actor.role as Role;
    let branchId = requestedBranchId || actor.branchId;

    if (role === Role.ADMIN_MANAGER) {
      if (!branchId) {
        throw { status: 400, code: 'BRANCH_REQUIRED', message: 'Pilih cabang untuk import member.' };
      }

      const allowed = await prisma.managerBranch.findFirst({
        where: { userId: actor.userId, branchId },
      });
      if (!allowed) {
        throw { status: 403, code: 'BRANCH_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke cabang ini.' };
      }
    } else if (role === Role.SUPER_ADMIN) {
      if (!branchId) {
        throw { status: 400, code: 'BRANCH_REQUIRED', message: 'Pilih cabang untuk import member.' };
      }
    } else {
      branchId = actor.branchId;
    }

    if (!branchId) {
      throw { status: 403, code: 'BRANCH_REQUIRED', message: 'Akun ini belum terhubung ke cabang.' };
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true, branchCode: true, name: true },
    });

    if (!branch) {
      throw { status: 404, code: 'BRANCH_NOT_FOUND', message: 'Cabang tidak ditemukan atau sudah tidak aktif.' };
    }

    return branch;
  }

  private async parseWorkbook(buffer: Buffer, fileName: string): Promise<ParsedMemberAccount[]> {
    if (!this.isLikelyXlsx(buffer)) {
      throw {
        status: 400,
        code: 'IMPORT_FILE_INVALID',
        message: `File "${fileName}" bukan file Excel .xlsx yang valid. Simpan ulang file sebagai Excel Workbook (.xlsx), bukan .xls/CSV atau file yang hanya di-rename.`,
      };
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (error) {
      throw {
        status: 400,
        code: 'IMPORT_FILE_READ_FAILED',
        message: `File "${fileName}" tidak bisa dibaca sebagai Excel .xlsx. Pastikan file tidak corrupt dan dibuat/disimpan sebagai Excel Workbook (.xlsx).`,
      };
    }

    const sheet = workbook.getWorksheet('Members') || workbook.worksheets[0];
    if (!sheet) return [];

    const headerInfo = this.findHeaderRow(sheet);
    if (!headerInfo) {
      throw {
        status: 400,
        code: 'IMPORT_HEADER_NOT_FOUND',
        message: `Header wajib ada: ${REQUIRED_HEADERS.join(', ')}.`,
      };
    }

    const rows: ParsedMemberAccount[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerInfo.rowNumber) return;

      const values = this.readRow(row, headerInfo.headers);
      if (Object.values(values).every((value) => !this.text(value))) return;

      const fullName = cleanMemberName(this.text(values.nama_lengkap));
      const birthDate = this.parseDate(values.tanggal_lahir);
      const username = this.optionalText(values.username)?.toLowerCase() || null;

      rows.push({
        rowNumber,
        fullName,
        memberUsername: username,
        memberPassword: this.optionalText(values.password),
        phone: this.optionalText(values.no_hp),
        identityType: this.optionalText(values.tipe_identitas) || 'NIK',
        nik: this.normalizeNik(this.optionalText(values.nik)),
        birthPlace: this.optionalText(values.tempat_lahir),
        birthDate,
        gender: this.mapGender(this.optionalText(values.jenis_kelamin)),
        religion: this.optionalText(values.agama),
        email: this.optionalText(values.email),
        address: this.optionalText(values.alamat),
        occupation: this.optionalText(values.pekerjaan),
        maritalStatus: this.optionalText(values.status_nikah),
        emergencyContact: this.optionalText(values.kontak_darurat),
        emergencyContactPhone: this.optionalText(values.no_hp_kontak_darurat),
        infoSource: this.optionalText(values.sumber_info_raho),
        postalCode: this.optionalText(values.kode_pos),
        referralCode: this.optionalText(values.kode_referral),
        isConsentToPhoto: this.mapBoolean(this.optionalText(values.consent_foto), true),
      });
    });

    return rows;
  }

  private findHeaderRow(sheet: ExcelJS.Worksheet) {
    for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 10); rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const headers = new Map<string, number>();
      row.eachCell((cell, colNumber) => {
        const normalized = this.normalizeHeader(this.text(cell.value));
        const canonical = HEADER_ALIASES[normalized];
        if (canonical) headers.set(canonical, colNumber);
      });

      if (REQUIRED_HEADERS.every((header) => headers.has(header))) {
        return { rowNumber, headers };
      }
    }

    return null;
  }

  private readRow(row: ExcelJS.Row, headers: Map<string, number>) {
    const values: Record<string, unknown> = {};
    for (const [key, column] of headers.entries()) {
      values[key] = this.cellValue(row.getCell(column).value);
    }
    return values;
  }

  private async validateRows(rows: ParsedMemberAccount[]): Promise<{ issues: RowIssue[]; plans: ImportPlan[] }> {
    const issues: RowIssue[] = [];
    const usernames = new Set<string>();
    const niks = new Set<string>();
    const nameDob = new Set<string>();

    for (const row of rows) {
      if (!row.fullName || row.fullName.length < 3) {
        issues.push(this.issue(row, 'nama_lengkap', 'Nama lengkap minimal 3 karakter.'));
      }

      if (!row.birthDate) {
        issues.push(this.issue(row, 'tanggal_lahir', 'Tanggal lahir wajib valid.'));
      }

      if (!row.phone) {
        issues.push(this.issue(row, 'no_hp', 'Nomor HP wajib diisi.'));
      } else if (row.phone.replace(/\D/g, '').length < 10) {
        issues.push(this.issue(row, 'no_hp', 'Nomor HP minimal 10 digit.'));
      }

      if (row.memberUsername && !/^[a-zA-Z0-9._-]{4,30}$/.test(row.memberUsername)) {
        issues.push({
          ...this.issue(row, 'username', 'Username harus 4-30 karakter dan hanya huruf, angka, titik, underscore, atau tanda hubung.'),
        });
      }

      if (row.memberPassword && row.memberPassword.length < 8) {
        issues.push(this.issue(row, 'password', 'Password minimal 8 karakter.'));
      }

      if (row.nik && row.nik.length !== 16) {
        issues.push(this.issue(row, 'nik', 'NIK harus 16 digit.'));
      }

      if (row.referralCode) {
        const referral = await prisma.referralCode.findFirst({ where: { code: row.referralCode, isActive: true } });
        if (!referral) {
          issues.push(this.issue(row, 'kode_referral', 'Kode referral tidak aktif/tidak ditemukan.'));
        }
      }

      const username = row.memberUsername || this.generateUsername(row, row.rowNumber);
      if (usernames.has(username)) {
        issues.push(this.issue(row, 'username', 'Username duplikat di file Excel.'));
      }
      usernames.add(username);

      if (row.nik) {
        if (niks.has(row.nik)) {
          issues.push(this.issue(row, 'nik', 'NIK duplikat di file Excel.'));
        }
        niks.add(row.nik);
      }

      if (row.fullName && row.birthDate) {
        const key = `${this.normalizePersonName(row.fullName)}|${row.birthDate.toISOString().slice(0, 10)}`;
        if (nameDob.has(key)) {
          issues.push(this.issue(row, 'nama_lengkap', 'Nama dan tanggal lahir duplikat di file Excel.'));
        }
        nameDob.add(key);
      }
    }

    const plans = await this.validateAgainstDatabase(rows, issues);

    return { issues, plans };
  }

  private async validateAgainstDatabase(rows: ParsedMemberAccount[], issues: RowIssue[]): Promise<ImportPlan[]> {
    const matchByRow = await this.findExistingMatches(rows, issues);
    const usernameRows = rows
      .map((row) => {
        const matched = matchByRow.get(row.rowNumber);
        return {
          row,
          username: row.memberUsername || (matched ? null : this.generateUsername(row, row.rowNumber)),
        };
      })
      .filter((entry) => Boolean(entry.username));

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: usernameRows.map((entry) => entry.username) } },
      select: { id: true, email: true },
    });
    const userIdByUsername = new Map(existingUsers.map((user) => [user.email, user.id]));

    for (const entry of usernameRows) {
      const existingUserId = userIdByUsername.get(entry.username!);
      const matched = matchByRow.get(entry.row.rowNumber);
      if (existingUserId && existingUserId !== matched?.userId) {
        issues.push(this.issue(entry.row, 'username', 'Username sudah digunakan oleh member lain.'));
      }
    }

    return rows.map((row) => {
      const existingMember = matchByRow.get(row.rowNumber);
      return existingMember
        ? { row, action: 'update', existingMember }
        : { row, action: 'create' };
    });
  }

  private async findExistingMatches(rows: ParsedMemberAccount[], issues: RowIssue[]) {
    const matchByRow = new Map<number, ExistingMemberMatch>();

    for (const row of rows) {
      const candidates = new Map<string, ExistingMemberMatch>();

      if (row.nik) {
        const byNik = await prisma.member.findUnique({
          where: { nik: row.nik },
          select: this.existingMemberSelect(),
        });
        if (byNik) candidates.set(byNik.id, byNik as ExistingMemberMatch);
      }

      if (row.fullName && row.birthDate) {
        const sameBirthDate = await prisma.member.findMany({
          where: { dateOfBirth: row.birthDate },
          select: this.existingMemberSelect(),
        });
        const sameName = sameBirthDate.filter((member) => (
          this.normalizePersonName(member.user.profile?.fullName) === this.normalizePersonName(row.fullName)
        ));

        if (sameName.length > 1) {
          issues.push(this.issue(row, 'nama_lengkap', 'Ada lebih dari satu member existing dengan nama dan tanggal lahir yang sama. Import ditolak agar tidak salah update.'));
        }

        sameName.forEach((member) => candidates.set(member.id, member as ExistingMemberMatch));
      }

      if (candidates.size > 1) {
        issues.push(this.issue(row, 'nik', 'Data cocok ke lebih dari satu member existing. Periksa NIK, nama, dan tanggal lahir.'));
        continue;
      }

      const match = Array.from(candidates.values())[0];
      if (match) {
        matchByRow.set(row.rowNumber, match);
      }
    }

    return matchByRow;
  }

  private existingMemberSelect() {
    return {
      id: true,
      userId: true,
      memberNo: true,
      user: {
        select: {
          email: true,
          profile: {
            select: {
              fullName: true,
              phone: true,
            },
          },
        },
      },
      nik: true,
      tempatLahir: true,
      dateOfBirth: true,
      jenisKelamin: true,
      agama: true,
      address: true,
      pekerjaan: true,
      statusNikah: true,
      emergencyContact: true,
      sumberInfoRaho: true,
      postalCode: true,
      isConsentToPhoto: true,
    } as const;
  }

  private async updateExistingMemberFromImport(
    tx: DbClient,
    existing: ExistingMemberMatch,
    row: ParsedMemberAccount,
    branchId: string,
    actorUserId: string,
  ) {
    const profileUpdate: Prisma.UserProfileUpdateInput = {};
    if (!existing.user.profile?.fullName && row.fullName) profileUpdate.fullName = row.fullName;
    if (!existing.user.profile?.phone && row.phone) profileUpdate.phone = row.phone;

    if (Object.keys(profileUpdate).length > 0) {
      await tx.userProfile.upsert({
        where: { userId: existing.userId },
        update: profileUpdate,
        create: {
          userId: existing.userId,
          fullName: row.fullName || existing.user.profile?.fullName || 'Member',
          phone: row.phone,
        },
      });
    }

    const memberUpdate: Prisma.MemberUpdateInput = {};
    if (!existing.nik && row.nik) memberUpdate.nik = row.nik;
    if (!existing.tempatLahir && row.birthPlace) memberUpdate.tempatLahir = row.birthPlace;
    if (!existing.dateOfBirth && row.birthDate) memberUpdate.dateOfBirth = row.birthDate;
    if (!existing.jenisKelamin && row.gender) memberUpdate.jenisKelamin = row.gender;
    if (!existing.agama && row.religion) memberUpdate.agama = row.religion;
    if (!existing.address && row.address) memberUpdate.address = row.address;
    if (!existing.pekerjaan && row.occupation) memberUpdate.pekerjaan = row.occupation;
    if (!existing.statusNikah && row.maritalStatus) memberUpdate.statusNikah = row.maritalStatus;
    const emergencyContact = this.combineEmergencyContact(row);
    if (!existing.emergencyContact && emergencyContact) memberUpdate.emergencyContact = emergencyContact;
    if (!existing.sumberInfoRaho && row.infoSource) memberUpdate.sumberInfoRaho = row.infoSource;
    if (!existing.postalCode && row.postalCode) memberUpdate.postalCode = row.postalCode;
    if (!existing.isConsentToPhoto && row.isConsentToPhoto) memberUpdate.isConsentToPhoto = true;

    if (Object.keys(memberUpdate).length > 0) {
      await tx.member.update({
        where: { id: existing.id },
        data: memberUpdate,
      });
    }

    await tx.branchMemberAccess.upsert({
      where: { memberId_branchId: { memberId: existing.id, branchId } },
      update: {},
      create: {
        memberId: existing.id,
        branchId,
        grantedBy: actorUserId,
        notes: 'Melengkapi data member existing dari import Excel',
      },
    });
  }

  private issue(row: ParsedMemberAccount, field: string, message: string): RowIssue {
    return {
      rowNumber: row.rowNumber,
      field,
      message,
      fullName: row.fullName || '-',
      nik: row.nik,
      birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
    };
  }

  private groupIssuesByRow(issues: RowIssue[]) {
    const grouped = new Map<number, RowIssue[]>();
    for (const issue of issues) {
      grouped.set(issue.rowNumber, [...(grouped.get(issue.rowNumber) || []), issue]);
    }
    return grouped;
  }

  private async nextMemberNo(tx: DbClient, branchCode: string) {
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `MBR-${branchCode}-${yymm}-`;
    const latest = await tx.member.findFirst({
      where: { memberNo: { startsWith: prefix } },
      orderBy: { memberNo: 'desc' },
      select: { memberNo: true },
    });
    const latestSeq = latest?.memberNo ? Number(latest.memberNo.split('-').pop()) || 0 : 0;
    return generateMemberNo(branchCode, latestSeq + 1);
  }

  private async uniqueUsername(tx: DbClient, preferred: string) {
    let username = preferred.toLowerCase();
    let index = 1;

    while (await tx.user.findUnique({ where: { email: username } })) {
      index += 1;
      username = this.appendUsernameSuffix(preferred, index);
    }

    return username;
  }

  private appendUsernameSuffix(username: string, index: number) {
    if (username.includes('@')) {
      const [name, domain] = username.split('@');
      return `${name}+${index}@${domain}`.toLowerCase();
    }

    return `${username}.${index}`.toLowerCase();
  }

  private generateUsername(row: ParsedMemberAccount, sequence: number) {
    const phoneTail = row.phone?.replace(/\D/g, '').slice(-4);
    const base = this.normalizePersonName(row.fullName).replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'member';
    const suffix = phoneTail ? `${phoneTail}.${sequence}` : `${row.rowNumber || sequence}`;
    const maxBaseLength = Math.max(1, 30 - suffix.length - 1);
    const trimmedBase = base.slice(0, maxBaseLength).replace(/\.+$/g, '') || 'member';
    return `${trimmedBase}.${suffix}`.slice(0, 30).toLowerCase();
  }

  private generatePassword() {
    return `Raho-${randomBytes(5).toString('hex')}`;
  }

  private combineEmergencyContact(row: ParsedMemberAccount) {
    if (!row.emergencyContact) return null;
    return row.emergencyContactPhone
      ? `${row.emergencyContact} - ${row.emergencyContactPhone}`
      : row.emergencyContact;
  }

  private mapGender(value: string | null): Gender | null {
    const normalized = this.normalize(value);
    if (!normalized) return null;
    if (normalized === 'l' || normalized.includes('laki')) return Gender.L;
    if (normalized === 'p' || normalized.includes('perempuan')) return Gender.P;
    return null;
  }

  private mapIdentityType(value: string | null): MemberIdentityType {
    const normalized = (value || 'NIK').trim().toUpperCase();
    const allowed: MemberIdentityType[] = ['NIK', 'PASSPORT', 'KITAS', 'VIP', 'SPECIAL', 'FOREIGN_AUTO', 'NO_NIK'];
    return allowed.includes(normalized as MemberIdentityType) ? normalized as MemberIdentityType : 'NIK';
  }

  private mapBoolean(value: string | null, fallback: boolean) {
    const normalized = this.normalize(value);
    if (!normalized) return fallback;
    if (['ya', 'yes', 'true', '1'].includes(normalized)) return true;
    if (['tidak', 'no', 'false', '0'].includes(normalized)) return false;
    return fallback;
  }

  private parseDate(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return this.startOfUtcDay(value);
    if (typeof value === 'number') {
      return this.startOfUtcDay(new Date(Math.round((value - 25569) * 86400 * 1000)));
    }

    const text = this.text(value);
    if (!text) return null;

    const parsed = parseMemberBirthDate(text);
    return parsed || null;
  }

  private cellValue(value: any): unknown {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value;
    if (typeof value !== 'object') return value;
    if ('result' in value) return this.cellValue(value.result);
    if ('text' in value) return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part: { text?: string }) => part.text || '').join('');
    }
    return String(value);
  }

  private optionalText(value: unknown) {
    const text = this.text(value);
    return text || null;
  }

  private text(value: unknown) {
    if (value === undefined || value === null) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).trim();
  }

  private normalizeNik(value: string | null) {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    return digits || null;
  }

  private normalize(value: string | null | undefined) {
    return (value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private normalizeHeader(value: string) {
    return this.normalize(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  private normalizePersonName(value: string | null | undefined) {
    return this.normalize(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private startOfUtcDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private isLikelyXlsx(buffer: Buffer) {
    return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  }
}
