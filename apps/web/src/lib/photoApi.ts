import { api } from './api';

export interface SessionPhoto {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

export const photoApi = {
  uploadPhoto: async (sessionId: string, file: File, uploadedBy: string): Promise<SessionPhoto> => {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('uploadedBy', uploadedBy);

    const response = await api.post(`/treatment-sessions/${sessionId}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  deletePhoto: async (sessionId: string): Promise<void> => {
    await api.delete(`/treatment-sessions/${sessionId}/photo`);
  },
};
