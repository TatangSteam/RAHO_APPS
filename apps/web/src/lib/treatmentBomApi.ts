import { api } from './api';

export type TreatmentBomStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';

export interface TreatmentBomItemInput {
  masterProductId: string;
  recommendedQuantity: string;
  tolerancePercent: number;
  isRequired: boolean;
  sortOrder: number;
  notes?: string;
}

export interface TreatmentBom {
  id: string;
  bomCode: string;
  packagePricingId: string;
  branchId: string | null;
  version: number;
  status: TreatmentBomStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  notes: string | null;
  branch: { id: string; branchCode: string; name: string } | null;
  packagePricing: {
    id: string;
    productCode: string | null;
    name: string;
    packageType: 'BASIC' | 'BOOSTER';
    boosterType: string | null;
    serviceType: string | null;
    totalSessions: number;
  };
  items: Array<{
    id: string;
    masterProductId: string;
    recommendedQuantity: string;
    unitSnapshot: string;
    tolerancePercent: string;
    isRequired: boolean;
    sortOrder: number;
    notes: string | null;
    masterProduct: {
      id: string;
      sku: string | null;
      name: string;
      usageUnit: string;
    };
  }>;
}

export interface TreatmentBomListResponse {
  data: TreatmentBom[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateTreatmentBomInput {
  packagePricingId: string;
  branchId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  notes?: string;
  items: TreatmentBomItemInput[];
}

export const treatmentBomApi = {
  list: async (params?: { branchId?: string; status?: TreatmentBomStatus; search?: string }) => {
    const response = await api.get('/inventory/treatment-boms', { params });
    return response.data.data as TreatmentBomListResponse;
  },
  create: async (input: CreateTreatmentBomInput) => {
    const response = await api.post('/inventory/treatment-boms', input);
    return response.data.data as TreatmentBom;
  },
  activate: async (bomId: string) => {
    const response = await api.post(`/inventory/treatment-boms/${bomId}/activate`);
    return response.data.data as TreatmentBom;
  },
};
