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

function toNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return numberValue;
}

export function normalizeIfaSubstances(
  input: unknown,
  useDefaultWhenMissing = false
): { ifaSubstances: TherapyPlanSubstance[] | null; ifaSubstanceTotalMl: number | null; noInIfa: number | null } {
  const source =
    input === undefined || input === null
      ? useDefaultWhenMissing
        ? DEFAULT_IFA_SUBSTANCES
        : []
      : input;

  if (!Array.isArray(source)) {
    return { ifaSubstances: null, ifaSubstanceTotalMl: null, noInIfa: null };
  }

  const substances = source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const name = String(raw.name || '').trim();
      const amount = toNumber(raw.amount);
      const unit = String(raw.unit || 'ml').trim() || 'ml';
      const keterangan = String(raw.keterangan || '').trim();

      if (!name || amount === null || amount <= 0) return null;

      return {
        name,
        amount,
        unit,
        ...(keterangan ? { keterangan } : {}),
        ...(Boolean(raw.isDefault) ? { isDefault: true } : {}),
      };
    })
    .filter((item): item is TherapyPlanSubstance => Boolean(item));

  const totalMl = substances.reduce((total, item) => {
    return item.unit.toLowerCase() === 'ml' ? total + item.amount : total;
  }, 0);

  const noInIfa = substances.find((item) => {
    return item.name.trim().toLowerCase() === 'no' && item.unit.toLowerCase() === 'ml';
  });

  return {
    ifaSubstances: substances.length > 0 ? substances : null,
    ifaSubstanceTotalMl: totalMl > 0 ? Number(totalMl.toFixed(2)) : null,
    noInIfa: noInIfa ? Number(noInIfa.amount.toFixed(2)) : null,
  };
}
