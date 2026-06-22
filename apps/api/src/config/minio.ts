import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

// ── S3-compatible MinIO client ───────────────────────────────
const s3Client = new S3Client({
  endpoint: `${env.MINIO_USE_SSL ? 'https' : 'http'}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
  region: 'us-east-1', // MinIO requires a region even if unused
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

let bucketInitialization: Promise<void> | null = null;

function getHttpStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) {
    return undefined;
  }

  const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return metadata?.httpStatusCode;
}

/**
 * Ensure the configured bucket exists before performing storage operations.
 * The cached promise prevents multiple simultaneous uploads from racing to
 * create the same bucket.
 */
export async function ensureBucketExists(): Promise<void> {
  if (!bucketInitialization) {
    bucketInitialization = (async () => {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
      } catch (error) {
        if (getHttpStatusCode(error) !== 404) {
          throw error;
        }

        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: env.MINIO_BUCKET }));
        } catch (createError) {
          // Another process may have created it after the HEAD request.
          if (getHttpStatusCode(createError) !== 409) {
            throw createError;
          }
        }
      }
    })().catch((error) => {
      bucketInitialization = null;
      throw error;
    });
  }

  await bucketInitialization;
}

export interface UploadResult {
  key: string;
  url: string;
  presignedUrl: string;
}

/**
 * Upload a file buffer to MinIO
 * @param buffer  - File buffer from Multer
 * @param key     - Object key (path in bucket), e.g. "uploads/members/{id}/documents/file.jpg"
 * @param mimeType - MIME type of the file
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<UploadResult> {
  await ensureBucketExists();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.MINIO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  const presignedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }),
    { expiresIn: 3600 }, // 1 hour
  );

  const permanentUrl = `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/${key}`;

  return { key, url: permanentUrl, presignedUrl };
}

/**
 * Generate a presigned URL for an existing object
 * @param key - Object key in the bucket
 * @param expiresIn - Expiry in seconds (default: 1 hour)
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }),
    { expiresIn },
  );
}

/**
 * Delete a file from MinIO
 * @param key - Object key in the bucket
 */
export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }),
  );
}

/**
 * Safely delete a file from MinIO (won't throw if file doesn't exist)
 * Use this when deleting files that may or may not exist
 * @param key - Object key in the bucket
 * @returns true if deleted successfully, false if error occurred
 */
export async function safeDeleteFile(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key }),
    );
    console.log(`[MinIO] Successfully deleted file: ${key}`);
    return true;
  } catch (error) {
    console.error(`[MinIO] Failed to delete file: ${key}`, error);
    return false;
  }
}

/**
 * Delete a file from MinIO using its full URL
 * Extracts the key from the URL and deletes the file
 * @param url - Full URL of the file
 * @returns true if deleted successfully, false if error occurred
 */
export async function deleteFileByUrl(url: string): Promise<boolean> {
  if (!url) {
    return false;
  }
  
  const key = extractKeyFromUrl(url);
  if (!key) {
    console.warn(`[MinIO] Could not extract key from URL: ${url}`);
    return false;
  }
  
  return safeDeleteFile(key);
}

/**
 * Extract the MinIO key from a full URL
 */
export function extractKeyFromUrl(url: string): string {
  let value = url.trim();

  if (!value) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      value = `${parsed.pathname}${parsed.search}`;
    } catch {
      // Fall through to string-based normalization.
    }
  }

  value = value.replace(/^\/+/, '/');

  const apiFilesPrefix = '/api/v1/files/';
  const filesPrefix = '/files/';
  const minioPrefix = `/${env.MINIO_BUCKET}/`;
  const publicBasePrefix = `/`;

  if (value.startsWith(apiFilesPrefix)) {
    return value.slice(apiFilesPrefix.length);
  }

  if (value.startsWith(filesPrefix)) {
    return value.slice(filesPrefix.length);
  }

  if (value.startsWith(minioPrefix)) {
    return value.slice(minioPrefix.length);
  }

  const publicBaseUrl = `${env.MINIO_PUBLIC_URL}/${env.MINIO_BUCKET}/`;
  if (value.startsWith(publicBaseUrl)) {
    return value.slice(publicBaseUrl.length);
  }

  if (value.startsWith(publicBasePrefix)) {
    return value.slice(1);
  }

  return value;
}

export { s3Client };
