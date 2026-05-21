import { api } from '../api';

export interface MemberDashboard {
  voucherSisa: number
  paketAktif: number
  sesiTerakhir: {
    sessionCode: string
    treatmentDate: string
    infusKe: number
    pelaksanaan: string
  } | null
}

export interface MemberSession {
  id: string
  sessionCode: string
  treatmentDate: string
  infusKe: number
  pelaksanaan: string
  isCompleted: boolean
  packageType: string
  packageCode: string
  branchName: string
  branchCode: string
}

export interface MemberPackage {
  id: string
  packageCode: string
  packageType: 'BASIC' | 'BOOSTER'
  totalSessions: number
  usedSessions: number
  sisaSessions: number
  status: 'PENDINGPAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  activatedAt: string | null
  expiredAt: string | null
  finalPrice: number
  branchName: string
  branchCode: string
}

export interface MemberDiagnosis {
  id: string
  diagnosisCode: string
  diagnosisName: string
  category: string
  notes: string | null
  createdAt: string
  doctorName: string
  doctorCode: string
}

export interface MemberProfile {
  userId: string
  email: string
  fullName: string
  phone: string
  avatarUrl: string | null
  memberNo: string
  nik: string | null
  dateOfBirth: string | null
  jenisKelamin: 'L' | 'P' | null
  address: string | null
  voucherCount: number
  isActive: boolean
  registrationBranch: { name: string; branchCode: string; city: string }
  memberSince: string
}

export interface MemberInvoice {
  id: string
  invoiceNumber: string
  status: string
  totalAmount: number
  paidAt: string | null
  paymentMethod: string | null
  createdAt: string
  branchName: string
  branchCode: string
  items: { description: string; quantity: number; pricePerUnit: number; totalAmount: number }[]
}

export interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

// ── API Methods ────────────────────────────────────────────────

export const meApi = {
  getDashboard: async (): Promise<MemberDashboard> => {
    const res = await api.get('/me/dashboard')
    return res.data.data
  },

  getSessions: async (
    page = 1,
    limit = 10,
  ): Promise<{ data: MemberSession[]; meta: PaginatedMeta }> => {
    const res = await api.get('/me/sessions', { params: { page, limit } })
    return { data: res.data.data, meta: res.data.meta }
  },

  getDiagnoses: async (): Promise<MemberDiagnosis[]> => {
    const res = await api.get('/me/diagnoses')
    return res.data.data
  },

  getVouchers: async (): Promise<MemberPackage[]> => {
    const res = await api.get('/me/vouchers')
    return res.data.data
  },

  getProfile: async (): Promise<MemberProfile> => {
    const res = await api.get('/me/profile')
    return res.data.data
  },

  getInvoices: async (
    page = 1,
    limit = 10,
  ): Promise<{ data: MemberInvoice[]; meta: PaginatedMeta }> => {
    const res = await api.get('/me/invoices', { params: { page, limit } })
    return { data: res.data.data, meta: res.data.meta }
  },

  uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
}