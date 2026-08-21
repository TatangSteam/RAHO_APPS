import { api } from './api';

export type ReimbursementStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'REVISION_REQUIRED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'PAID';

export interface ReimbursementAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  createdAt: string;
  url: string;
}

export interface Reimbursement {
  id: string;
  reimbursementNumber: string;
  postingKey: string;
  branchId: string;
  claimantUserId: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  recipientBankName?: string;
  recipientAccountNumber?: string;
  recipientAccountHolder?: string;
  status: ReimbursementStatus;
  rejectionReason?: string;
  revisionNote?: string;
  submittedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  branch: { id: string; branchCode: string; name: string };
  claimant: { id: string; email: string; staffCode?: string; profile?: { fullName: string } };
  reviewer?: { id: string; email: string; profile?: { fullName: string } };
  payer?: { id: string; email: string; profile?: { fullName: string } };
  attachments: ReimbursementAttachment[];
  approvalInstance?: {
    currentStep: number;
    status: string;
    rule: { name: string; steps: Array<{ stepNo: number; name: string; permissionCode: string }> };
    decisions: Array<{ id: string; stepNo: number; decision: string; note?: string; decidedAt: string }>;
  };
  expenseAccount?: { code: string; name: string };
  cashBankAccount?: { id: string; code: string; name: string; type: string };
  journalEntry?: { id: string; journalNumber: string };
  cashBankTransaction?: { id: string; transactionNumber: string };
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const reimbursementApi = {
  list: async (params?: { status?: ReimbursementStatus; branchId?: string }) => unwrap<Reimbursement[]>(await api.get('/reimbursements', { params })),
  detail: async (id: string) => unwrap<Reimbursement>(await api.get(`/reimbursements/${id}`)),
  create: async (data: FormData) => unwrap<{ reimbursement: Reimbursement; idempotentReplay: boolean }>(await api.post('/reimbursements', data)),
  update: async (id: string, data: FormData) => unwrap<Reimbursement>(await api.patch(`/reimbursements/${id}`, data)),
  submit: async (id: string) => unwrap<Reimbursement>(await api.post(`/reimbursements/${id}/submit`)),
  decide: async (id: string, decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION', note?: string) => unwrap<Reimbursement>(await api.post(`/reimbursements/${id}/decision`, { decision, note })),
  cancel: async (id: string) => unwrap<Reimbursement>(await api.post(`/reimbursements/${id}/cancel`)),
  pay: async (id: string, data: { expenseAccountCode: string; cashBankAccountId: string; paymentDate: string; paymentReference?: string }) => unwrap<{ reimbursement: Reimbursement; idempotentReplay: boolean }>(await api.post(`/reimbursements/${id}/pay`, data)),
  attachment: async (id: string, attachmentId: string) => unwrap<{ url: string; expiresIn: number }>(await api.get(`/reimbursements/${id}/attachments/${attachmentId}`)),
};
