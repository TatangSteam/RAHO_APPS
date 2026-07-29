import { createHmac } from 'crypto';
import {
  extractWebhookIdentity,
  isKnownWebhookEvent,
  verifyWebhookSignature,
  webhookDedupKey,
  webhookPayloadHash,
} from '../zoho.webhook.policy';

describe('Sprint 14 Zoho webhook policy', () => {
  const payload = {
    organization_id: 'org-1',
    event_type: 'invoice.updated',
    entity_type: 'invoice',
    invoice: {
      invoice_id: 'zoho-invoice-1',
      reference_number: 'RAHO:INV:1',
    },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  it('WH-U01 menghasilkan dedup key yang sama untuk delivery yang sama', () => {
    const identity = extractWebhookIdentity(payload, {});
    const payloadHash = webhookPayloadHash(payload);
    const first = webhookDedupKey({
      organizationId: 'org-1',
      deliveryId: 'delivery-1',
      identity,
      payloadHash,
    });
    const second = webhookDedupKey({
      organizationId: 'org-1',
      deliveryId: 'delivery-1',
      identity,
      payloadHash,
    });
    expect(first).toBe(second);
  });

  it('WH-U03 menerima shared header atau HMAC yang valid dan menolak yang salah', () => {
    const secret = 'rahoWebhookSecret123';
    const signature = createHmac('sha256', secret).update(rawBody).digest('base64');
    expect(verifyWebhookSignature({ rawBody, sharedSecretHeader: secret, secret })).toBe(true);
    expect(verifyWebhookSignature({ rawBody, signatureHeader: signature, secret })).toBe(true);
    expect(verifyWebhookSignature({ rawBody, signatureHeader: 'invalid', secret })).toBe(false);
  });

  it('mengekstrak source/entity dan mengenali event yang didukung', () => {
    const identity = extractWebhookIdentity(payload, {});
    expect(identity).toEqual(expect.objectContaining({
      eventType: 'INVOICE.UPDATED',
      zohoEntityType: 'INVOICE',
      zohoEntityId: 'zoho-invoice-1',
      externalReference: 'RAHO:INV:1',
      organizationId: 'org-1',
    }));
    expect(isKnownWebhookEvent(identity)).toBe(true);
  });

  it('WH-U04 menyatakan event unknown tidak dikenal tanpa melempar error', () => {
    const identity = extractWebhookIdentity({ event_type: 'mystery.changed', entity_type: 'mystery' }, {});
    expect(identity.eventType).toBe('MYSTERY.CHANGED');
    expect(isKnownWebhookEvent(identity)).toBe(false);
  });
});
