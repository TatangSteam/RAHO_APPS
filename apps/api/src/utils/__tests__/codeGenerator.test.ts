import { syncSessionCodeOrdinal } from '../codeGenerator';

describe('syncSessionCodeOrdinal', () => {
  it('replaces only the ordinal segment of a session code', () => {
    expect(syncSessionCodeOrdinal('SES-PUS-27-2609-E2RR0', 16)).toBe(
      'SES-PUS-16-2609-E2RR0',
    );
  });

  it('pads a single-digit ordinal', () => {
    expect(syncSessionCodeOrdinal('SES-HQ-16-2609-ABCDE', 3)).toBe(
      'SES-HQ-03-2609-ABCDE',
    );
  });

  it('keeps a legacy code unchanged', () => {
    expect(syncSessionCodeOrdinal('LEGACY-SESSION-001', 9)).toBe('LEGACY-SESSION-001');
  });
});
