import { api } from './api';

export type RevenuePolicy = { id: string; version: number; recognitionMethod: 'PER_SESSION'; packagePricing: { id: string; name: string; productCode?: string; totalSessions: number }; deferredRevenueAccount: { code: string; name: string }; revenueAccount: { code: string; name: string } };
export type RevenueContract = { id: string; totalConsideration: string; fundedDeferredAmount: string; recognizedAmount: string; remainingDeferredAmount: string; recognizedSessions: number; status: string; memberPackage: { packageCode: string; totalSessions: number; member: { user: { profile?: { fullName: string } } } }; valuation: { regularSessionRevenue: string; finalSessionRevenue: string } };
export type TreatmentEvent = { id: string; eventType: 'TREATMENT_COMPLETED'; aggregateId: string; occurredAt: string; status: string; payload: { sessionCode: string; packageIds: string[] }; recognitions: Array<{ id: string; amount: string; status: string }> };
export type PackagePricing = { id: string; name: string; productCode?: string; totalSessions: number; isActive: boolean };
const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

export const revenueApi = {
  policies: async () => unwrap<RevenuePolicy[]>(await api.get('/revenue/policies')),
  contracts: async () => unwrap<RevenueContract[]>(await api.get('/revenue/contracts')),
  events: async () => unwrap<TreatmentEvent[]>(await api.get('/revenue/events')),
  packagePricings: async () => (unwrap<{ pricings: PackagePricing[] }>(await api.get('/package-pricings'))).pricings,
  savePolicy: async (data: { packagePricingId: string; deferredRevenueAccountCode: string; revenueAccountCode: string }) => unwrap<RevenuePolicy>(await api.put('/revenue/policies', data)),
};
