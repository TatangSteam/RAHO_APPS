import { api } from './api';

export interface TherapyPlan {
  id: string;
  planCode: string;
  keterangan?: string;
  ifa250?: number; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500?: number; // IFA 500ml - Alternatif/special case (satuan: Botol)
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
  version?: number; // Version number (1, 2, 3, ...)
  supersededById?: string; // ID of newer version
  supersededAt?: string; // When was this superseded
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
  ifa250?: number; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500?: number; // IFA 500ml - Alternatif/special case (satuan: Botol)
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
  therapyPlans: CreateTherapyPlanInput[];
}

export interface BulkCreateTherapyPlansResponse {
  success: boolean;
  message: string;
  data: {
    created: number;
    therapyPlans: Array<{
      id: string;
      planCode: string;
      keterangan: string;
      createdAt: string;
    }>;
  };
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

  // Edit therapy plan (creates new version)
  editTherapyPlan: async (
    memberId: string,
    therapyPlanId: string,
    data: Partial<CreateTherapyPlanInput>
  ): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await api.put(`/members/${memberId}/therapy-plans/${therapyPlanId}`, data);
    return response.data;
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
