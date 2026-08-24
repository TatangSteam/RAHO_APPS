import { api } from './api';

export const SOCIAL_PROGRAM_PRODUCT_CODE = 'SRV-TNB-TRP-PS-001';

export type SocialProgram = {
  id: string;
  requestNumber: string;
  memberId: string;
  branchId: string;
  basicSessions: number;
  basicListUnitPrice: string;
  basicSocialUnitPrice: string;
  freeBooster: boolean;
  boosterType?: string;
  freeBoosterSessions: number;
  boosterListUnitPrice: string;
  reason: string;
  status: string;
  activationError?: string;
  submittedAt: string;
  member: { memberNo: string; user: { profile?: { fullName: string } } };
  branch: { id: string; branchCode: string; name: string };
  requester: { id: string; email: string; profile?: { fullName: string } };
  approvalInstance?: {
    currentStep: number;
    rule: { name: string; steps: Array<{ stepNo: number; name: string; permissionCode: string }> };
  };
  totals: {
    basicListTotal: number;
    payableTotal: number;
    basicSubsidy: number;
    boosterSubsidy: number;
    totalSubsidy: number;
  };
};

export type CreateSocialProgramData = {
  memberId: string;
  branchId: string;
  basicSessions: number;
  freeBooster: boolean;
  boosterType?: 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3';
  freeBoosterSessions: number;
  reason: string;
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const socialProgramApi = {
  create: async (data: CreateSocialProgramData) => unwrap<SocialProgram>(await api.post('/social-programs', data)),
  detail: async (id: string) => unwrap<SocialProgram>(await api.get(`/social-programs/${id}`)),
  list: async (params?: { memberId?: string; branchId?: string; status?: string }) => unwrap<SocialProgram[]>(await api.get('/social-programs', { params })),
  decide: async (id: string, decision: 'APPROVE' | 'REJECT', note?: string) => unwrap<{ request: SocialProgram; activation?: { activated: boolean; error?: string } }>(await api.post(`/social-programs/${id}/decision`, { decision, note })),
  retryActivation: async (id: string) => unwrap<{ request: SocialProgram }>(await api.post(`/social-programs/${id}/activate`)),
};
