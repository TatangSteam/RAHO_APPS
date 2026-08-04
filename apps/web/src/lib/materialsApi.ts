import { api } from './api';

export interface MaterialUsage {
  id: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  baseQuantity: number;
  recommendedQuantity?: number | null;
  deviationReason?: MaterialDeviationReason | null;
  deviationNotes?: string | null;
  status: 'DRAFT' | 'CONSUMED' | 'REVERSED';
  actualUnitCost?: number | null;
  totalActualCost?: number | null;
  recordedBy: string;
  createdAt: string;
}

export type MaterialDeviationReason =
  | 'CLINICAL_ADJUSTMENT'
  | 'PATIENT_CONDITION'
  | 'MATERIAL_SUBSTITUTION'
  | 'WASTE_DAMAGE'
  | 'STOCK_AVAILABILITY'
  | 'OTHER';

export interface CreateMaterialInput {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  recordedBy?: string;
  deviationReason?: MaterialDeviationReason;
  deviationNotes?: string;
}

export interface MaterialRecommendation {
  masterProductId: string;
  inventoryItemId: string | null;
  productName: string;
  sku: string | null;
  unit: string;
  recommendedQuantity: string;
  tolerancePercent: string;
  isRequired: boolean;
  treatmentBomItemId: string | null;
  sourceBomCodes: string[];
  availableBaseQuantity: string;
  availableUsageQuantity: string;
  valuedAvailableBaseQuantity: string;
  valuedAvailableUsageQuantity: string;
  availabilityReason: 'NOT_IN_BRANCH_INVENTORY' | 'INSUFFICIENT_STOCK' | 'VALUATION_REQUIRED' | null;
  isAvailable: boolean;
}

export interface MaterialRecommendationsResponse {
  sessionId: string;
  branchId: string;
  hasActiveBom: boolean;
  kits: Array<{
    id: string;
    kitCode: string;
    name: string;
    version: number;
  }>;
  boms: Array<{
    id: string;
    bomCode: string;
    version: number;
    packagePricingId: string;
    packageName: string;
    branchId: string | null;
  }>;
  items: MaterialRecommendation[];
}

export const materialsApi = {
  getMaterials: async (sessionId: string): Promise<MaterialUsage[]> => {
    const response = await api.get(`/treatment-sessions/${sessionId}/materials`);
    return response.data.data;
  },

  createMaterial: async (sessionId: string, data: CreateMaterialInput): Promise<MaterialUsage> => {
    const response = await api.post(`/treatment-sessions/${sessionId}/materials`, data);
    return response.data.data;
  },

  deleteMaterial: async (sessionId: string, usageId: string): Promise<void> => {
    await api.delete(`/treatment-sessions/${sessionId}/materials/${usageId}`);
  },

  getRecommendations: async (sessionId: string): Promise<MaterialRecommendationsResponse> => {
    const response = await api.get(`/treatment-sessions/${sessionId}/material-recommendations`);
    return response.data.data;
  },
};
