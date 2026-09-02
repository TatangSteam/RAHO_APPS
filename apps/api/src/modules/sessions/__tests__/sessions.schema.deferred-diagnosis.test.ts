import { SessionType } from '@prisma/client';
import { createSessionSchema } from '../sessions.schema';

const validSession = {
  memberId: 'cmember123456789012345678901',
  memberPackageId: 'cpackage1234567890123456789',
  adminLayananId: 'cadmin1234567890123456789012',
  doctorId: 'cdoctor123456789012345678901',
  treatmentDate: '2026-08-15T09:00:00.000Z',
  pelaksanaan: SessionType.HOME_CARE,
};

describe('createSessionSchema diagnosisDeferred', () => {
  it('defaults to false so existing clients keep the strict diagnosis flow', () => {
    const result = createSessionSchema.parse(validSession);

    expect(result.diagnosisDeferred).toBe(false);
  });

  it('accepts an explicit deferred-diagnosis choice', () => {
    const result = createSessionSchema.parse({
      ...validSession,
      diagnosisDeferred: true,
    });

    expect(result.diagnosisDeferred).toBe(true);
  });

  it('keeps inventory enabled unless a legacy-session choice is explicit', () => {
    expect(createSessionSchema.parse(validSession).skipInventoryConsumption).toBe(false);
    expect(createSessionSchema.parse({
      ...validSession,
      skipInventoryConsumption: true,
    }).skipInventoryConsumption).toBe(true);
  });
});
