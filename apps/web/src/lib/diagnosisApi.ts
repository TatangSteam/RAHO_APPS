import { api } from './api';
import type { Diagnosis, CreateDiagnosisInput } from '@/types/session';

export interface DiagnosisCategory {
  value: string;
  label: string;
  description: string;
}

export const diagnosisApi = {
  // Get all diagnoses for a member
  getMemberDiagnoses: async (memberId: string): Promise<Diagnosis[]> => {
    const { data } = await api.get<{ data: Diagnosis[] }>(`/members/${memberId}/diagnoses`);
    return data.data;
  },

  // Create diagnosis for a member
  createDiagnosis: async (memberId: string, input: CreateDiagnosisInput): Promise<Diagnosis> => {
    const { data } = await api.post<{ data: Diagnosis }>(`/members/${memberId}/diagnoses`, input);
    return data.data;
  },

  // Update diagnosis for a member
  updateDiagnosis: async (memberId: string, diagnosisId: string, input: CreateDiagnosisInput): Promise<Diagnosis> => {
    const { data } = await api.put<{ data: Diagnosis }>(`/members/${memberId}/diagnoses/${diagnosisId}`, input);
    return data.data;
  },

  // Get diagnosis categories
  getCategories: async (): Promise<DiagnosisCategory[]> => {
    const { data } = await api.get<{ data: DiagnosisCategory[] }>('/diagnosis/categories');
    return data.data;
  },
};
