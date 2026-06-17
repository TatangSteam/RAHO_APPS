export interface TherapyPlanSubstance {
  name: string;
  amount: number;
  unit: string;
  keterangan?: string;
  isDefault?: boolean;
}

export const DEFAULT_IFA_SUBSTANCES: TherapyPlanSubstance[] = [
  {
    name: 'NO',
    amount: 2.5,
    unit: 'ml',
    keterangan: 'Default NO di IFA 2,5ml',
    isDefault: true,
  },
];

export function createDefaultIfaSubstances(): TherapyPlanSubstance[] {
  return DEFAULT_IFA_SUBSTANCES.map((item) => ({ ...item }));
}

export function calculateIfaSubstanceTotalMl(
  substances?: TherapyPlanSubstance[] | null
): number {
  if (!substances || substances.length === 0) return 0;

  return Number(
    substances
      .reduce((total, substance) => {
        const amount = Number(substance.amount);
        if (!Number.isFinite(amount) || amount <= 0) return total;
        return substance.unit.toLowerCase() === 'ml' ? total + amount : total;
      }, 0)
      .toFixed(2)
  );
}

function normalizeSubstanceName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isDefaultIfaSubstance(substance: TherapyPlanSubstance): boolean {
  const amount = Number(substance.amount);
  const unit = (substance.unit || 'ml').trim().toLowerCase();

  return (
    normalizeSubstanceName(substance.name) === 'no' &&
    unit === 'ml' &&
    Number.isFinite(amount) &&
    Math.abs(amount - 2.5) < 0.001
  );
}

export function hasAdditionalIfaSubstances(
  substances?: TherapyPlanSubstance[] | null,
  totalMl?: number | null
): boolean {
  const hasCustomSubstance = (substances || []).some((substance) => {
    const amount = Number(substance.amount);
    if (!normalizeSubstanceName(substance.name) || !Number.isFinite(amount) || amount <= 0) return false;
    return !isDefaultIfaSubstance(substance);
  });

  if (hasCustomSubstance) return true;

  const total = Number(totalMl);
  return Number.isFinite(total) && total > 2.5;
}

export function prepareIfaSubstancePayload(
  substances?: TherapyPlanSubstance[] | null
): { ifaSubstances: TherapyPlanSubstance[]; ifaSubstanceTotalMl: number } {
  const cleaned = (substances || [])
    .map((substance) => ({
      name: substance.name.trim(),
      amount: Number(substance.amount),
      unit: (substance.unit || 'ml').trim() || 'ml',
      keterangan: substance.keterangan?.trim() || undefined,
      isDefault: substance.isDefault || undefined,
    }))
    .filter((substance) => substance.name && Number.isFinite(substance.amount) && substance.amount > 0);

  return {
    ifaSubstances: cleaned,
    ifaSubstanceTotalMl: calculateIfaSubstanceTotalMl(cleaned),
  };
}
