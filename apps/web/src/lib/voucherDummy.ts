export type DummyVoucherIdentity = {
  recipientName: string;
  nik: string;
  dateOfBirth: string;
};

/**
 * Creates an unmistakable, schema-valid test identity. The time component
 * keeps repeated dummy issuance from reusing the same 16-digit NIK.
 */
export function createDummyVoucherIdentity(
  campaignCode: string,
  now = Date.now(),
): DummyVoucherIdentity {
  const timeComponent = String(Math.max(0, Math.trunc(now))).padStart(12, '0').slice(-12);
  return {
    recipientName: `DUMMY TEST ${campaignCode}`.slice(0, 150),
    nik: `9999${timeComponent}`,
    dateOfBirth: '2000-01-01',
  };
}

export function formatDummyVoucherClipboard(input: DummyVoucherIdentity & {
  campaignCode: string;
  code: string;
}): string {
  return [
    'DATA VOUCHER DUMMY',
    `Campaign: ${input.campaignCode}`,
    `Kode: ${input.code}`,
    `Nama: ${input.recipientName}`,
    `NIK: ${input.nik}`,
    `Tanggal lahir: ${input.dateOfBirth}`,
  ].join('\n');
}
