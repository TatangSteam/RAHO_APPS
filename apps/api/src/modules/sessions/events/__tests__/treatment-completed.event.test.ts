import {
  buildTreatmentCompletedEventPayload,
  TREATMENT_COMPLETED_EVENT_TYPE,
  TREATMENT_COMPLETED_EVENT_VERSION,
} from '../treatment-completed.event';

describe('TREATMENT_COMPLETED event contract', () => {
  it('publishes the finance posting result committed with treatment completion', () => {
    const payload = buildTreatmentCompletedEventPayload({
      occurredAt: '2026-07-22T04:00:00.000Z',
      session: {
        id: 'session-1',
        sessionCode: 'TRX-001',
        treatmentDate: '2026-07-22T03:00:00.000Z',
        completedAt: '2026-07-22T04:00:00.000Z',
        branchId: 'branch-1',
        memberId: 'member-1',
        memberPackageId: 'package-1',
        boosterPackageId: null,
      },
      inventory: {
        postingId: 'posting-1',
        postingNumber: 'ISS-001',
        totalActualMaterialCost: '200.0000',
        materials: [],
      },
      finance: {
        revenueRecognitionStatus: 'POSTED',
        recognizedRevenue: '1000000.00',
        materialCost: '200.00',
        grossProfit: '999800.00',
        journalEntryId: 'journal-1',
      },
    });

    expect(payload.eventType).toBe(TREATMENT_COMPLETED_EVENT_TYPE);
    expect(payload.eventVersion).toBe(TREATMENT_COMPLETED_EVENT_VERSION);
    expect(payload.finance).toEqual({
      revenueRecognitionStatus: 'POSTED',
      recognizedRevenue: '1000000.00',
      materialCost: '200.00',
      grossProfit: '999800.00',
      journalEntryId: 'journal-1',
    });
  });
});
