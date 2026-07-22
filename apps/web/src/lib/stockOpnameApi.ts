import { api } from './api';

export type StockOpname = {
  id: string; opnameNumber: string; branchId: string; status: string; reasonCode: string;
  notes: string; countedAt: string; totalAdjustmentValue: string; journalEntry?: { journalNumber: string };
  lines: Array<{ id: string; lineNo: number; systemQty: string; physicalQty: string; differenceQty: string; actualCost?: string }>;
};
const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const stockOpnameApi = {
  list: async () => unwrap<{ data: StockOpname[] }>(await api.get('/inventory/stock-opnames')),
  submit: async (id: string) => unwrap<StockOpname>(await api.post(`/inventory/stock-opnames/${id}/submit`)),
  approve: async (id: string, note?: string) => unwrap<StockOpname>(await api.post(`/inventory/stock-opnames/${id}/approve`, { note })),
  reject: async (id: string, note: string) => unwrap<StockOpname>(await api.post(`/inventory/stock-opnames/${id}/reject`, { note })),
};
