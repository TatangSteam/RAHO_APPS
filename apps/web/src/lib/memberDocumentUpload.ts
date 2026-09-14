import axios from 'axios';
import { api, getApiErrorCode, getApiErrorMessage } from '@/lib/api';

export type MemberDocumentType =
  | 'PERSETUJUAN_SETELAH_PENJELASAN'
  | 'FOTO_PROFIL';

export const MEMBER_DOCUMENT_UPLOAD_TIMEOUT_MS = 90_000;
const MAX_UPLOAD_ATTEMPTS = 2;

function waitBeforeRetry(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 750));
}

export function isRetryableMemberDocumentUploadError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

export function getMemberDocumentUploadError(error: unknown): {
  code: string;
  message: string;
} {
  if (!axios.isAxiosError(error)) {
    return { code: 'UNKNOWN_ERROR', message: 'Upload gagal karena kesalahan yang tidak diketahui.' };
  }

  const apiCode = getApiErrorCode(error);
  if (apiCode) return { code: apiCode, message: getApiErrorMessage(error) };

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      code: 'UPLOAD_TIMEOUT',
      message: 'Upload terlalu lama. Periksa koneksi internet lalu coba lagi.',
    };
  }

  if (!error.response) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Koneksi ke server terputus. File belum dapat dipastikan tersimpan; silakan coba lagi.',
    };
  }

  return {
    code: `HTTP_${error.response.status}`,
    message: getApiErrorMessage(error),
  };
}

export async function uploadMemberDocument(
  memberId: string,
  file: File,
  documentType: MemberDocumentType,
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('documentType', documentType);

    try {
      const response = await api.post(`/members/${memberId}/documents`, formData, {
        // Mobile uploads need more headroom than ordinary JSON requests.
        // The request interceptor supplies the multipart boundary.
        timeout: MEMBER_DOCUMENT_UPLOAD_TIMEOUT_MS,
      });
      return response.data;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_UPLOAD_ATTEMPTS || !isRetryableMemberDocumentUploadError(error)) {
        throw error;
      }
      await waitBeforeRetry();
    }
  }

  throw lastError;
}
