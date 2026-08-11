import { unlink } from 'fs/promises';
import { deleteFileByUrl, extractKeyFromUrl } from '@config/minio';
import { cleanupDeletedSessionFiles } from '../session-file-cleanup';

jest.mock('fs/promises', () => ({
  unlink: jest.fn(),
}));

jest.mock('@config/minio', () => ({
  deleteFileByUrl: jest.fn(),
  extractKeyFromUrl: jest.fn(),
}));

const mockedUnlink = unlink as jest.MockedFunction<typeof unlink>;
const mockedDeleteFileByUrl = deleteFileByUrl as jest.MockedFunction<typeof deleteFileByUrl>;
const mockedExtractKeyFromUrl = extractKeyFromUrl as jest.MockedFunction<typeof extractKeyFromUrl>;

describe('cleanupDeletedSessionFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDeleteFileByUrl.mockResolvedValue(true);
    mockedExtractKeyFromUrl.mockReturnValue('session-photos/photo.webp');
    mockedUnlink.mockResolvedValue(undefined);
  });

  it('deduplicates URLs and removes both MinIO and local-fallback copies', async () => {
    const fileUrl = 'http://localhost:4000/api/v1/files/session-photos/photo.webp';

    const result = await cleanupDeletedSessionFiles([fileUrl, fileUrl, null, undefined]);

    expect(mockedDeleteFileByUrl).toHaveBeenCalledTimes(1);
    expect(mockedDeleteFileByUrl).toHaveBeenCalledWith(fileUrl);
    expect(mockedUnlink).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ requested: 1, localDeleted: 1, failedUrls: [] });
  });

  it('rejects a local path that escapes the API working directory', async () => {
    const fileUrl = 'http://localhost:4000/api/v1/files/../../outside.txt';
    mockedDeleteFileByUrl.mockResolvedValue(false);
    mockedExtractKeyFromUrl.mockReturnValue('../../outside.txt');

    const result = await cleanupDeletedSessionFiles([fileUrl]);

    expect(mockedUnlink).not.toHaveBeenCalled();
    expect(result.failedUrls).toEqual([fileUrl]);
  });
});
