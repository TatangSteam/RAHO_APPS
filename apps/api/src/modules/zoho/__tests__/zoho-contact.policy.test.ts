import {
  buildZohoContactPayload,
  decideContactMatch,
  LocalContactSnapshot,
  splitContactName,
} from '../zoho.contact.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

const member: LocalContactSnapshot = {
  entityType: 'MEMBER',
  localEntityId: 'member-1',
  externalKey: 'RAHO:MEMBER:member-1',
  displayName: 'Budi Santoso',
  email: 'budi@example.com',
  phone: '08123456789',
  address: 'Jakarta',
  taxId: null,
  paymentTermsDays: 0,
  isActive: true,
};

describe('Zoho Sprint 3 contact payload', () => {
  it('maps Member to individual customer without medical data', () => {
    const payload = buildZohoContactPayload(member, 'custom-raho-id');
    expect(payload).toMatchObject({
      contact_name: 'Budi Santoso',
      contact_type: 'customer',
      customer_sub_type: 'individual',
      custom_fields: [{ customfield_id: 'custom-raho-id', value: member.externalKey }],
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/diagnos|therapy|nik|birth|medical|emergency/i);
  });

  it('maps Supplier to vendor with payment terms', () => {
    const payload = buildZohoContactPayload({
      ...member,
      entityType: 'SUPPLIER',
      externalKey: 'RAHO:SUPPLIER:supplier-1',
      displayName: 'PT Infus Sehat',
      taxId: '01.234.567.8-999.000',
      paymentTermsDays: 30,
    }, 'custom-raho-id');
    expect(payload).toMatchObject({
      contact_name: 'PT Infus Sehat',
      company_name: 'PT Infus Sehat',
      contact_type: 'vendor',
      payment_terms: 30,
    });
  });

  it('splits primary contact name deterministically', () => {
    expect(splitContactName('Budi Santoso Wijaya')).toEqual({
      first_name: 'Budi',
      last_name: 'Santoso Wijaya',
    });
  });
});

describe('Zoho Sprint 3 contact matching', () => {
  it('auto-matches exactly one RAHO external ID', () => {
    const decision = decideContactMatch(member, [{
      contact_id: 'z-1',
      contact_name: 'Nama lama',
      contact_type: 'customer',
      custom_fields: [{ label: 'RAHO External ID', value: member.externalKey }],
    }]);
    expect(decision.kind).toBe('AUTO_MATCH');
  });

  it('requires human review for a similar email or name', () => {
    const decision = decideContactMatch(member, [{
      contact_id: 'z-1',
      contact_name: member.displayName,
      contact_type: 'customer',
      email: member.email!,
    }]);
    expect(decision.kind).toBe('REVIEW');
  });

  it('requires human review when duplicate external IDs exist', () => {
    const candidate = {
      contact_name: member.displayName,
      contact_type: 'customer',
      custom_fields: [{ api_name: 'cf_raho_id', value: member.externalKey }],
    };
    const decision = decideContactMatch(member, [
      { ...candidate, contact_id: 'z-1' },
      { ...candidate, contact_id: 'z-2' },
    ]);
    expect(decision.kind).toBe('REVIEW');
  });

  it('does not reuse a contact with the wrong contact type', () => {
    const decision = decideContactMatch(member, [{
      contact_id: 'z-vendor',
      contact_name: member.displayName,
      contact_type: 'vendor',
      email: member.email!,
    }]);
    expect(decision.kind).toBe('CREATE');
  });

  it('requests the official contact write scopes in scope version 3', () => {
    expect(ZOHO_SCOPE_VERSION).toBe(3);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.contacts.READ',
      'ZohoBooks.contacts.CREATE',
      'ZohoBooks.contacts.UPDATE',
    ]));
  });
});
