import { createDummyVoucherIdentity, formatDummyVoucherClipboard } from './voucherDummy';

describe('voucher dummy helper', () => {
  it('creates a recognizable identity accepted by the voucher schema', () => {
    const result = createDummyVoucherIdentity('GIFT-10B', 1_725_430_123_456);

    expect(result).toEqual({
      recipientName: 'DUMMY TEST GIFT-10B',
      nik: '9999725430123456',
      dateOfBirth: '2000-01-01',
    });
    expect(result.nik).toMatch(/^\d{16}$/);
  });

  it('formats all data needed to test a claim', () => {
    const identity = createDummyVoucherIdentity('SOCIAL-15B', 1_725_430_123_456);
    const text = formatDummyVoucherClipboard({
      ...identity,
      campaignCode: 'SOCIAL-15B',
      code: 'RAHO-DUMMY-ABCD1234',
    });

    expect(text).toContain('DATA VOUCHER DUMMY');
    expect(text).toContain('Kode: RAHO-DUMMY-ABCD1234');
    expect(text).toContain(`NIK: ${identity.nik}`);
  });
});
