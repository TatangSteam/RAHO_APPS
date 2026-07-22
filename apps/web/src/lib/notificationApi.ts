import { api } from '@/lib/api';

export interface SystemNotification {
  id: string;
  type: 'INVOICE' | 'REMINDER' | 'INFO';
  title: string;
  body: string;
  deepLink?: string;
  status: 'UNREAD' | 'READ';
  createdAt: string;
}

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const notificationApi = {
  list: async () => unwrap<{ data: SystemNotification[]; meta: { unread: number } }>(await api.get('/notifications')),
  read: async (id: string) => unwrap<SystemNotification>(await api.patch(`/notifications/${id}/read`)),
  readAll: async () => unwrap<{ updated: number }>(await api.patch('/notifications/read-all')),
};
