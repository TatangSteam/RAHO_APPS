jest.mock('@config/minio', () => ({
  downloadFile: jest.fn(),
}));

import { env } from '@config/env';
import { downloadFile } from '@config/minio';
import {
  extractSessionPhotoObjectKey,
  loadSessionPhoto,
} from '../whatsapp-photo.loader';

const mockedDownloadFile = downloadFile as jest.MockedFunction<typeof downloadFile>;

describe('WhatsApp session photo loader', () => {
  beforeEach(() => {
    mockedDownloadFile.mockReset();
  });

  it('accepts the authenticated API proxy URL used by current session uploads', () => {
    const url = `${env.API_URL}${env.API_PREFIX}/files/session-photos/report.webp`;
    expect(extractSessionPhotoObjectKey(url)).toBe('session-photos/report.webp');
  });

  it('accepts legacy direct-MinIO URLs', () => {
    const url = `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/session-photos/report.jpg`;
    expect(extractSessionPhotoObjectKey(url)).toBe('session-photos/report.jpg');
  });

  it('rejects untrusted origins, non-session files, and path traversal', () => {
    expect(extractSessionPhotoObjectKey('https://attacker.invalid/api/v1/files/session-photos/a.jpg')).toBeNull();
    expect(extractSessionPhotoObjectKey(`${env.API_URL}${env.API_PREFIX}/files/uploads/members/a.jpg`)).toBeNull();
    expect(extractSessionPhotoObjectKey(`${env.API_URL}${env.API_PREFIX}/files/session-photos/%2E%2E/a.jpg`)).toBeNull();
  });

  it('downloads the object privately without calling the authenticated HTTP proxy', async () => {
    const expected = Buffer.from('image-bytes');
    mockedDownloadFile.mockResolvedValue(expected);

    const result = await loadSessionPhoto(
      `${env.API_URL}${env.API_PREFIX}/files/session-photos/report.webp`,
    );

    expect(result).toEqual(expected);
    expect(mockedDownloadFile).toHaveBeenCalledWith('session-photos/report.webp', 12 * 1024 * 1024);
  });
});
