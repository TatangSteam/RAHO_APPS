import { api } from './api';

export const labResultsApi = {
  getMemberLabResults: async (memberId: string) => {
    const { data } = await api.get(`/members/${memberId}/lab-results`);
    return data.data;
  },

  uploadLabResult: async (memberId: string, formData: FormData) => {
    const { data } = await api.post(`/members/${memberId}/lab-results`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data;
  },

  deleteLabResult: async (memberId: string, labResultId: string) => {
    const { data } = await api.delete(`/members/${memberId}/lab-results/${labResultId}`);
    return data.data;
  },
};
