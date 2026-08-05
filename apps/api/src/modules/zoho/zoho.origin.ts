import { ZohoApiError } from './zoho.error';

export type OriginAwareMapping = {
  dataOrigin: 'UNKNOWN' | 'ERP' | 'MANUAL_ZOHO';
  managementMode: 'REVIEW_REQUIRED' | 'ERP_MANAGED' | 'MANUAL_ONLY';
};

export function erpOriginMarker(externalKey: string): string {
  return `[RAHO ERP] ${externalKey}`;
}

function collectStrings(value: unknown, output: string[], depth = 0): void {
  if (depth > 5 || output.length > 500 || value == null) return;
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, output, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>)
      .forEach((entry) => collectStrings(entry, output, depth + 1));
  }
}

export function remoteHasErpOrigin(remote: unknown, externalKey: string): boolean {
  const strings: string[] = [];
  collectStrings(remote, strings);
  const marker = erpOriginMarker(externalKey).toLowerCase();
  const key = externalKey.toLowerCase();
  return strings.some((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized === key || normalized.includes(marker);
  });
}

export function assertRemoteErpOrigin(remote: unknown, externalKey: string, label: string): void {
  if (remoteHasErpOrigin(remote, externalKey)) return;
  throw new ZohoApiError(
    `${label} dengan nomor/referensi yang sama sudah ada di Zoho, tetapi tidak memiliki penanda ERP ${externalKey}. `
      + 'Record dianggap input manual dan ditahan untuk review agar tidak terjadi overlap.',
    'ZOHO_MANUAL_DATA_OVERLAP',
    409,
    false,
  );
}

export function assertErpManaged(mapping: OriginAwareMapping, label: string): void {
  if (mapping.managementMode === 'ERP_MANAGED') return;
  throw new ZohoApiError(
    `${label} belum boleh diubah ERP karena mode mapping ${mapping.managementMode}. `
      + 'Verifikasi asal dan kepemilikan mapping terlebih dahulu.',
    'ZOHO_MAPPING_REVIEW_REQUIRED',
    409,
    false,
  );
}
