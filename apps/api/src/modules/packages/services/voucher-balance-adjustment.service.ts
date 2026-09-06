import { AdminManagerAccessScope, AuditAction, PackageStatus, PackageType, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { calculatePerSessionRevenue } from '@modules/revenue/revenue.helpers';
import { logAudit } from '@utils/auditLog';
import type { AdjustVoucherBalanceInput } from '../packages.schema';

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_MANAGER']);

export function getAdjustedTotalSessions(usedSessions: number, remainingSessions: number): number {
  return usedSessions + remainingSessions;
}

export class VoucherBalanceAdjustmentService {
  async adjustVoucherBalance(
    packageId: string,
    data: AdjustVoucherBalanceInput,
    userId: string,
    userRole?: string,
  ) {
    if (!ALLOWED_ROLES.has(userRole || '')) {
      throw errors.forbidden('Hanya Super Admin atau Admin Manager yang dapat mengubah saldo voucher.');
    }

    const packageAccess = await prisma.memberPackage.findUnique({
      where: { id: packageId },
      select: { branchId: true, socialProgramRequestId: true },
    });
    if (!packageAccess) throw errors.notFound('Paket tidak ditemukan.');
    if (packageAccess.socialProgramRequestId) {
      throw errors.conflict('SOCIAL_PROGRAM_PACKAGE_LOCKED', 'Voucher Program Sosial dikunci sesuai hasil approval.');
    }
    await assertBranchAccess(userId, packageAccess.branchId);
    await assertPermission(userId, PERMISSIONS.INVOICE_UPDATE, packageAccess.branchId);

    if (userRole === 'ADMIN_MANAGER') {
      const managerBranch = await prisma.managerBranch.findUnique({
        where: { userId_branchId: { userId, branchId: packageAccess.branchId } },
        select: { accessScope: true },
      });
      if (managerBranch?.accessScope === AdminManagerAccessScope.MEMBER_VIEW_ONLY) {
        throw errors.forbidden('Akses Admin Manager untuk cabang ini dibatasi hanya untuk melihat data member.');
      }
    }

    const result = await prisma.$transaction(async (transaction) => {
      const memberPackage = await transaction.memberPackage.findUnique({
        where: { id: packageId },
        include: {
          benefitValuation: { include: { contract: true } },
        },
      });

      if (!memberPackage) throw errors.notFound('Paket tidak ditemukan.');
      if (![PackageType.BASIC, PackageType.BOOSTER].includes(memberPackage.packageType)) {
        throw errors.badRequest('PACKAGE_TYPE_NOT_ADJUSTABLE', 'Penyesuaian hanya berlaku untuk voucher BASIC atau BOOSTER.');
      }
      if (memberPackage.status !== PackageStatus.ACTIVE) {
        throw errors.badRequest('PACKAGE_NOT_ACTIVE', 'Hanya voucher dari paket aktif yang dapat diubah.');
      }

      const newTotalSessions = getAdjustedTotalSessions(
        memberPackage.usedSessions,
        data.remainingSessions,
      );
      const valuation = memberPackage.benefitValuation;

      if (valuation) {
        const contract = valuation.contract;
        const sessionsToRecognize = contract
          ? newTotalSessions - contract.recognizedSessions
          : newTotalSessions;
        const amountToRecognize = contract
          ? contract.remainingDeferredAmount
          : valuation.allocatedConsideration;

        if (sessionsToRecognize < 0) {
          throw errors.unprocessable(
            'VOUCHER_BELOW_RECOGNIZED_SESSIONS',
            'Sisa voucher tidak dapat dikurangi karena jumlah sesi yang sudah diakui lebih besar.',
          );
        }
        if (sessionsToRecognize === 0 && new Prisma.Decimal(amountToRecognize).greaterThan(0)) {
          throw errors.unprocessable(
            'VOUCHER_HAS_DEFERRED_REVENUE',
            'Voucher tidak dapat dibuat nol selama masih ada pendapatan diterima di muka. Gunakan proses refund atau pembatalan yang sesuai.',
          );
        }

        if (sessionsToRecognize > 0) {
          const schedule = calculatePerSessionRevenue(amountToRecognize, sessionsToRecognize);
          await transaction.packageBenefitValuation.update({
            where: { id: valuation.id },
            data: {
              totalSessions: newTotalSessions,
              regularSessionRevenue: schedule.regularSessionRevenue,
              finalSessionRevenue: schedule.finalSessionRevenue,
            },
          });
        } else {
          await transaction.packageBenefitValuation.update({
            where: { id: valuation.id },
            data: { totalSessions: newTotalSessions },
          });
        }
      }

      const updatedPackage = await transaction.memberPackage.update({
        where: { id: packageId },
        data: { totalSessions: newTotalSessions },
      });

      return {
        package: updatedPackage,
        before: {
          totalSessions: memberPackage.totalSessions,
          usedSessions: memberPackage.usedSessions,
          remainingSessions: memberPackage.totalSessions - memberPackage.usedSessions,
        },
        after: {
          totalSessions: updatedPackage.totalSessions,
          usedSessions: updatedPackage.usedSessions,
          remainingSessions: updatedPackage.totalSessions - updatedPackage.usedSessions,
        },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await logAudit({
      userId,
      userRole,
      branchId: result.package.branchId,
      action: AuditAction.UPDATE,
      resource: 'MemberPackage',
      resourceId: result.package.id,
      entityCode: result.package.packageCode,
      description: `Menyesuaikan sisa voucher ${result.package.packageType} menjadi ${result.after.remainingSessions} sesi`,
      beforeData: result.before,
      afterData: result.after,
      meta: {
        action: `ADJUST_${result.package.packageType}_VOUCHER_BALANCE`,
        reason: data.reason,
      },
    });

    return {
      packageId: result.package.id,
      packageCode: result.package.packageCode,
      ...result.after,
    };
  }
}
