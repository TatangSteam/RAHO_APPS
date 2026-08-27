import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiRoot = resolve(__dirname, '../../../..');

describe('employee member contract', () => {
  it('adds employee fields without rewriting existing member data', () => {
    const migration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260827090000_add_employee_members/migration.sql',
    ), 'utf8');

    expect(migration).toContain('"isEmployee" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"employeeTreatmentType" "PackageType"');
    expect(migration).not.toMatch(/UPDATE\s+"members"/i);
  });

  it('limits enrollment to supported staff and creates a free Basic member', () => {
    const service = readFileSync(resolve(
      apiRoot,
      'src/modules/members/services/employee-member.service.ts',
    ), 'utf8');

    for (const role of ['NURSE', 'DOCTOR', 'ADMIN_LAYANAN', 'ADMIN_MANAGER', 'SUPER_ADMIN']) {
      expect(service).toContain(`Role.${role}`);
    }
    expect(service).toContain('isEmployee: true');
    expect(service).toContain('employeeTreatmentType: PackageType.BASIC');
    expect(service).toContain("paymentMode: 'FREE'");
  });

  it('makes employees searchable across branches and blocks paid packages', () => {
    const retrieval = readFileSync(resolve(
      apiRoot,
      'src/modules/members/services/member-retrieval.service.ts',
    ), 'utf8');
    const creation = readFileSync(resolve(
      apiRoot,
      'src/modules/sessions/services/session-creation.service.ts',
    ), 'utf8');

    expect(retrieval).toContain('{ isEmployee: true }');
    expect(creation).toContain('member.isEmployee ||');
    expect(creation).toContain('EMPLOYEE_SESSION_MUST_BE_FREE');
  });
});
