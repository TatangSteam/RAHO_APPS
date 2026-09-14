import axios from 'axios';
import { api } from '@/lib/api';
import {
  getMemberDocumentUploadError,
  MEMBER_DOCUMENT_UPLOAD_TIMEOUT_MS,
  uploadMemberDocument,
} from './memberDocumentUpload';

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
  getApiErrorCode: jest.requireActual('@/lib/api').getApiErrorCode,
  getApiErrorMessage: jest.requireActual('@/lib/api').getApiErrorMessage,
}));

const apiPost = api.post as jest.MockedFunction<typeof api.post>;

function networkError(code = 'ERR_NETWORK') {
  return new axios.AxiosError('Network Error', code);
}

describe('member document upload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retries one transient network failure using the upload-specific timeout', async () => {
    jest.useFakeTimers();
    apiPost
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ data: { success: true } });
    const file = new File(['%PDF-1.4'], 'consent.pdf', { type: 'application/pdf' });

    const uploadPromise = uploadMemberDocument(
      'member-1',
      file,
      'PERSETUJUAN_SETELAH_PENJELASAN',
    );
    await jest.runAllTimersAsync();

    await expect(uploadPromise).resolves.toEqual({ success: true });
    expect(apiPost).toHaveBeenCalledTimes(2);
    expect(apiPost).toHaveBeenLastCalledWith(
      '/members/member-1/documents',
      expect.any(FormData),
      { timeout: MEMBER_DOCUMENT_UPLOAD_TIMEOUT_MS },
    );
    jest.useRealTimers();
  });

  it('shows a specific message when the browser receives no server response', () => {
    expect(getMemberDocumentUploadError(networkError())).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Koneksi ke server terputus. File belum dapat dipastikan tersimpan; silakan coba lagi.',
    });
  });

  it('shows a specific timeout message', () => {
    expect(getMemberDocumentUploadError(networkError('ECONNABORTED'))).toEqual({
      code: 'UPLOAD_TIMEOUT',
      message: 'Upload terlalu lama. Periksa koneksi internet lalu coba lagi.',
    });
  });
});
