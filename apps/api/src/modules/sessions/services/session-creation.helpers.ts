import { PackageStatus, PackageType, Prisma } from '@prisma/client';

export const DEBT_SESSION_LIMIT = 2;
export const DEBT_PACKAGE_STATUSES: PackageStatus[] = [
  PackageStatus.PENDING_PAYMENT,
  PackageStatus.WAITING_VERIFICATION,
];

interface SessionPackageAvailabilityInput {
  packageType: PackageType;
  status: PackageStatus;
  totalSessions: number;
  usedSessions: number;
}

export interface SessionPackageAvailability {
  mode: 'ACTIVE' | 'DEBT';
  remainingSessions: number;
}

export interface AutomaticKitMaterialDraft {
  inventoryItemId: string;
  quantity: Prisma.Decimal.Value;
  unit: string;
  conversionFactor: Prisma.Decimal.Value;
}

export function buildAutomaticKitMaterialUsageRows(
  sessionId: string,
  recordedBy: string,
  materials: AutomaticKitMaterialDraft[],
): Prisma.MaterialUsageCreateManyInput[] {
  return materials.map((material) => {
    const quantity = new Prisma.Decimal(material.quantity);
    const conversionFactor = new Prisma.Decimal(material.conversionFactor);

    if (conversionFactor.lessThanOrEqualTo(0)) {
      throw new Error('Conversion factor komponen Infus Set + Pelengkap harus lebih besar dari nol.');
    }

    return {
      usageKey: `${sessionId}:${material.inventoryItemId}`,
      treatmentSessionId: sessionId,
      inventoryItemId: material.inventoryItemId,
      quantity,
      unit: material.unit,
      baseQuantity: quantity.div(conversionFactor).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP),
      recommendedQuantity: quantity,
      recordedBy,
    };
  });
}

export function isDebtPackageStatus(status: PackageStatus): boolean {
  return DEBT_PACKAGE_STATUSES.includes(status);
}

export function getSessionPackageAvailability(
  memberPackage: SessionPackageAvailabilityInput,
): SessionPackageAvailability {
  if (memberPackage.packageType !== PackageType.BASIC) {
    throw {
      status: 422,
      code: 'INVALID_PACKAGE_TYPE',
      message:
        'Paket yang dipilih adalah paket BOOSTER. Untuk membuat sesi terapi baru, pilih paket BASIC (contoh: NB7, NB14, dll). Paket BOOSTER dapat ditambahkan melalui checkbox "Gunakan Paket Booster" setelah memilih paket BASIC.',
    };
  }

  const remainingSessions = memberPackage.totalSessions - memberPackage.usedSessions;

  if (remainingSessions < 1) {
    throw {
      status: 422,
      code: 'PACKAGE_SESSIONS_EXHAUSTED',
      message: 'Sesi paket sudah habis',
    };
  }

  if (memberPackage.status === PackageStatus.ACTIVE) {
    return { mode: 'ACTIVE', remainingSessions };
  }

  if (isDebtPackageStatus(memberPackage.status)) {
    return { mode: 'DEBT', remainingSessions };
  }

  throw {
    status: 422,
    code: 'PACKAGE_NOT_ACTIVE',
    message: 'Paket tidak aktif atau belum dapat digunakan untuk sesi terapi',
  };
}

export function getDebtSessionAllowance(
  remainingSessions: number,
  outstandingDebtSessions: number,
): number {
  const debtRemaining = Math.min(
    remainingSessions,
    DEBT_SESSION_LIMIT - outstandingDebtSessions,
  );

  if (debtRemaining < 1) {
    throw {
      status: 422,
      code: 'PACKAGE_DEBT_LIMIT_REACHED',
      message:
        'Paket belum dibayar. Sesi utang hanya bisa digunakan untuk 2 sesi pertama. Verifikasi pembayaran untuk membuat sesi berikutnya.',
    };
  }

  return debtRemaining;
}
