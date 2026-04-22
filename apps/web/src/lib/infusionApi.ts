import { api } from './api';

export interface InfusionExecution {
  id: string;
  treatmentSessionId: string;
  sessionCode?: string;
  memberName?: string;
  treatmentDate?: string;
  ifa: number | null;
  hho: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  deviationNotes: string | null;
  bottleType: 'IFA' | 'EDTA' | null;
  jenisCairan: string | null;
  volumeCarrier: number | null;
  jumlahJarum: number | null;
  tanggalProduksi: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberInfusionsResponse {
  infusions: InfusionExecution[];
  total: number;
}

export const infusionApi = {
  // Get member's infusion history
  getMemberInfusions: async (memberId: string): Promise<InfusionExecution[]> => {
    const response = await api.get(`/members/${memberId}/infusions`);
    return response.data.data || [];
  },
};
