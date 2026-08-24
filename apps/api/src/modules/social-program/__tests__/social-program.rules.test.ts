import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import {
  calculateSocialProgramTotals,
  SOCIAL_BASIC_LIST_PRICE,
  SOCIAL_BASIC_PRICE,
  SOCIAL_BOOSTER_LIST_PRICE,
} from '../social-program.service';

describe('Program Sosial pricing and rollout safety', () => {
  it('discounts only Basic to Rp500k and can make an explicitly approved Booster free', () => {
    expect(calculateSocialProgramTotals({
      basicSessions: 2,
      basicListUnitPrice: new Prisma.Decimal(SOCIAL_BASIC_LIST_PRICE),
      basicSocialUnitPrice: new Prisma.Decimal(SOCIAL_BASIC_PRICE),
      freeBoosterSessions: 1,
      boosterListUnitPrice: new Prisma.Decimal(SOCIAL_BOOSTER_LIST_PRICE),
    })).toEqual({
      basicListTotal: 4_000_000,
      payableTotal: 1_000_000,
      basicSubsidy: 3_000_000,
      boosterSubsidy: 1_000_000,
      totalSubsidy: 4_000_000,
    });
  });

  it('uses two-stage approval and exact social product code', () => {
    const root = path.resolve(__dirname, '..');
    const migration = fs.readFileSync(path.resolve(root, '..', '..', '..', 'prisma', 'migrations', '20260824120000_add_social_treatment_program', 'migration.sql'), 'utf8');
    const assignment = fs.readFileSync(path.resolve(root, '..', 'packages', 'services', 'package-assignment.service.ts'), 'utf8');
    expect(migration).toContain("'SOCIAL_PROGRAM.MANAGER_APPROVE'");
    expect(migration).toContain("'SOCIAL_PROGRAM.FINANCE_APPROVE'");
    expect(migration).toContain("'SRV-TNB-TRP-PS-001'");
    expect(assignment).toContain('SOCIAL_PROGRAM_APPROVAL_REQUIRED');
  });

  it('does not update historical commercial tables during migration', () => {
    const migration = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', '..', 'prisma', 'migrations', '20260824120000_add_social_treatment_program', 'migration.sql'), 'utf8');
    expect(migration).not.toMatch(/UPDATE\s+"(?:member_packages|invoices|invoice_payments|revenue_recognitions)"/i);
    expect(migration).toContain('WHERE NOT EXISTS');
  });
});
