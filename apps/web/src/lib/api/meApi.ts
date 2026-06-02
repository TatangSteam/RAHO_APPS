import { api } from '../api';
import type { Invoice } from '@/types/invoice';

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

export interface MemberSessionDetail {
  session: {
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
  staff: {
    adminLayanan: string | null
    doctor: string | null
    nurse: string | null
  }
  diagnosis: {
    diagnosisCode: string
    diagnosa: string
    kategoriDiagnosa: string | null
  } | null
  therapyPlan: {
    planCode: string
    keterangan: string | null
    ifa250: number | null
    ifa500: number | null
    hho: number | null
    h2: number | null
    no: number | null
    gaso: number | null
    o2: number | null
    o3: number | null
    edta: number | null
    mb: number | null
    h2s: number | null
    kcl: number | null
    jmlNb: number | null
  } | null
  vitalSignsBefore: {
    sistol: number | null
    diastol: number | null
    hr: number | null
    saturasi: number | null
    pi: number | null
  } | null
  vitalSignsAfter: {
    sistol: number | null
    diastol: number | null
    hr: number | null
    saturasi: number | null
    pi: number | null
  } | null
  infusion: {
    ifa250: number | null
    ifa500: number | null
    hho: number | null
    h2: number | null
    no: number | null
    gaso: number | null
    o2: number | null
    o3: number | null
    edta: number | null
    mb: number | null
    h2s: number | null
    kcl: number | null
    jmlNb: number | null
    deviationNotes: string | null
    bottleType: string | null
    jenisCairan: string | null
    volumeCarrier: number | null
    jumlahJarum: number | null
  } | null
  materials: {
    productName: string
    quantity: number
    unit: string
  }[]
  photo: {
    photoUrl: string
    fileName: string
  } | null
  evaluation: {
    evaluationCode: string
    subjective: string | null
    objective: string | null
    assessment: string | null
    plan: string | null
    generalNotes: string | null
  } | null
}

export interface MemberPackage {
  id: string
  packageCode: string
  packageType: 'BASIC' | 'BOOSTER'
  totalSessions: number
  usedSessions: number
  sisaSessions: number
  status: 'PENDINGPAYMENT' | 'WAITING_VERIFICATION' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  activatedAt: string | null
  expiredAt: string | null
  finalPrice: number
  branchName: string
  branchCode: string
  paymentProofUrl?: string | null
  paymentProofFileName?: string | null
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
  memberName: string
  memberNo: string
  memberPhone: string
  paymentProofUrl: string | null
  paymentProofFileName: string | null
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

  getSessionDetail: async (sessionId: string): Promise<MemberSessionDetail> => {
    const res = await api.get(`/me/sessions/${sessionId}`)
    return res.data.data
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

  getInvoiceDetail: async (invoiceId: string): Promise<Invoice> => {
    const res = await api.get(`/me/invoices/${invoiceId}`)
    return res.data.data
  },

  uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  uploadPaymentProof: async (packageId: string, file: File): Promise<{ message: string }> => {
    const formData = new FormData()
    formData.append('paymentProof', file)
    const res = await api.post(`/me/packages/${packageId}/upload-payment-proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
}