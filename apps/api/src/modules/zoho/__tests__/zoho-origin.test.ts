import {
  assertErpManaged,
  assertRemoteErpOrigin,
  erpOriginMarker,
  remoteHasErpOrigin,
} from '../zoho.origin';

describe('Zoho outbound origin protection', () => {
  const externalKey = 'RAHO:INVOICE:invoice-1';

  it('writes a stable visible ERP marker', () => {
    expect(erpOriginMarker(externalKey)).toBe('[RAHO ERP] RAHO:INVOICE:invoice-1');
  });

  it('recognizes exact external keys and nested visible markers', () => {
    expect(remoteHasErpOrigin({ reference_number: externalKey }, externalKey)).toBe(true);
    expect(remoteHasErpOrigin({ invoice: { notes: `Dibuat otomatis\n${erpOriginMarker(externalKey)}` } }, externalKey)).toBe(true);
  });

  it('does not adopt a manual record that only shares a business number', () => {
    const remote = { invoice_number: 'INV/2026/001', reference_number: 'INV/2026/001' };
    expect(remoteHasErpOrigin(remote, externalKey)).toBe(false);
    expect(() => assertRemoteErpOrigin(remote, externalKey, 'Invoice'))
      .toThrow(/input manual/i);
  });

  it('separates record origin from ERP update ownership', () => {
    expect(() => assertErpManaged({
      dataOrigin: 'MANUAL_ZOHO',
      managementMode: 'ERP_MANAGED',
    }, 'Contact')).not.toThrow();
    expect(() => assertErpManaged({
      dataOrigin: 'ERP',
      managementMode: 'REVIEW_REQUIRED',
    }, 'Invoice')).toThrow(/REVIEW_REQUIRED/);
  });
});
