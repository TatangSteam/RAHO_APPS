import { api } from '../api';

export const sessionApi = {
  /**
   * Get treatment sessions
   */
  getSessions: (params?: {
    branchId?: string;
    memberId?: string;
    startDate?: string;
    endDate?: string;
    isCompleted?: boolean;
  }) => {
    return api.get('/api/v1/treatment-sessions', { params });
  },

  /**
   * Get session details
   */
  getSessionDetails: (sessionId: string) => {
    return api.get(`/api/v1/treatment-sessions/${sessionId}`);
  },

  /**
   * Create treatment session
   */
  createSession: (data: any) => {
    return api.post('/api/v1/treatment-sessions', data);
  },

  /**
   * Update treatment session
   */
  updateSession: (sessionId: string, data: any) => {
    return api.patch(`/api/v1/treatment-sessions/${sessionId}`, data);
  },

  /**
   * Complete treatment session
   */
  completeSession: (sessionId: string) => {
    return api.post(`/api/v1/treatment-sessions/${sessionId}/complete`);
  },

  // ============================================================
  // MATERIAL USAGE
  // ============================================================

  /**
   * Get material usages for a session
   */
  getMaterialUsages: (sessionId: string) => {
    return api.get(`/api/v1/treatment-sessions/${sessionId}/materials`);
  },

  /**
   * Create material usage
   */
  createMaterialUsage: (
    sessionId: string,
    data: {
      inventoryItemId: string;
      quantity: number;
      unit: string;
      recordedBy: string;
    }
  ) => {
    return api.post(`/api/v1/treatment-sessions/${sessionId}/materials`, data);
  },

  /**
   * Delete material usage
   */
  deleteMaterialUsage: (materialId: string) => {
    return api.delete(`/api/v1/material-usages/${materialId}`);
  },

  // ============================================================
  // THERAPY PLAN
  // ============================================================

  /**
   * Get therapy plan for a session
   */
  getTherapyPlan: (sessionId: string) => {
    return api.get(`/api/v1/treatment-sessions/${sessionId}/therapy-plan`);
  },

  /**
   * Create or update therapy plan
   */
  saveTherapyPlan: (sessionId: string, data: any) => {
    return api.post(`/api/v1/treatment-sessions/${sessionId}/therapy-plan`, data);
  },

  // ============================================================
  // VITAL SIGNS
  // ============================================================

  /**
   * Get vital signs for a session
   */
  getVitalSigns: (sessionId: string) => {
    return api.get(`/api/v1/treatment-sessions/${sessionId}/vital-signs`);
  },

  /**
   * Create vital signs
   */
  createVitalSigns: (sessionId: string, data: any) => {
    return api.post(`/api/v1/treatment-sessions/${sessionId}/vital-signs`, data);
  },

  // ============================================================
  // INFUSION EXECUTION
  // ============================================================

  /**
   * Get infusion execution for a session
   */
  getInfusionExecution: (sessionId: string) => {
    return api.get(`/api/v1/treatment-sessions/${sessionId}/infusion`);
  },

  /**
   * Create or update infusion execution
   */
  saveInfusionExecution: (sessionId: string, data: any) => {
    return api.post(`/api/v1/treatment-sessions/${sessionId}/infusion`, data);
  },

  // ============================================================
  // DOCTOR EVALUATION
  // ============================================================

  /**
   * Get doctor evaluation for a session
   */
  getDoctorEvaluation: (sessionId: string) => {
    return api.get(`/api/v1/treatment-sessions/${sessionId}/evaluation`);
  },

  /**
   * Create or update doctor evaluation
   */
  saveDoctorEvaluation: (sessionId: string, data: any) => {
    return api.post(`/api/v1/treatment-sessions/${sessionId}/evaluation`, data);
  },

  // ============================================================
  // SESSION PHOTO
  // ============================================================

  /**
   * Upload session photo
   */
  uploadSessionPhoto: (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post(`/api/v1/treatment-sessions/${sessionId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * Delete session photo
   */
  deleteSessionPhoto: (sessionId: string) => {
    return api.delete(`/api/v1/treatment-sessions/${sessionId}/photo`);
  },
};
