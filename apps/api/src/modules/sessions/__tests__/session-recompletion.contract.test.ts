import fs from 'fs';
import path from 'path';

describe('Treatment session recompletion contract', () => {
  const sourceRoot = path.resolve(__dirname, '..', '..', '..');
  const apiRoot = path.resolve(sourceRoot, '..');
  const schema = fs.readFileSync(path.join(apiRoot, 'prisma', 'schema.prisma'), 'utf8');
  const migration = fs.readFileSync(
    path.join(
      apiRoot,
      'prisma',
      'migrations',
      '20260907100000_allow_treatment_recompletion_revisions',
      'migration.sql',
    ),
    'utf8',
  );
  const completion = fs.readFileSync(
    path.join(sourceRoot, 'modules', 'sessions', 'services', 'session-completion.service.ts'),
    'utf8',
  );

  it('allows multiple immutable completion events and revenue recognitions per session', () => {
    const domainEvent = schema.slice(
      schema.indexOf('model DomainEvent'),
      schema.indexOf('model RevenueRecognition'),
    );
    const revenueRecognition = schema.slice(
      schema.indexOf('model RevenueRecognition'),
      schema.indexOf('model MemberAddOn'),
    );

    expect(domainEvent).toContain('treatmentSessionId String?');
    expect(domainEvent).not.toMatch(/treatmentSessionId\s+String\?\s+@unique/);
    expect(domainEvent).toContain('@@index([treatmentSessionId])');
    expect(revenueRecognition).not.toContain('@@unique([treatmentSessionId, memberPackageId])');
    expect(revenueRecognition).toContain('@@index([treatmentSessionId, memberPackageId])');
    expect(migration).toContain('DROP INDEX IF EXISTS "domain_events_treatmentSessionId_key"');
    expect(migration).toContain('DROP INDEX IF EXISTS "revenue_recognitions_treatmentSessionId_memberPackageId_key"');
  });

  it('replays the active revision instead of the original completion event', () => {
    expect(completion).toContain('const completionEventKey = revisionKey');
    expect(completion).toContain('where: { eventKey: completionEventKey }');
  });
});
