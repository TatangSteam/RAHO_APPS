import {
  bulkEditTherapyPlanSetSchema,
  editTherapyPlanSchema,
  therapyPlanDataSchema,
} from '../members.schema';

describe('therapy plan NO dose validation', () => {
  const validNoDoses = [undefined, null, 0, 2.5, 3];

  test.each(validNoDoses)('accepts optional or valid NO dose: %p', (no) => {
    expect(therapyPlanDataSchema.safeParse({ ifa250: 1, no }).success).toBe(true);
    expect(editTherapyPlanSchema.safeParse({ no }).success).toBe(true);
    expect(
      bulkEditTherapyPlanSetSchema.safeParse({
        plans: [{ planNumber: 1, no }],
      }).success
    ).toBe(true);
  });

  test.each([0.1, 1, 2.4])('rejects NO dose below 2.5 ml: %p', (no) => {
    const createResult = therapyPlanDataSchema.safeParse({ ifa250: 1, no });
    const editResult = editTherapyPlanSchema.safeParse({ no });
    const bulkEditResult = bulkEditTherapyPlanSetSchema.safeParse({
      plans: [{ planNumber: 1, no }],
    });

    expect(createResult.success).toBe(false);
    expect(editResult.success).toBe(false);
    expect(bulkEditResult.success).toBe(false);

    if (!createResult.success) {
      expect(createResult.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Dosis NO minimal 2.5 ml' }),
        ])
      );
    }
  });
});
