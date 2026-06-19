import { api } from './api';
import type {
  CreateSessionInput,
  CreateSessionResponse,
  SessionDetail,
  CreateDiagnosisInput,
  Diagnosis,
  TherapyPlan,
  CreateVitalSignInput,
  VitalSign,
  UpdateBoosterTypeInput,
  CreateInfusionInput,
  InfusionExecution,
} from '@/types/session';

// ============================================================
// SESSION ENDPOINTS
// ============================================================

export const sessionApi = {
  // Create session
  createSession: async (data: CreateSessionInput): Promise<CreateSessionResponse> => {
    const response = await api.post('/treatment-sessions', data);
    return response.data.data;
  },

  // Get session detail
  getSessionById: async (sessionId: string): Promise<SessionDetail> => {
    const response = await api.get(`/treatment-sessions/${sessionId}`);
    return response.data.data;
  },

  // ============================================================
  // STEP 1: DIAGNOSIS
  // ============================================================

  createDiagnosis: async (encounterId: string, data: CreateDiagnosisInput): Promise<Diagnosis> => {
    const response = await api.post(`/treatment-sessions/encounters/${encounterId}/diagnoses`, data);
    return response.data.data;
  },

  getDiagnosisByEncounter: async (encounterId: string): Promise<Diagnosis | null> => {
    try {
      const response = await api.get(`/treatment-sessions/encounters/${encounterId}/diagnoses`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  updateDiagnosis: async (encounterId: string, data: Partial<CreateDiagnosisInput>): Promise<Diagnosis> => {
    const response = await api.patch(`/treatment-sessions/encounters/${encounterId}/diagnoses`, data);
    return response.data.data;
  },

  // ============================================================
  // STEP 2: THERAPY PLAN
  // ============================================================

  getTherapyPlan: async (sessionId: string): Promise<TherapyPlan | null> => {
    try {
      const response = await api.get(`/treatment-sessions/${sessionId}/therapy-plan`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // ============================================================
  // STEP 3 & 8: VITAL SIGNS
  // ============================================================

  upsertVitalSign: async (sessionId: string, data: CreateVitalSignInput): Promise<VitalSign> => {
    const response = await api.post(`/treatment-sessions/${sessionId}/vital-signs`, data);
    return response.data.data;
  },

  getVitalSigns: async (sessionId: string): Promise<VitalSign[]> => {
    const response = await api.get(`/treatment-sessions/${sessionId}/vital-signs`);
    return response.data.data;
  },

  // ============================================================
  // STEP 4: BOOSTER TYPE
  // ============================================================

  updateBoosterType: async (sessionId: string, data: UpdateBoosterTypeInput): Promise<any> => {
    const response = await api.patch(`/treatment-sessions/${sessionId}/booster-type`, data);
    return response.data.data;
  },

  getBoosterStockAvailability: async (sessionId: string): Promise<{
    HHO: { available: boolean; stock: number; minThreshold: number; isLowStock: boolean; unit: string };
    NO2: { available: boolean; stock: number; minThreshold: number; isLowStock: boolean; unit: string };
  }> => {
    const response = await api.get(`/treatment-sessions/${sessionId}/booster-stock-availability`);
    return response.data.data;
  },

  // ============================================================
  // STEP 5: INFUSION EXECUTION
  // ============================================================

  createInfusion: async (sessionId: string, data: CreateInfusionInput): Promise<InfusionExecution> => {
    const response = await api.post(`/treatment-sessions/${sessionId}/infusion`, data);
    return response.data.data;
  },

  getInfusion: async (sessionId: string): Promise<InfusionExecution | null> => {
    try {
      const response = await api.get(`/treatment-sessions/${sessionId}/infusion`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // ============================================================
  // SESSION LIST
  // ============================================================

  getMemberSessions: async (memberId: string): Promise<SessionDetail[]> => {
    const response = await api.get(`/treatment-sessions?memberId=${memberId}`);
    return response.data.data || [];
  },

  getAllSessions: async (params?: { 
    page?: number; 
    limit?: number;
    branchId?: string;
    memberId?: string;
    doctorId?: string;
    nurseId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: 'all' | 'completed' | 'incomplete';
    pelaksanaan?: 'all' | 'ON_SITE' | 'HOME_CARE';
  }): Promise<SessionDetail[]> => {
    const response = await api.get('/treatment-sessions', { params });
    return response.data.data || [];
  },

  // ============================================================
  // EXPORT SESSIONS
  // ============================================================

  exportSessions: async (params: {
    format: 'xlsx' | 'csv' | 'json';
    groupBy?: 'date' | 'member' | 'doctor' | 'none';
    fields: Record<string, boolean>;
    filters?: {
      branchId?: string;
      memberId?: string;
      doctorId?: string;
      nurseId?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: string;
      pelaksanaan?: string;
    };
  }): Promise<Blob> => {
    const response = await api.post('/treatment-sessions/export', {
      format: params.format,
      groupBy: params.groupBy || 'none',
      fields: params.fields,
      filters: params.filters,
    }, {
      params: { format: params.format, groupBy: params.groupBy || 'none' },
      responseType: 'blob',
    });
    return response.data;
  },

  // ============================================================
  // COMPLETE SESSION
  // ============================================================

  completeSession: async (sessionId: string): Promise<{ sessionId: string; sessionCode: string; isCompleted: boolean; message: string }> => {
    const response = await api.patch(`/treatment-sessions/${sessionId}/complete`);
    return response.data.data;
  },
};
