import { api } from './api';

export interface TherapyPlan {
  id: string;
  planCode: string;
  keterangan?: string;
  ifa?: number;
  hho?: number;
  h2?: number;
  no?: number;
  gaso?: number;
  o2?: number;
  o3?: number;
  edta?: number;
  mb?: number;
  h2s?: number;
  kcl?: number;
  jmlNb?: number;
  isUsed: boolean;
  usedInSession?: {
    id: string;
    sessionCode: string;
    treatmentDate: string;
    infusKe: number;
    branchName: string;
    branchCode: string;
    totalSessionsCount: number; // Terapi ke-X (global)
    branchSessionsCount: number; // Terapi ke-X di cabang ini
  };
  createdAt: string;
}

export interface CreateTherapyPlanInput {
  keterangan?: string;
  ifa?: number;
  hho?: number;
  h2?: number;
  no?: number;
  gaso?: number;
  o2?: number;
  o3?: number;
  edta?: number;
  mb?: number;
  h2s?: number;
  kcl?: number;
  jmlNb?: number;
}

export const therapyPlanApi = {
  getMemberTherapyPlans: async (memberId: string): Promise<TherapyPlan[]> => {
    const response = await api.get(`/members/${memberId}/therapy-plans`);
    return response.data.data;
  },

  createMemberTherapyPlan: async (
    memberId: string,
    data: CreateTherapyPlanInput
  ): Promise<{ id: string; planCode: string; message: string }> => {
    const response = await api.post(`/members/${memberId}/therapy-plans`, data);
    return response.data.data;
  },
};
