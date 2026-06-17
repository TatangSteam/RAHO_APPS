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
