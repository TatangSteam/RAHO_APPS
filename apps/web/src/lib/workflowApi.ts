import { api } from './api';

export type ApprovalInstance = {
  id: string; module: string; entityType: string; entityId: string; entityNumber?: string;
  branchId: string; amount: string; category?: string; status: string; currentStep: number; submittedAt: string;
  makerUserId: string;
  maker?: { id: string; email: string; profile?: { fullName: string } };
  branch?: { id: string; branchCode: string; name: string };
  rule: { name: string; steps: Array<{ stepNo: number; name: string; permissionCode: string; requiredApprovals: number }> };
  decisions: Array<{ id: string; stepNo: number; decision: string; approverUserId: string; note?: string; decidedAt: string }>;
  auditLogs: Array<{ id: string; action: string; stepNo?: number; actorUserId: string; createdAt: string }>;
};
const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const workflowApi = {
  inbox: async (status = 'PENDING') => unwrap<{ data: ApprovalInstance[] }>(await api.get('/workflow/inbox', { params: { status } })),
};
