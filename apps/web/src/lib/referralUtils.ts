import type { ReferralCode } from '@/lib/api/referralsApi';

export type ReferrerType = ReferralCode['referrerType'];

export const REFERRER_TYPE_OPTIONS: Array<{ value: ReferrerType; label: string }> = [
  { value: 'SALES', label: 'Sales' },
  { value: 'DOKTER', label: 'Dokter' },
  { value: 'MEMBER', label: 'Member' },
];

export function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function formatIncentive(type: string, value: number): string {
  if (type === 'PERCENTAGE') {
    return `${value}%`;
  }

  return formatCurrency(value);
}

export function getReferrerTypeLabel(type: string): string {
  return REFERRER_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export function datedExportFilename(prefix: string, extension: 'pdf' | 'xlsx'): string {
  return `${prefix}_${new Date().toISOString().split('T')[0]}.${extension}`;
}

export function downloadBlob(data: BlobPart, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
