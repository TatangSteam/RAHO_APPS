import { api } from './api';
import type { TherapyPlanSubstance } from './therapyPlanSubstances';

export interface TherapyPlan {
  id: string;
  planCode: string;
  planNumber?: number | null;
  therapyPlanSetId?: string | null;
  setCode?: string | null;
  setName?: string | null;
  setVersion?: number | null;
  setStatus?: 'ACTIVE' | 'SUPERSEDED' | string | null;
  setSupersededById?: string | null;
  keterangan?: string;
  ifa250?: number; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500?: number; // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho?: number;
  hhoKonsentrat?: number;
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
  ifaSubstances?: TherapyPlanSubstance[] | null;
  ifaSubstanceTotalMl?: number | null;
  version?: number; // Version number (1, 2, 3, ...)
  supersededById?: string | null; // ID of newer version
  supersededAt?: string | null; // When was this superseded
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
  ifa250?: number | null; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500?: number | null; // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho?: number | null;
  hhoKonsentrat?: number | null;
  h2?: number | null;
  no?: number | null;
  gaso?: number | null;
  o2?: number | null;
  o3?: number | null;
  edta?: number | null;
  mb?: number | null;
  h2s?: number | null;
  kcl?: number | null;
  jmlNb?: number | null;
  ifaSubstances?: TherapyPlanSubstance[];
  ifaSubstanceTotalMl?: number;
}

export interface PackageSummary {
  member: {
    id: string;
    memberNo: string;
    fullName: string;
  };
  package: {
    id: string;
    packageName: string;
    vouchersTotal: number;
    vouchersUsed: number;
    vouchersRemaining: number;
    status: string;
  } | null; // Package is optional - member may not have active package
  therapyPlans: {
    existing: number;
    canCreate: number;
    maxRecommended: number;
  };
}

export interface BulkCreateTherapyPlansInput {
  name?: string | null;
  therapyPlans: CreateTherapyPlanInput[];
}

export interface BulkCreateTherapyPlansResponse {
  success: boolean;
  message: string;
  data: {
    created: number;
    setId?: string;
    setCode?: string;
    setName?: string | null;
    version?: number;
    therapyPlans: Array<{
      id: string;
      planNumber?: number | null;
      planCode: string;
      keterangan: string;
      createdAt: string;
    }>;
  };
}

export interface BulkEditTherapyPlanSetInput {
  newSetName?: string; // New set name (optional, only for authorized roles)
  sessionPlanNumber?: number;
  retainedPlanNumbers?: number[];
  plans: Array<{
    planNumber: number;
    keterangan?: string;
    ifa250?: number | null;
    ifa500?: number | null;
    hho?: number | null;
    hhoKonsentrat?: number | null;
    h2?: number | null;
    no?: number | null;
    gaso?: number | null;
    o2?: number | null;
    o3?: number | null;
    edta?: number | null;
    mb?: number | null;
    h2s?: number | null;
    kcl?: number | null;
    jmlNb?: number | null;
    ifaSubstances?: TherapyPlanSubstance[];
    ifaSubstanceTotalMl?: number;
  }>;
}

export interface BulkEditTherapyPlanSetResponse {
  success: boolean;
  message: string;
  data: {
    setId: string;
    originalSetId: string;
    version: number;
    totalPlans: number;
    editedPlans: number;
    plans: TherapyPlan[];
    sessionTherapyPlanId?: string | null;
  };
}

export const therapyPlanApi = {
  getMemberTherapyPlans: async (memberId: string): Promise<TherapyPlan[]> => {
    const response = await api.get(`/members/${memberId}/therapy-plans`);
    return response.data.data;
  },

  // Bulk creation methods
  getMemberPackageSummary: async (memberId: string): Promise<PackageSummary> => {
    const response = await api.get(`/members/${memberId}/therapy-plans/package-summary`);
    return response.data.data;
  },

  bulkCreateTherapyPlans: async (
    memberId: string,
    data: BulkCreateTherapyPlansInput
  ): Promise<BulkCreateTherapyPlansResponse> => {
    const response = await api.post(`/members/${memberId}/therapy-plans/bulk`, data);
    return response.data;
  },

  editTherapyPlan: async (
    memberId: string,
    therapyPlanId: string,
    data: Partial<CreateTherapyPlanInput>
  ): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await api.put(`/members/${memberId}/therapy-plans/${therapyPlanId}`, data);
    return response.data;
  },

  // Bulk edit therapy plan set (edit multiple plans at once)
  bulkEditTherapyPlanSet: async (
    memberId: string,
    setId: string,
    data: BulkEditTherapyPlanSetInput
  ): Promise<BulkEditTherapyPlanSetResponse> => {
    const response = await api.put(`/members/${memberId}/therapy-plan-sets/${setId}/bulk-edit`, data);
    return response.data;
  },

  deleteTherapyPlanSet: async (
    memberId: string,
    setId: string
  ): Promise<{ message: string; data: { setId: string; deletedPlans: number } }> => {
    const response = await api.delete(`/members/${memberId}/therapy-plan-sets/${setId}`);
    return response.data.data;
  },

  getSessionTherapyPlanSet: async (sessionId: string): Promise<TherapyPlan[]> => {
    const response = await api.get(`/treatment-sessions/${sessionId}/therapy-plan-set`);
    return response.data.data;
  },

  bulkEditSessionTherapyPlanSet: async (
    sessionId: string,
    data: BulkEditTherapyPlanSetInput
  ): Promise<BulkEditTherapyPlanSetResponse> => {
    const response = await api.put(`/treatment-sessions/${sessionId}/therapy-plan-set`, data);
    return response.data.data;
  },

  // Get therapy plan history (all versions)
  getTherapyPlanHistory: async (
    memberId: string,
    therapyPlanId: string
  ): Promise<{ currentVersion: TherapyPlan; versions: TherapyPlan[]; totalVersions: number }> => {
    const response = await api.get(`/members/${memberId}/therapy-plans/${therapyPlanId}/history`);
    return response.data.data;
  },
};
