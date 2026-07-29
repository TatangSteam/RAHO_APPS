import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  AuditAction,
  BottleType,
  DiagnosisCategory,
  EMRNoteType,
  EncounterStatus,
  Gender,
  PackageStatus,
  PackageType,
  PaymentPlanType,
  Prisma,
  Role,
  SessionType,
  VitalTiming,
  VitalType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';
import { generateMemberNo, generateStaffCode } from '@utils/codeGenerator';

type DbClient = typeof prisma | Prisma.TransactionClient;

interface ImportActor {
  id: string;
  userId?: string;
  role: string;
  email?: string;
  branches?: string[];
}

interface ImportBranch {
  id: string;
  branchCode: string;
  name: string;
  isActive: boolean;
}

interface ParsedMember {
  rowNumber: number;
  memberCode: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  nik: string | null;
  gender: Gender | null;
  tempatLahir: string | null;
  dateOfBirth: Date | null;
  agama: string | null;
  address: string | null;
  pekerjaan: string | null;
  statusNikah: string | null;
  emergencyContact: string | null;
  sumberInfoRaho: string | null;
  postalCode: string | null;
  registrationBranchName: string | null;
  referralCode: string | null;
  isConsentToPhoto: boolean;
  username: string | null;
  password: string | null;
}

interface ParsedPackage {
  rowNumber: number;
  packageCode: string;
  memberCode: string;
  packageKind: string | null;
  serviceType: string | null;
  boosterType: string | null;
  name: string;
  startDate: Date | null;
  expiredAt: Date | null;
  totalSessions: number;
  usedSessions: number;
  status: PackageStatus;
  finalPrice: number;
  notes: string | null;
}

interface ParsedDiagnosis {
  rowNumber: number;
  memberCode: string;
  diagnosisDate: Date | null;
  doctorName: string;
  diagnosa: string;
  categoryText: string | null;
  category: DiagnosisCategory | null;
  icdPrimer: string | null;
  icdSekunder: string | null;
  icdTersier: string | null;
  keluhan: string | null;
  riwayatPenyakit: string | null;
  riwayatSosial: string | null;
  riwayatPengobatan: string | null;
  pemeriksaanFisik: string | null;
  pemeriksaanTambahan: string | null;
  notes: string | null;
}

interface ParsedTherapyPlan {
  rowNumber: number;
  memberCode: string;
  setName: string | null;
  planNumber: number;
  infusKe: number | null;
  planDate: Date | null;
  keterangan: string | null;
  ifa250: number | null;
  ifa500: number | null;
  hho: number | null;
  hhoKonsentrat: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  noInIfa: number | null;
  ifaSubstances: string | null;
  ifaSubstanceTotalMl: number | null;
  notes: string | null;
}

interface ParsedSession {
  rowNumber: number;
  sessionCode: string;
  memberCode: string;
  branchName: string | null;
  treatmentDate: Date | null;
  infusKe: number;
  pelaksanaanText: string | null;
  adminName: string | null;
  doctorName: string | null;
  nurseName: string | null;
  booster: string | null;
  serviceCode: string | null;
  statusText: string;
  notes: string | null;
  encounterText: string | null;
  basicPackageCode: string | null;
  boosterPackageCode: string | null;
}

interface ParsedVital {
  rowNumber: number;
  sessionCode: string;
  recordedAt: Date | null;
  recordedBy: string | null;
  sistolBefore: number | null;
  diastolBefore: number | null;
  hrBefore: number | null;
  saturationBefore: number | null;
  piBefore: number | null;
  sistolAfter: number | null;
  diastolAfter: number | null;
  hrAfter: number | null;
  saturationAfter: number | null;
  piAfter: number | null;
  notes: string | null;
}

interface ParsedInfusion {
  rowNumber: number;
  sessionCode: string;
  jenisBotol: string | null;
  jenisCairan: string | null;
  volumeCarrier: number | null;
  jumlahJarum: number | null;
  tanggalProduksi: Date | null;
  ifa250: number | null;
  ifa500: number | null;
  hho: number | null;
  hhoKonsentrat: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  deviationNotes: string | null;
  notes: string | null;
}

interface ParsedMaterial {
  rowNumber: number;
  sessionCode: string;
  productName: string;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  recordedBy: string | null;
  notes: string | null;
}

interface ParsedEvaluation {
  rowNumber: number;
  sessionCode: string;
  noteType: EMRNoteType;
  emrContent: string | null;
  writtenBy: string | null;
  keluhan: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  rekomendasi: string | null;
  generalNotes: string | null;
  doctorName: string | null;
}

interface ParsedWorkbook {
  sheetNames: string[];
  members: ParsedMember[];
  packages: ParsedPackage[];
  diagnoses: ParsedDiagnosis[];
  therapyPlans: ParsedTherapyPlan[];
  sessions: ParsedSession[];
  vitals: ParsedVital[];
  infusions: ParsedInfusion[];
  materials: ParsedMaterial[];
  evaluations: ParsedEvaluation[];
  workbookBranchNames: string[];
  warnings: string[];
}

interface ImportOptions {
  markSessionsCompleted: boolean;
  createPlaceholderStaff: boolean;
  skipMaterialUsage: boolean;
}

type SheetRecord = {
  rowNumber: number;
  values: Record<string, unknown>;
};

type StaffRole = 'DOCTOR' | 'NURSE' | 'ADMIN_LAYANAN';

const HEADER_ROW = 5;
const FIRST_DATA_ROW = 6;

const DIAGNOSIS_CATEGORY_VALUES = new Set<string>(Object.values(DiagnosisCategory));

export class MemberHistoricalImportService {
  async dryRun(input: {
    buffer: Buffer;
    fileName: string;
    branchId: string;
    actor: ImportActor;
  }) {
    const branch = await this.getImportBranch(input.branchId, input.actor, prisma);
    const parsed = await this.parseWorkbook(input.buffer);
    const duplicates = this.findDuplicateGroups(parsed.members);
    const memberMatches = await this.findExistingMemberMatches(parsed.members, prisma);
    const staffPreview = await this.buildStaffPreview(parsed, branch);
    const errorsList = this.buildValidationErrors(parsed);
    const warnings = [...parsed.warnings];

    if (parsed.materials.length > 0) {
      warnings.push('Material Usage tidak akan diimpor oleh importer historis agar stok tidak berubah.');
    } else {
      warnings.push('Material Usage kosong. Sesi tetap dapat diimpor sebagai completed tanpa perubahan stok.');
    }

    if (parsed.sessions.some((session) => !session.treatmentDate)) {
      warnings.push('Ada sesi tanpa tanggal terapi. Baris tersebut akan dilewati saat import.');
    }

    return {
      fileName: input.fileName,
      branch: this.presentBranch(branch),
      sheetNames: parsed.sheetNames,
      counts: this.buildCounts(parsed),
      workbookBranchNames: parsed.workbookBranchNames,
      duplicates,
      memberMatching: {
        existing: memberMatches,
        willCreateMembers: parsed.members.length - memberMatches.length,
        willReuseMembers: memberMatches.length,
      },
      staffPreview,
      warnings,
      errors: errorsList,
      canImport: errorsList.length === 0,
    };
  }

  async execute(input: {
    buffer: Buffer;
    fileName: string;
    branchId: string;
    actor: ImportActor;
    options?: Partial<ImportOptions>;
    ipAddress?: string;
    userAgent?: string | string[];
  }) {
    const options: ImportOptions = {
      markSessionsCompleted: input.options?.markSessionsCompleted ?? true,
      createPlaceholderStaff: input.options?.createPlaceholderStaff ?? true,
      skipMaterialUsage: input.options?.skipMaterialUsage ?? true,
    };

    const parsed = await this.parseWorkbook(input.buffer);
    const validationErrors = this.buildValidationErrors(parsed);
    if (validationErrors.length > 0) {
      throw errors.badRequest('IMPORT_VALIDATION_FAILED', validationErrors[0].message);
    }

    const branch = await this.getImportBranch(input.branchId, input.actor, prisma);
    const actorId = input.actor.userId || input.actor.id;

    const result = await prisma.$transaction(async (tx) => {
      const txBranch = await this.getImportBranch(input.branchId, input.actor, tx);
      const staffResolver = await this.createStaffResolver(tx, txBranch, actorId, options);
      const memberByCode = new Map<string, string>();
      const packageByCode = new Map<string, string>();
      const packageByMember = new Map<string, string>();
      const encounterByPackage = new Map<string, string>();
      const therapyPlanByMemberInfus = new Map<string, string>();
      const sessionByCode = new Map<string, string>();
      const sessionRowByCode = new Map<string, ParsedSession>();
      const imported = {
        createdMembers: 0,
        reusedMembers: 0,
        createdPackages: 0,
        reusedPackages: 0,
        createdDiagnoses: 0,
        createdTherapyPlans: 0,
        createdSessions: 0,
        skippedSessions: 0,
        createdVitals: 0,
        createdInfusions: 0,
        createdEvaluations: 0,
        createdEmrNotes: 0,
        skippedMaterials: parsed.materials.length,
        createdPlaceholderStaff: 0,
      };
      const warnings: string[] = [...parsed.warnings];

      for (const member of parsed.members) {
        const existing = await this.findExistingMemberForImport(tx, member);
        if (existing) {
          memberByCode.set(member.memberCode, existing.id);
          await this.ensureBranchMemberAccess(tx, existing.id, txBranch.id, actorId);
          imported.reusedMembers += 1;
          continue;
        }

        const userLogin = await this.getUniqueUserLogin(
          tx,
          member.username || member.email || `${this.slug(member.memberCode)}@member-import.raho.local`,
          member.memberCode,
        );
        const passwordHash = await bcrypt.hash(member.password || this.generatePassword(), 10);
        const memberNo = await this.generateNextMemberNo(tx, txBranch.branchCode);

        const createdUser = await tx.user.create({
          data: {
            email: userLogin,
            password: passwordHash,
            role: Role.MEMBER,
            branchId: txBranch.id,
            isActive: true,
            profile: {
              create: {
                fullName: member.fullName,
                phone: member.phone,
              },
            },
          },
        });

        const referralCode = member.referralCode
          ? await tx.referralCode.findUnique({ where: { code: member.referralCode } })
          : null;

        const createdMember = await tx.member.create({
          data: {
            userId: createdUser.id,
            memberNo,
            registrationBranchId: txBranch.id,
            referralCodeId: referralCode?.id,
            nik: member.nik,
            tempatLahir: member.tempatLahir,
            dateOfBirth: member.dateOfBirth,
            jenisKelamin: member.gender,
            agama: member.agama,
            address: member.address,
            pekerjaan: member.pekerjaan,
            statusNikah: member.statusNikah,
            emergencyContact: member.emergencyContact,
            sumberInfoRaho: member.sumberInfoRaho,
            postalCode: member.postalCode,
            isConsentToPhoto: member.isConsentToPhoto,
            isActive: true,
          },
        });

        memberByCode.set(member.memberCode, createdMember.id);
        await this.ensureBranchMemberAccess(tx, createdMember.id, txBranch.id, actorId);
        imported.createdMembers += 1;
      }

      for (const packageRow of parsed.packages) {
        const memberId = memberByCode.get(packageRow.memberCode);
        if (!memberId) {
          warnings.push(`Paket row ${packageRow.rowNumber} dilewati karena member tidak ditemukan.`);
          continue;
        }

        const packageCode = packageRow.packageCode || `PKG-IMP-${txBranch.branchCode}-${packageRow.memberCode}`;
        const existingPackage = await tx.memberPackage.findUnique({ where: { packageCode } });
        if (existingPackage) {
          packageByCode.set(packageCode, existingPackage.id);
          packageByMember.set(packageRow.memberCode, existingPackage.id);
          imported.reusedPackages += 1;
          continue;
        }

        const createdPackage = await tx.memberPackage.create({
          data: {
            packageCode,
            memberId,
            branchId: txBranch.id,
            packageType: this.mapPackageType(packageRow.packageKind),
            productCode: packageRow.serviceType,
            totalSessions: packageRow.totalSessions || 1,
            usedSessions: packageRow.usedSessions || 0,
            finalPrice: packageRow.finalPrice || 0,
            notes: packageRow.notes,
            status: packageRow.status,
            paymentPlanType: PaymentPlanType.FULL_PAYMENT,
            totalVerifiedPaid: packageRow.finalPrice || 0,
            boosterType: packageRow.boosterType,
            serviceType: packageRow.serviceType,
            revenueFlowVersion: 1,
            assignedBy: actorId,
            verifiedBy: actorId,
            verifiedAt: new Date(),
            paidAt: packageRow.startDate,
            activatedAt: packageRow.startDate,
            expiredAt: packageRow.expiredAt,
          },
        });

        packageByCode.set(packageCode, createdPackage.id);
        packageByMember.set(packageRow.memberCode, createdPackage.id);
        imported.createdPackages += 1;
      }

      for (const diagnosis of parsed.diagnoses) {
        const memberId = memberByCode.get(diagnosis.memberCode);
        if (!memberId || !diagnosis.diagnosa) continue;

        const diagnosisCode = this.importCode('DX', txBranch.branchCode, diagnosis.memberCode, diagnosis.rowNumber);
        const existingDiagnosis = await tx.diagnosis.findUnique({ where: { diagnosisCode } });
        if (existingDiagnosis) continue;

        await tx.diagnosis.create({
          data: {
            diagnosisCode,
            memberId,
            doktorPemeriksa: diagnosis.doctorName || 'Import Historis',
            diagnosa: diagnosis.diagnosa,
            kategoriDiagnosa: diagnosis.category,
            kategoriDiagnosaList: diagnosis.categoryText ? [diagnosis.categoryText] : undefined,
            icdPrimer: diagnosis.icdPrimer,
            icdSekunder: diagnosis.icdSekunder,
            icdTersier: diagnosis.icdTersier,
            keluhanRiwayatSekarang: diagnosis.keluhan,
            riwayatPenyakitTerdahulu: diagnosis.riwayatPenyakit,
            riwayatSosialKebiasaan: diagnosis.riwayatSosial,
            riwayatPengobatan: diagnosis.riwayatPengobatan,
            pemeriksaanFisik: diagnosis.pemeriksaanFisik,
            pemeriksaanTambahan: diagnosis.pemeriksaanTambahan
              ? { raw: diagnosis.pemeriksaanTambahan, notes: diagnosis.notes }
              : diagnosis.notes
                ? { notes: diagnosis.notes }
                : undefined,
          },
        });
        imported.createdDiagnoses += 1;
      }

      for (const [memberCode, memberPlans] of this.groupBy(parsed.therapyPlans, (plan) => plan.memberCode)) {
        const memberId = memberByCode.get(memberCode);
        if (!memberId) continue;

        const setCode = `TPS-IMP-${txBranch.branchCode}-${this.safeCode(memberCode)}`;
        let planSet = await tx.therapyPlanSet.findUnique({ where: { setCode } });
        if (!planSet) {
          planSet = await tx.therapyPlanSet.create({
            data: {
              memberId,
              setCode,
              name: memberPlans[0]?.setName || `Import ${memberCode}`,
              createdBy: actorId,
            },
          });
        }

        const usedPlanNumbers = new Set<number>();
        for (const plan of memberPlans) {
          const planNumber = plan.infusKe || plan.planNumber || plan.rowNumber;
          if (usedPlanNumbers.has(planNumber)) continue;
          usedPlanNumbers.add(planNumber);

          const planCode = this.importCode('TP', txBranch.branchCode, memberCode, planNumber);
          let therapyPlan = await tx.therapyPlan.findUnique({ where: { planCode } });
          if (!therapyPlan) {
            therapyPlan = await tx.therapyPlan.create({
              data: {
                planCode,
                memberId,
                therapyPlanSetId: planSet.id,
                planNumber,
                keterangan: [plan.keterangan, plan.notes].filter(Boolean).join('\n') || null,
                ifa250: plan.ifa250,
                ifa500: plan.ifa500,
                hho: plan.hho,
                hhoKonsentrat: plan.hhoKonsentrat,
                h2: plan.h2,
                no: plan.no,
                gaso: plan.gaso,
                o2: plan.o2,
                o3: plan.o3,
                edta: plan.edta,
                mb: plan.mb,
                h2s: plan.h2s,
                kcl: plan.kcl,
                jmlNb: plan.jmlNb,
                noInIfa: plan.noInIfa,
                ifaSubstances: plan.ifaSubstances ? { raw: plan.ifaSubstances } : undefined,
                ifaSubstanceTotalMl: plan.ifaSubstanceTotalMl,
              },
            });
            imported.createdTherapyPlans += 1;
          }

          therapyPlanByMemberInfus.set(`${memberCode}:${planNumber}`, therapyPlan.id);
        }
      }

      for (const session of parsed.sessions) {
        sessionRowByCode.set(session.sessionCode, session);
        if (!session.treatmentDate) {
          imported.skippedSessions += 1;
          warnings.push(`Sesi ${session.sessionCode} dilewati karena tanggal terapi kosong.`);
          continue;
        }

        const memberId = memberByCode.get(session.memberCode);
        if (!memberId) {
          imported.skippedSessions += 1;
          warnings.push(`Sesi ${session.sessionCode} dilewati karena member tidak ditemukan.`);
          continue;
        }

        const existingSession = await tx.treatmentSession.findUnique({
          where: { sessionCode: session.sessionCode },
        });
        if (existingSession) {
          sessionByCode.set(session.sessionCode, existingSession.id);
          continue;
        }

        const packageId =
          (session.basicPackageCode && packageByCode.get(session.basicPackageCode)) ||
          packageByMember.get(session.memberCode);
        if (!packageId) {
          imported.skippedSessions += 1;
          warnings.push(`Sesi ${session.sessionCode} dilewati karena paket basic tidak ditemukan.`);
          continue;
        }

        const adminId = await staffResolver.resolveAdmin(session.adminName);
        const doctorId = await staffResolver.resolveStaff(session.doctorName, Role.DOCTOR);
        const nurseId = await staffResolver.resolveStaff(session.nurseName, Role.NURSE);
        imported.createdPlaceholderStaff = staffResolver.createdPlaceholders;

        const encounterId = await this.ensureEncounter(tx, {
          branch: txBranch,
          memberId,
          packageId,
          actorId,
          adminId,
          doctorId,
          nurseId,
          memberCode: session.memberCode,
        });
        encounterByPackage.set(packageId, encounterId);

        const createdSession = await tx.treatmentSession.create({
          data: {
            sessionCode: session.sessionCode,
            encounterId,
            branchId: txBranch.id,
            infusKe: session.infusKe || 1,
            branchInfusKe: session.infusKe || 1,
            pelaksanaan: this.mapSessionType(session.pelaksanaanText),
            treatmentDate: session.treatmentDate,
            isCompleted: options.markSessionsCompleted && this.isCompletedStatus(session.statusText),
            adminLayananId: adminId,
            doctorId,
            nurseId,
            boosterType: session.booster,
          },
        });

        await tx.sessionDoctor.upsert({
          where: { sessionId_doctorId: { sessionId: createdSession.id, doctorId } },
          update: { isPrimary: true },
          create: { sessionId: createdSession.id, doctorId, isPrimary: true },
        });
        await tx.sessionNurse.upsert({
          where: { sessionId_nurseId: { sessionId: createdSession.id, nurseId } },
          update: { isPrimary: true },
          create: { sessionId: createdSession.id, nurseId, isPrimary: true },
        });

        const therapyPlanId = therapyPlanByMemberInfus.get(`${session.memberCode}:${session.infusKe}`);
        if (therapyPlanId) {
          const currentPlan = await tx.therapyPlan.findUnique({
            where: { id: therapyPlanId },
            select: { treatmentSessionId: true },
          });
          if (!currentPlan?.treatmentSessionId) {
            await tx.therapyPlan.update({
              where: { id: therapyPlanId },
              data: { treatmentSessionId: createdSession.id },
            });
          }
        }

        sessionByCode.set(session.sessionCode, createdSession.id);
        imported.createdSessions += 1;
      }

      for (const vital of parsed.vitals) {
        const sessionId = sessionByCode.get(vital.sessionCode);
        if (!sessionId) continue;

        const vitalRows = this.buildVitalRows(vital);
        for (const item of vitalRows) {
          await tx.vitalSign.upsert({
            where: {
              treatmentSessionId_pencatatan_waktuCatat: {
                treatmentSessionId: sessionId,
                pencatatan: item.pencatatan,
                waktuCatat: item.waktuCatat,
              },
            },
            update: {
              value: item.value,
              unit: item.unit,
              recordedBy: vital.recordedBy || actorId,
            },
            create: {
              treatmentSessionId: sessionId,
              pencatatan: item.pencatatan,
              waktuCatat: item.waktuCatat,
              value: item.value,
              unit: item.unit,
              recordedBy: vital.recordedBy || actorId,
            },
          });
          imported.createdVitals += 1;
        }
      }

      for (const infusion of parsed.infusions) {
        const sessionId = sessionByCode.get(infusion.sessionCode);
        if (!sessionId) continue;

        await tx.infusionExecution.upsert({
          where: { treatmentSessionId: sessionId },
          update: this.buildInfusionData(infusion),
          create: {
            treatmentSessionId: sessionId,
            ...this.buildInfusionData(infusion),
          },
        });
        imported.createdInfusions += 1;
      }

      for (const evaluation of parsed.evaluations) {
        const sessionId = sessionByCode.get(evaluation.sessionCode);
        if (!sessionId) continue;

        const session = sessionRowByCode.get(evaluation.sessionCode);
        const hasEvaluation = Boolean(
          evaluation.keluhan ||
          evaluation.subjective ||
          evaluation.objective ||
          evaluation.assessment ||
          evaluation.plan ||
          evaluation.rekomendasi ||
          evaluation.generalNotes,
        );

        if (hasEvaluation) {
          await tx.doctorEvaluation.upsert({
            where: { treatmentSessionId: sessionId },
            update: {
              keluhan: evaluation.keluhan,
              subjective: evaluation.subjective,
              objective: evaluation.objective,
              assessment: evaluation.assessment,
              plan: evaluation.plan,
              rekomendasi: evaluation.rekomendasi,
              generalNotes: evaluation.generalNotes,
              writtenBy: evaluation.doctorName || evaluation.writtenBy || session?.doctorName || actorId,
            },
            create: {
              evaluationCode: this.importCode('EVL', txBranch.branchCode, evaluation.sessionCode, evaluation.rowNumber),
              treatmentSessionId: sessionId,
              keluhan: evaluation.keluhan,
              subjective: evaluation.subjective,
              objective: evaluation.objective,
              assessment: evaluation.assessment,
              plan: evaluation.plan,
              rekomendasi: evaluation.rekomendasi,
              generalNotes: evaluation.generalNotes,
              writtenBy: evaluation.doctorName || evaluation.writtenBy || session?.doctorName || actorId,
            },
          });
          imported.createdEvaluations += 1;
        }

        if (evaluation.emrContent) {
          const existingNote = await tx.eMRNote.findFirst({
            where: {
              treatmentSessionId: sessionId,
              noteType: evaluation.noteType,
              content: evaluation.emrContent,
            },
          });
          if (!existingNote) {
            await tx.eMRNote.create({
              data: {
                treatmentSessionId: sessionId,
                noteType: evaluation.noteType,
                content: evaluation.emrContent,
                writtenBy: evaluation.writtenBy || evaluation.doctorName || actorId,
              },
            });
            imported.createdEmrNotes += 1;
          }
        }
      }

      await this.updatePackageUsage(tx, packageByCode, parsed.sessions);

      return {
        branch: this.presentBranch(txBranch),
        counts: this.buildCounts(parsed),
        imported,
        warnings: options.skipMaterialUsage
          ? [...warnings, 'Material Usage dilewati. Tidak ada pengurangan stok dari import historis ini.']
          : warnings,
      };
    }, { maxWait: 10000, timeout: 120000 });

    await logAudit({
      userId: actorId,
      branchId: branch.id,
      action: AuditAction.UPLOAD_FILE,
      resource: 'MemberHistoricalImport',
      resourceId: input.fileName,
      description: `Import historis member dari ${input.fileName}`,
      meta: {
        fileName: input.fileName,
        branchId: branch.id,
        imported: result.imported,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return result;
  }

  private async parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const warnings: string[] = [];
    const members = this.getSheetRecords(workbook, '01 Member').map((row) => this.mapMember(row));
    const packages = this.getSheetRecords(workbook, '02 Paket Member').map((row) => this.mapPackage(row));
    const diagnoses = this.getSheetRecords(workbook, '02 Diagnosa').map((row) => this.mapDiagnosis(row));
    const therapyPlans = this.getSheetRecords(workbook, '03 Therapy Plan').map((row) => this.mapTherapyPlan(row));
    const sessions = this.getSheetRecords(workbook, '04 Sesi Terapi').map((row) => this.mapSession(row));
    const vitals = this.getSheetRecords(workbook, '05 Vital Sesi').map((row) => this.mapVital(row));
    const infusions = this.getSheetRecords(workbook, '06 Infus Aktual').map((row) => this.mapInfusion(row));
    const materials = this.getSheetRecords(workbook, '07 Material Usage').map((row) => this.mapMaterial(row));
    const evaluations = this.getSheetRecords(workbook, '08 Catatan Evaluasi').map((row) => this.mapEvaluation(row));

    if (members.length === 0) warnings.push('Sheet 01 Member tidak memiliki data.');
    if (sessions.length === 0) warnings.push('Sheet 04 Sesi Terapi tidak memiliki data sesi.');

    return {
      sheetNames: workbook.worksheets.map((sheet) => sheet.name),
      members: members.filter((member) => member.memberCode || member.fullName),
      packages: packages.filter((item) => item.packageCode || item.memberCode),
      diagnoses: diagnoses.filter((item) => item.memberCode && item.diagnosa),
      therapyPlans: therapyPlans.filter((item) => item.memberCode),
      sessions: sessions.filter((item) => item.sessionCode && item.memberCode),
      vitals: vitals.filter((item) => item.sessionCode),
      infusions: infusions.filter((item) => item.sessionCode),
      materials: materials.filter((item) => item.sessionCode || item.productName),
      evaluations: evaluations.filter((item) => item.sessionCode),
      workbookBranchNames: this.unique([
        ...members.map((member) => member.registrationBranchName),
        ...sessions.map((session) => session.branchName),
      ].filter(Boolean) as string[]),
      warnings,
    };
  }

  private getSheetRecords(workbook: ExcelJS.Workbook, sheetName: string): SheetRecord[] {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) return [];

    const headerRow = worksheet.getRow(HEADER_ROW);
    const headers = new Map<number, string>();
    for (let col = 1; col <= worksheet.columnCount; col += 1) {
      const header = this.textValue(this.cellValue(headerRow.getCell(col).value));
      if (header) headers.set(col, header);
    }

    const rows: SheetRecord[] = [];
    for (let rowNumber = FIRST_DATA_ROW; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values: Record<string, unknown> = {};
      let hasAnyValue = false;

      for (const [col, header] of headers) {
        const value = this.cellValue(row.getCell(col).value);
        values[header] = value;
        if (this.textValue(value)) hasAnyValue = true;
      }

      if (hasAnyValue) {
        rows.push({ rowNumber, values });
      }
    }

    return rows;
  }

  private mapMember(row: SheetRecord): ParsedMember {
    return {
      rowNumber: row.rowNumber,
      memberCode: this.getText(row, 'Kode Member Excel *'),
      fullName: this.getText(row, 'Nama Lengkap *'),
      email: this.getOptionalText(row, 'Email'),
      phone: this.getOptionalText(row, 'No HP/WA'),
      nik: this.normalizeNik(this.getOptionalText(row, 'NIK')),
      gender: this.mapGender(this.getOptionalText(row, 'Jenis Kelamin')),
      tempatLahir: this.getOptionalText(row, 'Tempat Lahir'),
      dateOfBirth: this.getDate(row, 'Tanggal Lahir'),
      agama: this.getOptionalText(row, 'Agama'),
      address: this.getOptionalText(row, 'Alamat Lengkap'),
      postalCode: this.getOptionalText(row, 'Kode Pos'),
      pekerjaan: this.getOptionalText(row, 'Pekerjaan'),
      statusNikah: this.getOptionalText(row, 'Status Nikah'),
      emergencyContact: this.getOptionalText(row, 'Kontak Darurat'),
      sumberInfoRaho: this.getOptionalText(row, 'Sumber Info RAHO'),
      registrationBranchName: this.getOptionalText(row, 'Cabang Registrasi *'),
      referralCode: this.getOptionalText(row, 'Kode Referral'),
      isConsentToPhoto: this.mapBoolean(this.getOptionalText(row, 'Setuju Foto?'), true),
      username: this.getOptionalText(row, 'Username Login'),
      password: this.getOptionalText(row, 'Password Awal'),
    };
  }

  private mapPackage(row: SheetRecord): ParsedPackage {
    const totalSessions = this.getNumber(row, 'Total Sesi Paket *') || 1;
    return {
      rowNumber: row.rowNumber,
      packageCode: this.getText(row, 'Kode Paket Excel *'),
      memberCode: this.getText(row, 'Kode Member Excel *'),
      packageKind: this.getOptionalText(row, 'Jenis Paket *'),
      serviceType: this.getOptionalText(row, 'Jenis Layanan'),
      boosterType: this.getOptionalText(row, 'Booster'),
      name: this.getText(row, 'Nama Paket / Produk *') || 'Import Historis',
      startDate: this.getDate(row, 'Tanggal Mulai'),
      expiredAt: this.getDate(row, 'Tanggal Expired'),
      totalSessions,
      usedSessions: this.getNumber(row, 'Sesi Terpakai (auto)') || 0,
      status: this.mapPackageStatus(this.getOptionalText(row, 'Status Paket')),
      finalPrice: this.getMoney(row, 'Harga Akhir (Rp)') || 0,
      notes: this.getOptionalText(row, 'Catatan Paket'),
    };
  }

  private mapDiagnosis(row: SheetRecord): ParsedDiagnosis {
    const categoryText = this.getOptionalText(row, 'Kategori Diagnosa');
    return {
      rowNumber: row.rowNumber,
      memberCode: this.getText(row, 'Kode Member Excel *'),
      diagnosisDate: this.getDate(row, 'Tanggal Diagnosa *'),
      doctorName: this.getText(row, 'Dokter Pemeriksa *'),
      diagnosa: this.getText(row, 'Diagnosa Utama *'),
      categoryText,
      category: this.mapDiagnosisCategory(categoryText),
      icdPrimer: this.getOptionalText(row, 'ICD Primer'),
      icdSekunder: this.getOptionalText(row, 'ICD Sekunder'),
      icdTersier: this.getOptionalText(row, 'ICD Tersier'),
      keluhan: this.getOptionalText(row, 'Keluhan / Riwayat Sekarang'),
      riwayatPenyakit: this.getOptionalText(row, 'Riwayat Penyakit Terdahulu'),
      riwayatSosial: this.getOptionalText(row, 'Riwayat Sosial / Kebiasaan'),
      riwayatPengobatan: this.getOptionalText(row, 'Riwayat Pengobatan'),
      pemeriksaanFisik: this.getOptionalText(row, 'Pemeriksaan Fisik'),
      pemeriksaanTambahan: this.getOptionalText(row, 'Pemeriksaan Tambahan'),
      notes: this.getOptionalText(row, 'Catatan Diagnosa'),
    };
  }

  private mapTherapyPlan(row: SheetRecord): ParsedTherapyPlan {
    return {
      rowNumber: row.rowNumber,
      memberCode: this.getText(row, 'Kode Member Excel *'),
      setName: this.getOptionalText(row, 'Nama Set Plan'),
      planNumber: this.getNumber(row, 'Plan Ke *') || row.rowNumber,
      infusKe: this.getNumber(row, 'Infus Ke'),
      planDate: this.getDate(row, 'Tanggal Plan'),
      keterangan: this.getOptionalText(row, 'Keterangan'),
      ifa250: this.getNumber(row, 'IFA 250 (botol)'),
      ifa500: this.getNumber(row, 'IFA 500 (botol)'),
      hho: this.getNumber(row, 'HHO'),
      hhoKonsentrat: this.getNumber(row, 'HHO Konsentrat') || this.getNumber(row, 'HHOC') || this.getNumber(row, 'HHOKonsentrat'),
      h2: this.getNumber(row, 'H2'),
      no: this.getNumber(row, 'NO'),
      gaso: this.getNumber(row, 'GASO'),
      o2: this.getNumber(row, 'O2'),
      o3: this.getNumber(row, 'O3'),
      edta: this.getNumber(row, 'EDTA'),
      mb: this.getNumber(row, 'MB'),
      h2s: this.getNumber(row, 'H2S'),
      kcl: this.getNumber(row, 'KCL'),
      jmlNb: this.getNumber(row, 'Jml NB'),
      noInIfa: this.getNumber(row, 'NO dalam IFA'),
      ifaSubstances: this.getOptionalText(row, 'Zat IFA / Catatan Zat'),
      ifaSubstanceTotalMl: this.getNumber(row, 'Total Zat IFA (ml)'),
      notes: this.getOptionalText(row, 'Catatan Plan'),
    };
  }

  private mapSession(row: SheetRecord): ParsedSession {
    return {
      rowNumber: row.rowNumber,
      sessionCode: this.getText(row, 'Kode Sesi Excel *'),
      memberCode: this.getText(row, 'Kode Member Excel *'),
      branchName: this.getOptionalText(row, 'Cabang *'),
      treatmentDate: this.getDate(row, 'Tanggal Terapi *'),
      infusKe: this.getNumber(row, 'Infus Ke *') || 1,
      pelaksanaanText: this.getOptionalText(row, 'Pelaksanaan *'),
      adminName: this.getOptionalText(row, 'Admin Layanan'),
      doctorName: this.getOptionalText(row, 'Dokter Utama *'),
      nurseName: this.getOptionalText(row, 'Perawat Utama *'),
      booster: this.getOptionalText(row, 'Booster'),
      serviceCode: this.getOptionalText(row, 'Kode Paket / Layanan'),
      statusText: this.getText(row, 'Status Sesi *'),
      notes: this.getOptionalText(row, 'Catatan Sesi'),
      encounterText: this.getOptionalText(row, 'Rangkaian Terapi / Encounter'),
      basicPackageCode: this.getOptionalText(row, 'Kode Paket Basic Excel *'),
      boosterPackageCode: this.getOptionalText(row, 'Kode Paket Booster Excel'),
    };
  }

  private mapVital(row: SheetRecord): ParsedVital {
    return {
      rowNumber: row.rowNumber,
      sessionCode: this.getText(row, 'Kode Sesi Excel *'),
      recordedAt: this.getDate(row, 'Tanggal/Jam Catat'),
      recordedBy: this.getOptionalText(row, 'Petugas Pencatat *'),
      sistolBefore: this.getNumber(row, 'Sistol Sebelum (mmHg)'),
      diastolBefore: this.getNumber(row, 'Diastol Sebelum (mmHg)'),
      hrBefore: this.getNumber(row, 'HR Sebelum (bpm)'),
      saturationBefore: this.getNumber(row, 'Saturasi Sebelum (%)'),
      piBefore: this.getNumber(row, 'PI Sebelum'),
      sistolAfter: this.getNumber(row, 'Sistol Sesudah (mmHg)'),
      diastolAfter: this.getNumber(row, 'Diastol Sesudah (mmHg)'),
      hrAfter: this.getNumber(row, 'HR Sesudah (bpm)'),
      saturationAfter: this.getNumber(row, 'Saturasi Sesudah (%)'),
      piAfter: this.getNumber(row, 'PI Sesudah'),
      notes: this.getOptionalText(row, 'Catatan Vital'),
    };
  }

  private mapInfusion(row: SheetRecord): ParsedInfusion {
    return {
      rowNumber: row.rowNumber,
      sessionCode: this.getText(row, 'Kode Sesi Excel *'),
      jenisBotol: this.getOptionalText(row, 'Jenis Botol *'),
      jenisCairan: this.getOptionalText(row, 'Jenis Cairan'),
      volumeCarrier: this.getNumber(row, 'Volume Carrier (ml)'),
      jumlahJarum: this.getNumber(row, 'Jumlah Jarum'),
      tanggalProduksi: this.getDate(row, 'Tanggal Produksi'),
      ifa250: this.getNumber(row, 'IFA 250 Aktual'),
      ifa500: this.getNumber(row, 'IFA 500 Aktual'),
      hho: this.getNumber(row, 'HHO Aktual'),
      hhoKonsentrat: this.getNumber(row, 'HHO Konsentrat Aktual') || this.getNumber(row, 'HHOC Aktual') || this.getNumber(row, 'HHOKonsentrat Aktual'),
      h2: this.getNumber(row, 'H2 Aktual'),
      no: this.getNumber(row, 'NO Aktual'),
      gaso: this.getNumber(row, 'GASO Aktual'),
      o2: this.getNumber(row, 'O2 Aktual'),
      o3: this.getNumber(row, 'O3 Aktual'),
      edta: this.getNumber(row, 'EDTA Aktual'),
      mb: this.getNumber(row, 'MB Aktual'),
      h2s: this.getNumber(row, 'H2S Aktual'),
      kcl: this.getNumber(row, 'KCL Aktual'),
      jmlNb: this.getNumber(row, 'Jml NB Aktual'),
      deviationNotes: this.getOptionalText(row, 'Catatan Penyimpangan'),
      notes: this.getOptionalText(row, 'Catatan Infus'),
    };
  }

  private mapMaterial(row: SheetRecord): ParsedMaterial {
    return {
      rowNumber: row.rowNumber,
      sessionCode: this.getText(row, 'Kode Sesi Excel *'),
      productName: this.getText(row, 'Nama Material / Produk *'),
      sku: this.getOptionalText(row, 'SKU / Kode Barang'),
      quantity: this.getNumber(row, 'Jumlah Dipakai *'),
      unit: this.getOptionalText(row, 'Satuan *'),
      recordedBy: this.getOptionalText(row, 'Petugas Pencatat *'),
      notes: this.getOptionalText(row, 'Catatan Material'),
    };
  }

  private mapEvaluation(row: SheetRecord): ParsedEvaluation {
    return {
      rowNumber: row.rowNumber,
      sessionCode: this.getText(row, 'Kode Sesi Excel *'),
      noteType: this.mapEmrNoteType(this.getOptionalText(row, 'Jenis Catatan EMR')),
      emrContent: this.getOptionalText(row, 'Isi Catatan EMR'),
      writtenBy: this.getOptionalText(row, 'Ditulis Oleh'),
      keluhan: this.getOptionalText(row, 'Keluhan'),
      subjective: this.getOptionalText(row, 'Subjective'),
      objective: this.getOptionalText(row, 'Objective'),
      assessment: this.getOptionalText(row, 'Assessment'),
      plan: this.getOptionalText(row, 'Plan'),
      rekomendasi: this.getOptionalText(row, 'Rekomendasi'),
      generalNotes: this.getOptionalText(row, 'Catatan Umum'),
      doctorName: this.getOptionalText(row, 'Dokter Evaluasi'),
    };
  }

  private buildValidationErrors(parsed: ParsedWorkbook) {
    const errorsList: Array<{ field: string; message: string }> = [];
    if (parsed.members.length === 0) {
      errorsList.push({ field: '01 Member', message: 'Sheet 01 Member wajib berisi minimal 1 member.' });
    }

    parsed.members.forEach((member) => {
      if (!member.memberCode) {
        errorsList.push({ field: `01 Member row ${member.rowNumber}`, message: 'Kode Member Excel wajib diisi.' });
      }
      if (!member.fullName) {
        errorsList.push({ field: `01 Member row ${member.rowNumber}`, message: 'Nama Lengkap wajib diisi.' });
      }
    });

    parsed.sessions.forEach((session) => {
      if (!session.sessionCode) {
        errorsList.push({ field: `04 Sesi Terapi row ${session.rowNumber}`, message: 'Kode Sesi Excel wajib diisi.' });
      }
      if (!session.memberCode) {
        errorsList.push({ field: `04 Sesi Terapi row ${session.rowNumber}`, message: 'Kode Member Excel wajib diisi.' });
      }
    });

    return errorsList;
  }

  private buildCounts(parsed: ParsedWorkbook) {
    return {
      members: parsed.members.length,
      packages: parsed.packages.length,
      diagnoses: parsed.diagnoses.length,
      therapyPlans: parsed.therapyPlans.length,
      sessions: parsed.sessions.length,
      completedSessions: parsed.sessions.filter((session) => this.isCompletedStatus(session.statusText)).length,
      vitals: parsed.vitals.length,
      infusions: parsed.infusions.length,
      materials: parsed.materials.length,
      evaluations: parsed.evaluations.length,
    };
  }

  private async getImportBranch(branchId: string, actor: ImportActor, db: DbClient): Promise<ImportBranch> {
    if (!branchId) {
      throw errors.badRequest('BRANCH_REQUIRED', 'Cabang tujuan import wajib dipilih.');
    }

    const branch = await db.branch.findUnique({
      where: { id: branchId },
      select: { id: true, branchCode: true, name: true, isActive: true },
    });

    if (!branch) throw errors.notFound('Cabang tujuan import tidak ditemukan.');
    if (!branch.isActive) throw errors.unprocessable('BRANCH_INACTIVE', 'Cabang tujuan import tidak aktif.');

    if (actor.role === Role.ADMIN_MANAGER) {
      const actorId = actor.userId || actor.id;
      const allowedByToken = actor.branches?.includes(branchId);
      const allowedByDb = allowedByToken
        ? true
        : Boolean(await db.managerBranch.findFirst({ where: { userId: actorId, branchId } }));

      if (!allowedByDb) {
        throw errors.forbidden('Admin Manager hanya dapat import ke cabang yang dikelola.');
      }
    }

    return branch;
  }

  private findDuplicateGroups(members: ParsedMember[]) {
    return {
      byNik: this.duplicateGroups(members, (member) => member.nik || ''),
      byNameBirthNik: this.duplicateGroups(
        members,
        (member) => [this.normalizePersonName(member.fullName), this.dateKey(member.dateOfBirth), member.nik].join('|'),
      ),
      byNameBirth: this.duplicateGroups(
        members,
        (member) => [this.normalizePersonName(member.fullName), this.dateKey(member.dateOfBirth)].join('|'),
      ),
    };
  }

  private duplicateGroups(members: ParsedMember[], keyFn: (member: ParsedMember) => string) {
    const map = new Map<string, ParsedMember[]>();
    for (const member of members) {
      const key = keyFn(member);
      if (!key || key.includes('||')) continue;
      map.set(key, [...(map.get(key) || []), member]);
    }

    return Array.from(map.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        rows: items.map((item) => item.rowNumber),
        memberCodes: items.map((item) => item.memberCode),
        names: this.unique(items.map((item) => item.fullName).filter(Boolean)),
      }));
  }

  private async findExistingMemberMatches(members: ParsedMember[], db: DbClient) {
    const matches = [];
    for (const member of members) {
      const existing = await this.findExistingMemberForImport(db, member);
      if (existing) {
        matches.push({
          rowNumber: member.rowNumber,
          memberCode: member.memberCode,
          importedName: member.fullName,
          matchedBy: member.nik && existing.nik === member.nik ? 'NIK' : 'NAME_BIRTHDATE',
          existingMemberId: existing.id,
          existingMemberNo: existing.memberNo,
          existingName: existing.user?.profile?.fullName || existing.user?.email,
        });
      }
    }
    return matches;
  }

  private async findExistingMemberForImport(db: DbClient, member: ParsedMember): Promise<any | null> {
    if (member.nik) {
      const existingByNik = await db.member.findUnique({
        where: { nik: member.nik },
        include: { user: { include: { profile: true } } },
      });
      if (existingByNik) return existingByNik;
    }

    if (!member.fullName || !member.dateOfBirth) return null;

    const start = this.startOfUtcDay(member.dateOfBirth);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const candidates = await db.member.findMany({
      where: {
        dateOfBirth: { gte: start, lt: end },
      },
      include: { user: { include: { profile: true } } },
    });

    const normalizedName = this.normalizePersonName(member.fullName);
    return candidates.find((candidate) => {
      const existingName = candidate.user?.profile?.fullName || candidate.user?.email || '';
      return this.normalizePersonName(existingName) === normalizedName;
    }) || null;
  }

  private async buildStaffPreview(parsed: ParsedWorkbook, branch: ImportBranch) {
    const staffUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.DOCTOR, Role.NURSE, Role.ADMIN_LAYANAN] },
      },
      include: { profile: true },
    });
    const byRole = this.buildStaffCache(staffUsers);

    const doctors = this.unique([
      ...parsed.sessions.map((session) => session.doctorName),
      ...parsed.diagnoses.map((diagnosis) => diagnosis.doctorName),
      ...parsed.evaluations.map((evaluation) => evaluation.doctorName),
    ].filter(Boolean) as string[]);
    const nurses = this.unique(parsed.sessions.map((session) => session.nurseName).filter(Boolean) as string[]);
    const admins = this.unique(parsed.sessions.map((session) => session.adminName).filter(Boolean) as string[]);

    const adminNames = admins.length > 0 ? admins : [`Admin Layanan Import ${branch.branchCode}`];

    return {
      doctors: doctors.map((name) => this.presentStaffPreview(name, Role.DOCTOR, byRole)),
      nurses: nurses.map((name) => this.presentStaffPreview(name, Role.NURSE, byRole)),
      adminLayanan: adminNames.map((name) => this.presentStaffPreview(name, Role.ADMIN_LAYANAN, byRole)),
    };
  }

  private presentStaffPreview(name: string, role: StaffRole, byRole: Map<StaffRole, Map<string, any>>) {
    const match = byRole.get(role)?.get(this.normalizeStaffName(name));
    return {
      name,
      matched: Boolean(match),
      matchedUserId: match?.id || null,
      matchedName: match?.profile?.fullName || match?.email || null,
      action: match ? 'MATCH_EXISTING' : 'CREATE_PLACEHOLDER',
    };
  }

  private async createStaffResolver(
    tx: Prisma.TransactionClient,
    branch: ImportBranch,
    actorId: string,
    options: ImportOptions,
  ) {
    const staffUsers = await tx.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.DOCTOR, Role.NURSE, Role.ADMIN_LAYANAN] },
      },
      include: { profile: true },
    });
    const byRole = this.buildStaffCache(staffUsers);
    let createdPlaceholders = 0;

    const resolveStaff = async (name: string | null, role: StaffRole): Promise<string> => {
      const effectiveName = name || `${this.roleLabel(role)} Import ${branch.branchCode}`;
      const normalized = this.normalizeStaffName(effectiveName);
      const cached = byRole.get(role)?.get(normalized);
      if (cached) return cached.id;

      if (!options.createPlaceholderStaff) {
        throw errors.badRequest(
          'STAFF_NOT_FOUND',
          `${this.roleLabel(role)} "${effectiveName}" belum ada di user RAHO.`,
        );
      }

      const created = await this.createPlaceholderStaff(tx, effectiveName, role, branch);
      byRole.get(role)?.set(normalized, created);
      createdPlaceholders += 1;
      return created.id;
    };

    const resolveAdmin = async (name: string | null): Promise<string> => {
      if (name) return resolveStaff(name, Role.ADMIN_LAYANAN);

      const branchAdmin = await tx.user.findFirst({
        where: {
          role: Role.ADMIN_LAYANAN,
          isActive: true,
          OR: [
            { branchId: branch.id },
            { staffBranches: { some: { branchId: branch.id } } },
          ],
        },
        include: { profile: true },
      });
      if (branchAdmin) return branchAdmin.id;

      return resolveStaff(`Admin Layanan Import ${branch.branchCode}`, Role.ADMIN_LAYANAN);
    };

    return {
      resolveStaff,
      resolveAdmin,
      get createdPlaceholders() {
        return createdPlaceholders;
      },
    };
  }

  private buildStaffCache(staffUsers: any[]) {
    const cache = new Map<StaffRole, Map<string, any>>([
      [Role.DOCTOR, new Map()],
      [Role.NURSE, new Map()],
      [Role.ADMIN_LAYANAN, new Map()],
    ]);

    for (const user of staffUsers) {
      if (!cache.has(user.role)) continue;
      const names = [user.profile?.fullName, user.email].filter(Boolean) as string[];
      for (const name of names) {
        cache.get(user.role)?.set(this.normalizeStaffName(name), user);
      }
    }

    return cache;
  }

  private async createPlaceholderStaff(
    tx: Prisma.TransactionClient,
    fullName: string,
    role: StaffRole,
    branch: ImportBranch,
  ) {
    const login = await this.getUniqueUserLogin(
      tx,
      `import.${role.toLowerCase().replace('_', '-')}.${this.slug(fullName)}.${branch.branchCode.toLowerCase()}@raho.local`,
      role,
    );
    const passwordHash = await bcrypt.hash(this.generatePassword(), 10);
    const user = await tx.user.create({
      data: {
        email: login,
        password: passwordHash,
        role,
        branchId: branch.id,
        staffCode: generateStaffCode(role),
        isActive: true,
        profile: {
          create: {
            fullName,
          },
        },
      },
      include: { profile: true },
    });

    await tx.staffBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: {},
      create: { userId: user.id, branchId: branch.id },
    });

    return user;
  }

  private async ensureEncounter(tx: Prisma.TransactionClient, input: {
    branch: ImportBranch;
    memberId: string;
    packageId: string;
    actorId: string;
    adminId: string;
    doctorId: string;
    nurseId: string;
    memberCode: string;
  }) {
    const existing = await tx.encounter.findFirst({
      where: {
        memberId: input.memberId,
        memberPackageId: input.packageId,
      },
    });
    if (existing) return existing.id;

    const encounter = await tx.encounter.create({
      data: {
        encounterCode: `ENC-IMP-${input.branch.branchCode}-${this.safeCode(input.memberCode)}-${this.safeCode(input.packageId).slice(0, 8)}`,
        memberId: input.memberId,
        branchId: input.branch.id,
        memberPackageId: input.packageId,
        adminLayananId: input.adminId,
        doctorId: input.doctorId,
        nurseId: input.nurseId,
        status: EncounterStatus.CLOSED,
      },
    });

    return encounter.id;
  }

  private async ensureBranchMemberAccess(tx: Prisma.TransactionClient, memberId: string, branchId: string, actorId: string) {
    await tx.branchMemberAccess.upsert({
      where: { memberId_branchId: { memberId, branchId } },
      update: {},
      create: {
        memberId,
        branchId,
        grantedBy: actorId,
        notes: 'Import historis member',
      },
    });
  }

  private async generateNextMemberNo(tx: Prisma.TransactionClient, branchCode: string) {
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

  private async getUniqueUserLogin(tx: DbClient, candidate: string, suffix: string) {
    const base = candidate.trim() || `${this.slug(suffix)}@import.raho.local`;
    let current = base;
    let index = 0;

    while (await tx.user.findUnique({ where: { email: current } })) {
      index += 1;
      current = this.appendLoginSuffix(base, `${this.slug(suffix)}${index}`);
    }

    return current;
  }

  private appendLoginSuffix(login: string, suffix: string) {
    if (login.includes('@')) {
      const [name, domain] = login.split('@');
      return `${name}+${suffix}@${domain}`;
    }
    return `${login}.${suffix}`;
  }

  private async updatePackageUsage(
    tx: Prisma.TransactionClient,
    packageByCode: Map<string, string>,
    sessions: ParsedSession[],
  ) {
    const countsByPackageCode = new Map<string, number>();
    for (const session of sessions) {
      if (!session.basicPackageCode || !this.isCompletedStatus(session.statusText)) continue;
      countsByPackageCode.set(session.basicPackageCode, (countsByPackageCode.get(session.basicPackageCode) || 0) + 1);
    }

    for (const [packageCode, count] of countsByPackageCode) {
      const packageId = packageByCode.get(packageCode);
      if (!packageId) continue;
      const memberPackage = await tx.memberPackage.findUnique({
        where: { id: packageId },
        select: { usedSessions: true, totalSessions: true },
      });
      if (!memberPackage) continue;

      const nextUsed = Math.min(memberPackage.totalSessions, Math.max(memberPackage.usedSessions, count));
      if (nextUsed !== memberPackage.usedSessions) {
        await tx.memberPackage.update({
          where: { id: packageId },
          data: { usedSessions: nextUsed },
        });
      }
    }
  }

  private buildVitalRows(vital: ParsedVital) {
    const rows: Array<{ pencatatan: VitalType; waktuCatat: VitalTiming; value: number; unit: string }> = [];
    const push = (pencatatan: VitalType, waktuCatat: VitalTiming, value: number | null, unit: string) => {
      if (value === null || value === undefined) return;
      rows.push({ pencatatan, waktuCatat, value, unit });
    };

    push(VitalType.SISTOL, VitalTiming.SEBELUM, vital.sistolBefore, 'mmHg');
    push(VitalType.DIASTOL, VitalTiming.SEBELUM, vital.diastolBefore, 'mmHg');
    push(VitalType.HR, VitalTiming.SEBELUM, vital.hrBefore, 'bpm');
    push(VitalType.SATURASI, VitalTiming.SEBELUM, vital.saturationBefore, '%');
    push(VitalType.PI, VitalTiming.SEBELUM, vital.piBefore, '');
    push(VitalType.SISTOL, VitalTiming.SESUDAH, vital.sistolAfter, 'mmHg');
    push(VitalType.DIASTOL, VitalTiming.SESUDAH, vital.diastolAfter, 'mmHg');
    push(VitalType.HR, VitalTiming.SESUDAH, vital.hrAfter, 'bpm');
    push(VitalType.SATURASI, VitalTiming.SESUDAH, vital.saturationAfter, '%');
    push(VitalType.PI, VitalTiming.SESUDAH, vital.piAfter, '');
    return rows;
  }

  private buildInfusionData(infusion: ParsedInfusion) {
    const bottle = this.normalize(infusion.jenisBotol);
    const bottleType = bottle === 'ifa'
      ? BottleType.IFA
      : bottle === 'edta'
        ? BottleType.EDTA
        : null;

    return {
      ifa250: infusion.ifa250,
      ifa500: infusion.ifa500,
      hho: infusion.hho,
      hhoKonsentrat: infusion.hhoKonsentrat,
      h2: infusion.h2,
      no: infusion.no,
      gaso: infusion.gaso,
      o2: infusion.o2,
      o3: infusion.o3,
      edta: infusion.edta,
      mb: infusion.mb,
      h2s: infusion.h2s,
      kcl: infusion.kcl,
      jmlNb: infusion.jmlNb,
      deviationNotes: [infusion.deviationNotes, infusion.notes].filter(Boolean).join('\n') || null,
      bottleType,
      jenisCairan: infusion.jenisCairan || infusion.jenisBotol,
      volumeCarrier: infusion.volumeCarrier,
      jumlahJarum: infusion.jumlahJarum,
      tanggalProduksi: infusion.tanggalProduksi,
    };
  }

  private mapPackageType(value: string | null): PackageType {
    const normalized = this.normalize(value);
    if (normalized.includes('booster')) return PackageType.BOOSTER;
    return PackageType.BASIC;
  }

  private mapPackageStatus(value: string | null): PackageStatus {
    const normalized = this.normalize(value);
    if (normalized.includes('expired') || normalized.includes('kedaluwarsa')) return PackageStatus.EXPIRED;
    if (normalized.includes('cancel')) return PackageStatus.CANCELLED;
    if (normalized.includes('verification')) return PackageStatus.WAITING_VERIFICATION;
    if (normalized.includes('payment')) return PackageStatus.PENDING_PAYMENT;
    return PackageStatus.ACTIVE;
  }

  private mapSessionType(value: string | null): SessionType {
    const normalized = this.normalize(value);
    return normalized.includes('home') ? SessionType.HOME_CARE : SessionType.ON_SITE;
  }

  private mapGender(value: string | null): Gender | null {
    const normalized = this.normalize(value);
    if (!normalized) return null;
    if (normalized === 'l' || normalized.includes('laki')) return Gender.L;
    if (normalized === 'p' || normalized.includes('perempuan')) return Gender.P;
    return null;
  }

  private mapDiagnosisCategory(value: string | null): DiagnosisCategory | null {
    if (!value) return null;
    const normalized = this.safeCode(value);
    return DIAGNOSIS_CATEGORY_VALUES.has(normalized)
      ? normalized as DiagnosisCategory
      : null;
  }

  private mapEmrNoteType(value: string | null): EMRNoteType {
    const normalized = this.normalize(value);
    if (normalized.includes('operational')) return EMRNoteType.OPERATIONAL_NOTE;
    if (normalized.includes('assessment')) return EMRNoteType.ASSESSMENT;
    if (normalized.includes('outcome')) return EMRNoteType.OUTCOME_MONITORING;
    return EMRNoteType.CLINICAL_NOTE;
  }

  private mapBoolean(value: string | null, fallback: boolean) {
    const normalized = this.normalize(value);
    if (!normalized) return fallback;
    if (['ya', 'yes', 'true', '1'].includes(normalized)) return true;
    if (['tidak', 'no', 'false', '0'].includes(normalized)) return false;
    return fallback;
  }

  private isCompletedStatus(value: string | null) {
    const normalized = this.normalize(value);
    return normalized.includes('completed') || normalized.includes('selesai') || normalized.includes('complete');
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

  private getText(row: SheetRecord, key: string) {
    return this.textValue(row.values[key]);
  }

  private getOptionalText(row: SheetRecord, key: string) {
    return this.textValue(row.values[key]) || null;
  }

  private getNumber(row: SheetRecord, key: string) {
    return this.strictNumber(row.values[key]);
  }

  private getMoney(row: SheetRecord, key: string) {
    return this.moneyNumber(row.values[key]);
  }

  private getDate(row: SheetRecord, key: string) {
    return this.parseDate(row.values[key]);
  }

  private textValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value).trim();
  }

  private strictNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = this.textValue(value);
    const normalized = text.replace(/\s/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private moneyNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = this.textValue(value);
    if (!text) return null;
    const normalized = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return this.startOfUtcDay(value);

    if (typeof value === 'number') {
      const millis = Math.round((value - 25569) * 86400 * 1000);
      return this.startOfUtcDay(new Date(millis));
    }

    const text = this.textValue(value);
    if (!text) return null;

    const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (slash) {
      const day = Number(slash[1]);
      const month = Number(slash[2]);
      const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
      return new Date(Date.UTC(year, month - 1, day));
    }

    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : this.startOfUtcDay(parsed);
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

  private normalizePersonName(value: string | null | undefined) {
    return this.normalize(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeStaffName(value: string | null | undefined) {
    return this.normalizePersonName(value)
      .replace(/\b(dr|dokter)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private slug(value: string) {
    return this.normalizePersonName(value).replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '') || 'import';
  }

  private safeCode(value: string) {
    return this.normalize(value).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'IMPORT';
  }

  private importCode(prefix: string, branchCode: string, sourceCode: string, rowNumber: number | string) {
    return `${prefix}-IMP-${branchCode}-${this.safeCode(sourceCode)}-${rowNumber}`;
  }

  private dateKey(value: Date | null | undefined) {
    return value ? value.toISOString().slice(0, 10) : '';
  }

  private startOfUtcDay(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private presentBranch(branch: ImportBranch) {
    return {
      id: branch.id,
      branchCode: branch.branchCode,
      name: branch.name,
    };
  }

  private roleLabel(role: StaffRole) {
    if (role === Role.DOCTOR) return 'Dokter';
    if (role === Role.NURSE) return 'Perawat';
    return 'Admin Layanan';
  }

  private generatePassword() {
    return `Import-${randomBytes(9).toString('hex')}`;
  }

  private unique<T>(items: T[]) {
    return Array.from(new Set(items));
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string) {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    return groups;
  }
}
