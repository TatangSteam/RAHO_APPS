export const TREATMENT_COMPLETED_EVENT_TYPE = 'TREATMENT_COMPLETED' as const;
export const TREATMENT_COMPLETED_EVENT_VERSION = 2 as const;

export interface TreatmentCompletedMaterialPayload {
  materialUsageId: string;
  inventoryItemId: string;
  masterProductId: string;
  productName: string;
  actualUsageQuantity: string;
  usageUnit: string;
  consumedBaseQuantity: string;
  baseUnit: string;
  recommendedQuantity: string | null;
  deviationReason: string | null;
  deviationNotes: string | null;
  actualUnitCost: string | null;
  totalActualCost: string | null;
}

export interface TreatmentCompletedEventPayload {
  eventType: typeof TREATMENT_COMPLETED_EVENT_TYPE;
  eventVersion: typeof TREATMENT_COMPLETED_EVENT_VERSION;
  occurredAt: string;
  session: {
    id: string;
    sessionCode: string;
    treatmentDate: string;
    completedAt: string;
    branchId: string;
    memberId: string;
    memberPackageId: string;
    boosterPackageId: string | null;
  };
  inventory: {
    postingId: string | null;
    postingNumber: string | null;
    totalActualMaterialCost: string;
    materials: TreatmentCompletedMaterialPayload[];
  };
  finance: {
    revenueRecognitionStatus: 'POSTED';
    recognizedRevenue: string;
    hppAmount: string;
    grossProfit: string;
    journalEntryId: string;
  };
}

export function buildTreatmentCompletedEventPayload(
  input: Omit<TreatmentCompletedEventPayload, 'eventType' | 'eventVersion'>,
): TreatmentCompletedEventPayload {
  return {
    eventType: TREATMENT_COMPLETED_EVENT_TYPE,
    eventVersion: TREATMENT_COMPLETED_EVENT_VERSION,
    ...input,
  };
}
