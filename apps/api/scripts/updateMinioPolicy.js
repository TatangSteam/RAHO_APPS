/**
 * Update MinIO bucket policy to allow public read for all objects
 * Run: node scripts/updateMinioPolicy.js
 */

const { S3Client, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const ENDPOINT = `http://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`;
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'raho_minio_user';
const SECRET_KEY = process.env.MINIO_SECRET_KEY || 'raho_minio_secret';
const BUCKET = process.env.MINIO_BUCKET || 'raho-uploads';

const client = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

async function updatePolicy() {
  console.log(`\n📦 Updating MinIO bucket policy...`);
  console.log(`   Endpoint: ${ENDPOINT}`);
  console.log(`   Bucket  : ${BUCKET}\n`);

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadAll',
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };

  try {
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify(policy),
      })
    );

    console.log(`✅ Bucket policy updated successfully!`);
    console.log(`   All objects in ${BUCKET} are now publicly readable.\n`);
  } catch (error) {
    console.error('❌ Failed to update bucket policy:', error.message);
    process.exit(1);
  }
}

updatePolicy();
