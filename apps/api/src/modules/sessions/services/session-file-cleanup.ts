import { unlink } from 'fs/promises';
import path from 'path';
import { deleteFileByUrl, extractKeyFromUrl } from '@config/minio';
import { logger } from '@lib/logger';

export type SessionFileCleanupResult = {
  requested: number;
  localDeleted: number;
  failedUrls: string[];
};

async function deleteLocalFallback(fileUrl: string): Promise<boolean> {
  const key = extractKeyFromUrl(fileUrl).split('?')[0];
  if (!key) return false;

  const workingDirectory = path.resolve(process.cwd());
  const localPath = path.resolve(workingDirectory, key);
  const relativePath = path.relative(workingDirectory, localPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    logger.warn('[SessionDeletion] Skipped unsafe local file path', { fileUrl });
    return false;
  }

  try {
    await unlink(localPath);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      logger.warn('[SessionDeletion] Failed to remove local session file', { error, fileUrl });
    }
    return false;
  }
}

export async function cleanupDeletedSessionFiles(
  fileUrls: Array<string | null | undefined>,
): Promise<SessionFileCleanupResult> {
  const uniqueUrls = Array.from(new Set(fileUrls.filter((value): value is string => Boolean(value))));
  const result: SessionFileCleanupResult = {
    requested: uniqueUrls.length,
    localDeleted: 0,
    failedUrls: [],
  };

  for (const fileUrl of uniqueUrls) {
    const minioDeleted = await deleteFileByUrl(fileUrl);
    const localDeleted = await deleteLocalFallback(fileUrl);
    if (localDeleted) result.localDeleted += 1;
    if (!minioDeleted && !localDeleted) result.failedUrls.push(fileUrl);
  }

  return result;
}
