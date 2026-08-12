import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('release inactive staff emails migration', () => {
  const migration = readFileSync(resolve(
    __dirname,
    '../../../../prisma/migrations/20260812113000_release_inactive_staff_emails/migration.sql',
  ), 'utf8');

  it('releases only inactive non-member emails and keeps historical rows', () => {
    expect(migration).toContain('UPDATE "users"');
    expect(migration).toContain('"isActive" = false');
    expect(migration).toContain('"role" <> \'MEMBER\'');
    expect(migration).toContain("'deleted-' || \"id\" || '@users.invalid'");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+"users"/i);
  });
});
