import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type WebhookIdentity = {
  eventType: string;
  zohoEntityType: string | null;
  zohoEntityId: string | null;
  externalReference: string | null;
  organizationId: string | null;
};

const KNOWN_ENTITY_TYPES = new Set([
  'CONTACT',
  'ITEM',
  'LOCATION',
  'INVOICE',
  'CUSTOMER_PAYMENT',
  'RETAINER_INVOICE',
  'JOURNAL',
  'EXPENSE',
  'PURCHASE_ORDER',
  'BILL',
  'VENDOR_PAYMENT',
  'INVENTORY_ADJUSTMENT',
]);

const text = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

function findFirst(value: unknown, keys: Set<string>): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirst(item, keys);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key.toLowerCase())) {
      const found = text(child);
      if (found) return found;
    }
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findFirst(child, keys);
    if (found) return found;
  }
  return null;
}

export function extractWebhookIdentity(
  payload: Record<string, unknown>,
  headers: Record<string, string | string[] | undefined>,
): WebhookIdentity {
  const header = (name: string) => text(headers[name] ?? headers[name.toLowerCase()]);
  const eventType = (
    header('x-zoho-event')
    || findFirst(payload, new Set(['event_type', 'eventtype', 'event', 'operation']))
    || 'UNKNOWN'
  ).toUpperCase();
  const entityFromPayload = findFirst(payload, new Set(['entity_type', 'entitytype', 'module', 'entity']));
  const entityFromEvent = eventType.split(/[._:-]/)[0];
  const zohoEntityType = (entityFromPayload || entityFromEvent || '').trim().toUpperCase() || null;
  const idKeys = new Set([
    'entity_id',
    'entityid',
    'zoho_entity_id',
    `${(zohoEntityType || '').toLowerCase()}_id`,
  ]);
  return {
    eventType,
    zohoEntityType,
    zohoEntityId: findFirst(payload, idKeys),
    externalReference: findFirst(payload, new Set([
      'reference_number',
      'invoice_number',
      'payment_number',
      'purchaseorder_number',
      'bill_number',
      'external_reference',
    ])),
    organizationId: findFirst(payload, new Set(['organization_id', 'organizationid'])),
  };
}

function equalSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function verifyWebhookSignature(input: {
  rawBody: Buffer;
  sharedSecretHeader?: string | null;
  signatureHeader?: string | null;
  secret?: string;
}): boolean {
  if (!input.secret) return false;
  if (input.sharedSecretHeader && equalSecret(input.sharedSecretHeader, input.secret)) return true;
  if (!input.signatureHeader) return false;
  const digest = createHmac('sha256', input.secret).update(input.rawBody).digest();
  const candidates = [
    digest.toString('hex'),
    digest.toString('base64'),
    `sha256=${digest.toString('hex')}`,
  ];
  return candidates.some((candidate) => equalSecret(candidate, input.signatureHeader!));
}

export function webhookPayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function webhookDedupKey(input: {
  organizationId: string;
  deliveryId?: string | null;
  identity: WebhookIdentity;
  payloadHash: string;
}): string {
  return createHash('sha256').update([
    input.organizationId,
    input.deliveryId || '',
    input.identity.eventType,
    input.identity.zohoEntityType || '',
    input.identity.zohoEntityId || '',
    input.payloadHash,
  ].join('|')).digest('hex');
}

export function isKnownWebhookEvent(identity: WebhookIdentity): boolean {
  return Boolean(identity.zohoEntityType && KNOWN_ENTITY_TYPES.has(identity.zohoEntityType));
}

export function compareWebhookWithMapping(
  identity: WebhookIdentity,
  payload: Record<string, unknown>,
  mapping: { externalKey: string | null; metadata: unknown },
) {
  const differences: string[] = [];
  if (identity.externalReference && mapping.externalKey
    && identity.externalReference !== mapping.externalKey) {
    differences.push('EXTERNAL_REFERENCE_MISMATCH');
  }
  const metadata = mapping.metadata && typeof mapping.metadata === 'object'
    ? mapping.metadata as Record<string, unknown>
    : {};
  const expectedAmount = Number(
    metadata.amountApplied
    ?? metadata.amount
    ?? metadata.totalAmount
    ?? Number.NaN,
  );
  const actualAmount = Number(findFirst(payload, new Set([
    'amount',
    'total',
    'payment_made',
    'amount_applied',
    'balance',
  ])) ?? Number.NaN);
  if (Number.isFinite(expectedAmount) && Number.isFinite(actualAmount)
    && Math.abs(expectedAmount - actualAmount) >= 0.01) {
    differences.push('AMOUNT_MISMATCH');
  }
  const remoteStatus = findFirst(payload, new Set(['status']));
  if (remoteStatus && /void|deleted|inactive|cancelled/i.test(remoteStatus)) {
    differences.push('STATUS_MISMATCH');
  }
  return differences;
}
