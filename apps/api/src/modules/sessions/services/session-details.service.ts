// @ts-nocheck
import { prisma } from '../../../lib/prisma';
import { logAudit } from '../../../utils/auditLog';
import { AuditAction, PackageStatus, PackageType, Role } from '@prisma/client';
import type { UpdateSessionDetailsInput } from '../sessions.schema';
import { syncMemberVoucherUsageCount } from './voucher-usage-counter';

export class SessionDetailsService {
  async updateSessionDetails(
    sessionId: string,
    input: UpdateSessionDetailsInput,
    userId: string,
    branchId: string
  ) {
    const session = await prisma.treatmentSession.findUnique({
      where: { id: sessionId },
      include: {
        boosterPackage: true,
        encounter: {
          include: {
            memberPackage: true,
          },
        },
      },
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Sesi tidak ditemukan' };
    }

    if (session.branchId !== branchId) {
      throw {
        status: 403,
        code: 'SESSION_BRANCH_ACCESS_DENIED',
        message: 'Anda tidak memiliki akses ke sesi pada cabang ini',
      };
    }

    const encounterSessionCount = await prisma.treatmentSession.count({
      where: { encounterId: session.encounterId },
    });

    const nextMemberPackageId = input.memberPackageId ?? session.encounter.memberPackageId;
    const nextAdminLayananId = input.adminLayananId ?? session.adminLayananId;
    const nextDoctorId = input.doctorId ?? session.doctorId;
    const nextNurseId = input.nurseId ?? session.nurseId;
    const nextBoosterPackageId =
      input.useBooster === undefined
        ? session.boosterPackageId
        : input.useBooster
          ? input.boosterPackageId
          : null;

    await Promise.all([
      this.validateAdminLayanan(nextAdminLayananId),
      this.validateDoctor(nextDoctorId),
      this.validateNurse(nextNurseId),
      ...(input.additionalDoctorIds || []).map((doctorId) => this.validateDoctor(doctorId)),
      ...(input.additionalNurseIds || []).map((nurseId) => this.validateNurse(nurseId)),
    ]);

    let nextMemberPackage = session.encounter.memberPackage;
    if (nextMemberPackageId !== session.encounter.memberPackageId) {
      if (encounterSessionCount > 1) {
        throw {
          status: 409,
          code: 'ENCOUNTER_PACKAGE_SHARED',
          message:
            'Paket dasar tidak bisa diganti dari sesi ini karena encounter yang sama dipakai beberapa sesi. Edit paket dasar dari data encounter/paket agar sesi lain tidak ikut berubah.',
        };
      }

      nextMemberPackage = await this.validateBasicPackage(
        nextMemberPackageId,
        session.encounter.memberId,
        session.branchId
      );
    }

    let nextBoosterPackage = null;
    if (nextBoosterPackageId && nextBoosterPackageId !== session.boosterPackageId) {
      nextBoosterPackage = await this.validateBoosterPackage(
        nextBoosterPackageId,
        session.encounter.memberId,
        session.branchId
      );
    }

    if (session.boosterType && session.boosterPackageId !== nextBoosterPackageId) {
      throw {
        status: 409,
        code: 'BOOSTER_TYPE_ALREADY_USED',
        message: 'Paket booster tidak dapat diganti karena jenis booster/stok sudah digunakan pada sesi ini',
      };
    }

    const additionalDoctorIds = this.uniqueIds(input.additionalDoctorIds || []).filter(
      (doctorId) => doctorId !== nextDoctorId
    );
    const additionalNurseIds = this.uniqueIds(input.additionalNurseIds || []).filter(
      (nurseId) => nurseId !== nextNurseId
    );

    const result = await prisma.$transaction(async (tx) => {
      if (nextMemberPackageId !== session.encounter.memberPackageId) {
        await this.releasePackageUsage(tx, session.encounter.memberPackage);
        await this.consumePackageUsage(tx, nextMemberPackage);
      }

      if (session.boosterPackageId !== nextBoosterPackageId) {
        if (session.boosterPackage) {
          await this.releasePackageUsage(tx, session.boosterPackage);
        }

        if (nextBoosterPackage) {
          await this.consumePackageUsage(tx, nextBoosterPackage);
        }
      }

      if (encounterSessionCount === 1) {
        await tx.encounter.update({
          where: { id: session.encounterId },
          data: {
            memberPackageId: nextMemberPackageId,
            adminLayananId: nextAdminLayananId,
            doctorId: nextDoctorId,
            nurseId: nextNurseId,
          },
        });
      }

      const updatedSession = await tx.treatmentSession.update({
        where: { id: sessionId },
        data: {
          treatmentDate: input.treatmentDate ? new Date(input.treatmentDate) : undefined,
          pelaksanaan: input.pelaksanaan,
          adminLayananId: nextAdminLayananId,
          doctorId: nextDoctorId,
          nurseId: nextNurseId,
          boosterPackageId: nextBoosterPackageId,
          boosterType: nextBoosterPackageId ? session.boosterType : null,
        },
      });

      if (input.doctorId !== undefined || input.additionalDoctorIds !== undefined) {
        await tx.sessionDoctor.deleteMany({ where: { sessionId } });
        await tx.sessionDoctor.createMany({
          data: [
            { sessionId, doctorId: nextDoctorId, isPrimary: true },
            ...additionalDoctorIds.map((doctorId) => ({
              sessionId,
              doctorId,
              isPrimary: false,
            })),
          ],
          skipDuplicates: true,
        });
      }

      if (input.nurseId !== undefined || input.additionalNurseIds !== undefined) {
        await tx.sessionNurse.deleteMany({ where: { sessionId } });
        await tx.sessionNurse.createMany({
          data: [
            { sessionId, nurseId: nextNurseId, isPrimary: true },
            ...additionalNurseIds.map((nurseId) => ({
              sessionId,
              nurseId,
              isPrimary: false,
            })),
          ],
          skipDuplicates: true,
        });
      }

      await syncMemberVoucherUsageCount(tx, session.encounter.memberId);

      return updatedSession;
    });

    await logAudit({
      userId,
      branchId: session.branchId,
      action: AuditAction.UPDATE,
      resource: 'TreatmentSession',
      resourceId: sessionId,
      meta: {
        action: 'UPDATE_SESSION_DETAILS',
        previousMemberPackageId: session.encounter.memberPackageId,
        nextMemberPackageId,
        previousBoosterPackageId: session.boosterPackageId,
        nextBoosterPackageId,
        previousTreatmentDate: session.treatmentDate,
        nextTreatmentDate: input.treatmentDate,
        previousPelaksanaan: session.pelaksanaan,
        nextPelaksanaan: input.pelaksanaan,
        previousAdminLayananId: session.adminLayananId,
        nextAdminLayananId,
        previousDoctorId: session.doctorId,
        nextDoctorId,
        previousNurseId: session.nurseId,
        nextNurseId,
      },
    });

    return result;
  }

  private async validateBasicPackage(packageId: string, memberId: string, branchId: string) {
    const memberPackage = await prisma.memberPackage.findUnique({ where: { id: packageId } });

    if (!memberPackage) {
      throw { status: 404, code: 'PACKAGE_NOT_FOUND', message: 'Paket tidak ditemukan' };
    }

    if (memberPackage.memberId !== memberId) {
      throw {
        status: 422,
        code: 'PACKAGE_MEMBER_MISMATCH',
        message: 'Paket tidak terdaftar untuk member sesi ini',
      };
    }

    if (memberPackage.branchId !== branchId) {
      throw {
        status: 422,
        code: 'PACKAGE_BRANCH_MISMATCH',
        message: 'Paket tidak terdaftar di cabang sesi ini',
      };
    }

    if (memberPackage.packageType !== PackageType.BASIC) {
      throw { status: 422, code: 'INVALID_BASIC_PACKAGE', message: 'Paket dasar harus bertipe BASIC' };
    }

    if (memberPackage.status !== PackageStatus.ACTIVE) {
      throw { status: 422, code: 'PACKAGE_NOT_ACTIVE', message: 'Paket dasar tidak aktif' };
    }

    if (memberPackage.totalSessions - memberPackage.usedSessions <= 0) {
      throw { status: 422, code: 'PACKAGE_EXHAUSTED', message: 'Sesi paket dasar sudah habis' };
    }

    return memberPackage;
  }

  private async validateBoosterPackage(packageId: string, memberId: string, branchId: string) {
    const memberPackage = await prisma.memberPackage.findUnique({ where: { id: packageId } });

    if (!memberPackage) {
      throw { status: 404, code: 'BOOSTER_PACKAGE_NOT_FOUND', message: 'Paket booster tidak ditemukan' };
    }

    if (memberPackage.memberId !== memberId) {
      throw {
        status: 422,
        code: 'BOOSTER_MEMBER_MISMATCH',
        message: 'Paket booster tidak terdaftar untuk member sesi ini',
      };
    }

    if (memberPackage.branchId !== branchId) {
      throw {
        status: 422,
        code: 'BOOSTER_BRANCH_MISMATCH',
        message: 'Paket booster tidak terdaftar di cabang sesi ini',
      };
    }

    if (memberPackage.packageType !== PackageType.BOOSTER) {
      throw { status: 422, code: 'INVALID_BOOSTER_PACKAGE', message: 'Paket yang dipilih bukan paket booster' };
    }

    if (memberPackage.status !== PackageStatus.ACTIVE) {
      throw { status: 422, code: 'BOOSTER_NOT_ACTIVE', message: 'Paket booster tidak aktif' };
    }

    if (memberPackage.totalSessions - memberPackage.usedSessions <= 0) {
      throw { status: 422, code: 'BOOSTER_EXHAUSTED', message: 'Sesi booster sudah habis' };
    }

    return memberPackage;
  }

  private async validateDoctor(doctorId: string) {
    return this.validateStaffRole(doctorId, [Role.DOCTOR, Role.ADMIN_CABANG], 'INVALID_DOCTOR', 'Dokter tidak valid atau tidak aktif');
  }

  private async validateNurse(nurseId: string) {
    return this.validateStaffRole(nurseId, [Role.NURSE, Role.ADMIN_CABANG], 'INVALID_NURSE', 'Nakes tidak valid atau tidak aktif');
  }

  private async validateAdminLayanan(adminLayananId: string) {
    return this.validateStaffRole(
      adminLayananId,
      [Role.ADMIN_LAYANAN, Role.ADMIN_CABANG],
      'INVALID_ADMIN',
      'Admin layanan tidak valid atau tidak aktif'
    );
  }

  private async validateStaffRole(userId: string, roles: Role[], code: string, message: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !roles.includes(user.role as Role) || !user.isActive) {
      throw { status: 403, code, message };
    }

    return user;
  }

  private async releasePackageUsage(tx: any, memberPackage: any) {
    const usedSessions = Math.max(0, memberPackage.usedSessions - 1);
    await tx.memberPackage.update({
      where: { id: memberPackage.id },
      data: {
        usedSessions,
        status:
          memberPackage.status === PackageStatus.EXPIRED &&
          usedSessions < memberPackage.totalSessions
            ? PackageStatus.ACTIVE
            : memberPackage.status,
        expiredAt:
          memberPackage.status === PackageStatus.EXPIRED &&
          usedSessions < memberPackage.totalSessions
            ? null
            : memberPackage.expiredAt,
      },
    });
  }

  private async consumePackageUsage(tx: any, memberPackage: any) {
    const usedSessions = memberPackage.usedSessions + 1;
    await tx.memberPackage.update({
      where: { id: memberPackage.id },
      data: {
        usedSessions,
        status: usedSessions >= memberPackage.totalSessions ? PackageStatus.EXPIRED : memberPackage.status,
        expiredAt: usedSessions >= memberPackage.totalSessions ? new Date() : memberPackage.expiredAt,
      },
    });
  }

  private uniqueIds(ids: string[]) {
    return Array.from(new Set(ids.filter(Boolean)));
  }
}
