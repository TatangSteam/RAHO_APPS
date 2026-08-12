import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('legacy opening valuation accounting migration', () => {
  const sql = readFileSync(resolve(
    process.cwd(),
    'prisma/migrations/20260812150000_add_legacy_opening_valuation_reason/migration.sql',
  ), 'utf8');

  it('memisahkan valuasi opening stock dari gain/loss operasional', () => {
    expect(sql).toContain("'LEGACY_OPENING_VALUATION'");
    expect(sql).toContain("'3100'");
    expect(sql).not.toContain("'4300'");
    expect(sql).not.toContain("'5210'");
    expect(sql).toContain('ON CONFLICT ("code") DO UPDATE');
  });
});
