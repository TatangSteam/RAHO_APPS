export type ContactEntityType = 'MEMBER' | 'SUPPLIER';
export type ZohoContactType = 'customer' | 'vendor';

export type LocalContactSnapshot = {
  entityType: ContactEntityType;
  localEntityId: string;
  externalKey: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  paymentTermsDays: number;
  isActive: boolean;
};

export type ZohoContactCandidate = {
  contact_id: string;
  contact_name: string;
  contact_type: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  status?: string;
  custom_fields?: Array<{
    customfield_id?: string;
    api_name?: string;
    label?: string;
    value?: unknown;
  }>;
};

export type ContactMatchDecision =
  | { kind: 'CREATE'; candidates: ZohoContactCandidate[] }
  | { kind: 'AUTO_MATCH'; contact: ZohoContactCandidate; candidates: ZohoContactCandidate[] }
  | { kind: 'REVIEW'; candidates: ZohoContactCandidate[]; reason: string };

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('id-ID') : '';
}

function customExternalId(candidate: ZohoContactCandidate): string | null {
  const field = candidate.custom_fields?.find((entry) => {
    const key = `${entry.api_name || ''} ${entry.label || ''}`.toLowerCase();
    return key.includes('raho') && (key.includes('id') || key.includes('external'));
  });
  return field?.value == null ? null : String(field.value);
}

export function expectedZohoContactType(entityType: ContactEntityType): ZohoContactType {
  return entityType === 'MEMBER' ? 'customer' : 'vendor';
}

export function splitContactName(displayName: string): { first_name: string; last_name?: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first_name: parts[0] || displayName };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

export function buildZohoContactPayload(
  snapshot: LocalContactSnapshot,
  customFieldId?: string,
): Record<string, unknown> {
  const contactType = expectedZohoContactType(snapshot.entityType);
  const person = {
    ...splitContactName(snapshot.displayName),
    ...(snapshot.email ? { email: snapshot.email } : {}),
    ...(snapshot.phone ? { phone: snapshot.phone, mobile: snapshot.phone } : {}),
    is_primary_contact: true,
  };
  return {
    contact_name: snapshot.displayName,
    contact_type: contactType,
    ...(contactType === 'customer' ? { customer_sub_type: 'individual' } : { company_name: snapshot.displayName }),
    payment_terms: snapshot.paymentTermsDays,
    ...(snapshot.address ? { billing_address: { address: snapshot.address } } : {}),
    contact_persons: [person],
    ...(customFieldId
      ? { custom_fields: [{ customfield_id: customFieldId, value: snapshot.externalKey }] }
      : {}),
  };
}

export function decideContactMatch(
  snapshot: LocalContactSnapshot,
  candidates: ZohoContactCandidate[],
): ContactMatchDecision {
  const expectedType = expectedZohoContactType(snapshot.entityType);
  const validType = candidates.filter((candidate) => candidate.contact_type === expectedType);
  const externalMatches = validType.filter(
    (candidate) => normalized(customExternalId(candidate)) === normalized(snapshot.externalKey),
  );
  if (externalMatches.length === 1) {
    return { kind: 'AUTO_MATCH', contact: externalMatches[0], candidates: validType };
  }
  if (externalMatches.length > 1) {
    return {
      kind: 'REVIEW',
      candidates: externalMatches,
      reason: 'Lebih dari satu contact Zoho memiliki external RAHO ID yang sama.',
    };
  }

  const identityMatches = validType.filter((candidate) => {
    const emailMatches = snapshot.email && normalized(candidate.email) === normalized(snapshot.email);
    const taxMatches = snapshot.taxId && normalized(candidate.tax_id) === normalized(snapshot.taxId);
    const nameMatches = normalized(candidate.contact_name) === normalized(snapshot.displayName);
    return Boolean(emailMatches || taxMatches || nameMatches);
  });
  if (identityMatches.length) {
    return {
      kind: 'REVIEW',
      candidates: identityMatches,
      reason: identityMatches.length === 1
        ? 'Ditemukan satu contact mirip tanpa external RAHO ID. Persetujuan manusia diperlukan.'
        : 'Ditemukan beberapa contact Zoho yang mirip. Pilih contact yang benar.',
    };
  }
  return { kind: 'CREATE', candidates: [] };
}
