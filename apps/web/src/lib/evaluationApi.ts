import { api } from './api';

export interface DoctorEvaluation {
  id: string;
  evaluationCode: string;
  keluhan: string | null;
  rekomendasi: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  generalNotes: string | null;
  writtenBy: string;
  writtenAt: string;
  updatedAt: string;
}

export interface CreateEvaluationInput {
  keluhan?: string | null;
  rekomendasi?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  generalNotes?: string | null;
  writtenBy: string;
}

export const evaluationApi = {
  getEvaluation: async (sessionId: string): Promise<DoctorEvaluation | null> => {
    const response = await api.get(`/treatment-sessions/${sessionId}/evaluation`);
    return response.data.data;
  },

  createEvaluation: async (sessionId: string, data: CreateEvaluationInput): Promise<DoctorEvaluation> => {
    const response = await api.post(`/treatment-sessions/${sessionId}/evaluation`, data);
    return response.data.data;
  },

  updateEvaluation: async (sessionId: string, data: Partial<CreateEvaluationInput>): Promise<DoctorEvaluation> => {
    const response = await api.patch(`/treatment-sessions/${sessionId}/evaluation`, data);
    return response.data.data;
  },
};
