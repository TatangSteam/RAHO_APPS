import { completeSessionSchema, saveSessionProgressSchema } from '../sessions.schema';

describe('session workflow contracts', () => {
  it('accepts an optimistic revision for completion', () => {
    expect(completeSessionSchema.parse({
      inventorySource: 'BRANCH',
      expectedWorkflowRevision: 7,
    })).toEqual({ inventorySource: 'BRANCH', expectedWorkflowRevision: 7 });
  });

  it('validates an autosaved server draft with burden metrics', () => {
    const result = saveSessionProgressSchema.parse({
      activeStep: 4,
      expectedRevision: 2,
      drafts: { infusion: { ifa250: 1 } },
      metrics: {
        startedAt: '2026-08-25T08:00:00.000Z',
        activeSeconds: 80,
        stepSeconds: { '4': 80 },
        stepTransitions: 2,
        validationErrors: 1,
        retryCount: 0,
        deviceClass: 'TABLET',
      },
    });
    expect(result.activeStep).toBe(4);
    expect(result.metrics?.deviceClass).toBe('TABLET');
  });

  it('rejects stale/invalid revision and oversized drafts', () => {
    expect(saveSessionProgressSchema.safeParse({
      activeStep: 1,
      expectedRevision: -1,
      drafts: {},
    }).success).toBe(false);
    expect(saveSessionProgressSchema.safeParse({
      activeStep: 1,
      drafts: { diagnosis: { text: 'x'.repeat(100_001) } },
    }).success).toBe(false);
  });
});
