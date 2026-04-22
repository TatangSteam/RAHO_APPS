/// <reference types="node" />
/**
 * RAHO — MinIO Bucket Initializer
 * Run once after Docker is started to create the required bucket
 * and set its access policy.
 *
 * Usage: npx tsx scripts/initMinio.ts
 */

import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const ENDPOINT = `http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? '9000'}`;
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'raho_minio_user';
const SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'raho_minio_secret';
const BUCKET = process.env.MINIO_BUCKET ?? 'raho-uploads';

const client = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

async function bucketExists(): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`\n📦 Connecting to MinIO at ${ENDPOINT}`);
  console.log(`   Bucket : ${BUCKET}\n`);

  if (await bucketExists()) {
    console.log(`✅ Bucket "${BUCKET}" already exists — skipping creation.`);
  } else {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`✅ Bucket "${BUCKET}" created.`);
  }

  // Set a policy so presigned URLs work and certain paths are public
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        // Allow public READ on all objects in the bucket (for development)
        // In production, you should restrict this to specific paths
        Sid: 'PublicReadAll',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [
          `arn:aws:s3:::${BUCKET}/*`,
        ],
      },
    ],
  };

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify(policy),
    }),
  );

  console.log(`✅ Bucket policy applied (public read for all objects).`);
  console.log('\n🎉 MinIO initialization complete!\n');
  console.log('──────────────────────────────────────────');
  console.log(`🌐 Console : http://localhost:9001`);
  console.log(`   User    : ${ACCESS_KEY}`);
  console.log(`   Pass    : ${SECRET_KEY}`);
  console.log('──────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('❌ MinIO initialization failed:', err);
  process.exit(1);
});
