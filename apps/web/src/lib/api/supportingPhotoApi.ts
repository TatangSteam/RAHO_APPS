import { api } from '../api';

export interface SupportingPhoto {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description: string | null;
  uploadedBy: string;
  createdAt: string;
  session: {
    sessionCode: string;
    infusKe: number;
    treatmentDate: string;
  };
}

export interface UploadSupportingPhotoParams {
  sessionId: string;
  file: File;
  description?: string;
}

/**
 * Upload supporting photo for a session
 */
export async function uploadSupportingPhoto({
  sessionId,
  file,
  description,
}: UploadSupportingPhotoParams): Promise<SupportingPhoto> {
  const formData = new FormData();
  formData.append('photo', file);
  if (description) {
    formData.append('description', description);
  }

  const response = await api.post(
    `/treatment-sessions/${sessionId}/supporting-photos`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return response.data.data;
}

/**
 * Get all supporting photos for a session
 */
export async function getSupportingPhotosBySession(
  sessionId: string
): Promise<SupportingPhoto[]> {
  const response = await api.get(`/treatment-sessions/${sessionId}/supporting-photos`);
  return response.data.data;
}

/**
 * Get all supporting photos for a member (across all sessions)
 */
export async function getSupportingPhotosByMember(
  memberId: string
): Promise<SupportingPhoto[]> {
  const response = await api.get(`/members/${memberId}/supporting-photos`);
  return response.data.data;
}

/**
 * Delete supporting photo
 */
export async function deleteSupportingPhoto(photoId: string): Promise<void> {
  await api.delete(`/treatment-sessions/supporting-photos/${photoId}`);
}

/**
 * Update supporting photo description
 */
export async function updateSupportingPhotoDescription(
  photoId: string,
  description: string
): Promise<SupportingPhoto> {
  const response = await api.patch(
    `/treatment-sessions/supporting-photos/${photoId}`,
    { description }
  );
  return response.data.data;
}
