import { api } from './api';

export type RainPeriod = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
export type RainContext = {
  intent: 'tasks' | 'overdue'; period?: RainPeriod; startDate?: string; endDate?: string;
  status?: string; limit: number; offset: number;
};
export type RainTask = {
  id: string; taskNo: number; title: string; status: string; priority: string; dueAt: string;
  completedAt: string | null; parentTaskId: string | null; overdue: boolean; overdueDays?: number;
};
export type RainChatResponse = {
  contractVersion: 'rain.v1'; success: true; source: 'erp'; isDemo: boolean; asOf: string;
  user: { id: string }; mode: 'openclaw'; intent: 'agent'; conversationId: string;
  reply: string; context: RainContext | null;
  data: { tasks?: RainTask[]; pagination?: { total: number; nextOffset: number | null } } | null;
};
export const rainApi = {
  chat: async (message: string, conversationId: string): Promise<RainChatResponse> => {
    const response = await api.post<RainChatResponse>('/ai/chat', { message, conversationId });
    return response.data;
  },
};
