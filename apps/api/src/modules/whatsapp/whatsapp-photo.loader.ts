import { readFile, stat } from 'fs/promises';
import path from 'path';
import { env } from '@config/env';
import { downloadFile } from '@config/minio';

const MAX_SESSION_PHOTO_BYTES = 12 * 1024 * 1024;
const SESSION_PHOTO_PREFIX = 'session-photos/';

function trustedOrigins(): Set<string> {
  return new Set([
    new URL(env.API_URL).origin,
    new URL(env.MINIO_PUBLIC_URL).origin,
  ]);
}

function stripKnownPrefix(pathname: string): string | null {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const prefixes = [
    `${env.API_PREFIX.replace(/\/$/, '')}/files/`,
    '/files/',
    `/${env.MINIO_BUCKET}/`,
  ];
  const prefix = prefixes.find((candidate) => normalizedPath.startsWith(candidate));
  return prefix ? normalizedPath.slice(prefix.length) : null;
}

/**
 * Convert a stored session-photo URL into a private object key without making
 * an HTTP request. Both the current authenticated API proxy format and the
 * legacy direct-MinIO format are supported.
 */
export function extractSessionPhotoObjectKey(value?: string | null): string | null {
  if (!value?.trim()) return null;

  let pathname: string;
  try {
    const target = new URL(value, env.API_URL);
    if (!trustedOrigins().has(target.origin)) return null;
    pathname = target.pathname;
  } catch {
    return null;
  }

  const encodedKey = stripKnownPrefix(pathname);
  if (!encodedKey) return null;

  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return null;
  }

  const segments = key.split('/');
  if (
    !key.startsWith(SESSION_PHOTO_PREFIX)
    || key.includes('\\')
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }

  return key;
}

async function readLocalFallback(key: string): Promise<Buffer> {
  const sessionPhotoRoot = path.resolve(process.cwd(), 'session-photos');
  const localPath = path.resolve(process.cwd(), key);
  if (!localPath.startsWith(`${sessionPhotoRoot}${path.sep}`)) {
    throw new Error('Session photo path is outside the allowed local directory.');
  }

  const metadata = await stat(localPath);
  if (metadata.size > MAX_SESSION_PHOTO_BYTES) {
    throw new Error(`Stored photo exceeds the ${MAX_SESSION_PHOTO_BYTES} byte download limit.`);
  }
  return readFile(localPath);
}

export async function loadSessionPhoto(value?: string | null): Promise<Buffer | undefined> {
  const key = extractSessionPhotoObjectKey(value);
  if (!key) return undefined;

  try {
    return await downloadFile(key, MAX_SESSION_PHOTO_BYTES);
  } catch (storageError) {
    try {
      return await readLocalFallback(key);
    } catch {
      throw storageError;
    }
  }
}
