import { api } from './api';

export interface MaterialUsage {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  recordedBy: string;
  recordedAt: string;
}

export interface CreateMaterialInput {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  recordedBy: string;
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
};
