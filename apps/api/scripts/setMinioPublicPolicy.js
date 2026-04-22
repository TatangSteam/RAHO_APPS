/**
 * Simple script to set MinIO bucket policy for public read access
 * Run: node scripts/setMinioPublicPolicy.js
 */

const { S3Client, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

const ENDPOINT = 'http://localhost:9000';
const ACCESS_KEY = 'raho_minio_user';
const SECRET_KEY = 'raho_minio_secret';
const BUCKET = 'raho-uploads';

const client = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

async function setPublicPolicy() {
  console.log('\n📦 Setting MinIO bucket policy...');
  console.log(`   Endpoint: ${ENDPOINT}`);
  console.log(`   Bucket: ${BUCKET}\n`);

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/uploads/*`],
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

    console.log('✅ Bucket policy set successfully!');
    console.log('   All files in uploads/* are now publicly readable\n');
    console.log('🎉 You can now access images via:');
    console.log(`   http://localhost:9000/${BUCKET}/uploads/...\n`);
  } catch (error) {
    console.error('❌ Failed to set bucket policy:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure MinIO is running: docker ps');
    console.error('2. Check MinIO credentials in .env file');
    console.error('3. Try setting policy via MinIO Console: http://localhost:9001\n');
    process.exit(1);
  }
}

setPublicPolicy();
