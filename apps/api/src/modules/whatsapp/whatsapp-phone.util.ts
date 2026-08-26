export function normalizeIndonesianWhatsAppNumber(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;

  const normalized = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`;

  return /^62[1-9]\d{7,13}$/.test(normalized) ? normalized : null;
}

export function maskWhatsAppNumber(normalized: string): string {
  if (normalized.length < 8) return '***';
  return `${normalized.slice(0, 4)}****${normalized.slice(-3)}`;
}
