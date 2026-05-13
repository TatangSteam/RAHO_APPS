import { uploadFile } from '../src/config/minio';
import { PrismaClient, DocumentType } from '@prisma/client';

const prisma = new PrismaClient();

async function testMinIOUpload() {
  try {
    console.log('🧪 Testing MinIO upload and database save...\n');

    // Get first member
    const member = await prisma.member.findFirst({
      select: {
        id: true,
        memberNo: true,
        user: {
          select: {
            id: true,
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      console.log('❌ No members found in database');
      return;
    }

    console.log(`👤 Testing with member: ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}\n`);

    // Create dummy file buffer (1KB of random data)
    const dummyBuffer = Buffer.alloc(1024, 'test data');

    // Test 1: Upload PSP document
    console.log('📄 Test 1: Uploading PSP document...');
    try {
      const pspKey = `uploads/members/${member.id}/documents/psp-test-${Date.now()}.pdf`;
      console.log('  - Key:', pspKey);
      
      const pspResult = await uploadFile(dummyBuffer, pspKey, 'application/pdf');
      console.log('  ✅ Upload successful');
      console.log('  - URL:', pspResult.url);
      console.log('  - Presigned URL:', pspResult.presignedUrl.substring(0, 100) + '...');

      // Save to database
      const pspDoc = await prisma.memberDocument.create({
        data: {
          memberId: member.id,
          documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
          fileUrl: pspResult.url,
          fileName: `TEST-PSP-${Date.now()}.pdf`,
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: member.user.id,
        },
      });
      console.log('  ✅ Saved to database');
      console.log('  - Document ID:', pspDoc.id);
    } catch (error: any) {
      console.error('  ❌ Failed:', error.message);
      console.error('  Error details:', error);
    }

    // Test 2: Upload profile photo
    console.log('\n📸 Test 2: Uploading profile photo...');
    try {
      const photoKey = `uploads/members/${member.id}/documents/profile-test-${Date.now()}.jpg`;
      console.log('  - Key:', photoKey);
      
      const photoResult = await uploadFile(dummyBuffer, photoKey, 'image/jpeg');
      console.log('  ✅ Upload successful');
      console.log('  - URL:', photoResult.url);
      console.log('  - Presigned URL:', photoResult.presignedUrl.substring(0, 100) + '...');

      // Save to database
      const photoDoc = await prisma.memberDocument.create({
        data: {
          memberId: member.id,
          documentType: DocumentType.FOTO_PROFIL,
          fileUrl: photoResult.url,
          fileName: `TEST-PHOTO-${Date.now()}.jpg`,
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedBy: member.user.id,
        },
      });
      console.log('  ✅ Saved to database');
      console.log('  - Document ID:', photoDoc.id);
    } catch (error: any) {
      console.error('  ❌ Failed:', error.message);
      console.error('  Error details:', error);
    }

    // Verify documents in database
    console.log('\n📊 Verifying documents in database...');
    const documents = await prisma.memberDocument.findMany({
      where: {
        memberId: member.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`\nTotal documents for ${member.memberNo}: ${documents.length}`);
    documents.forEach((doc) => {
      console.log(`  - ${doc.documentType}: ${doc.fileName}`);
      console.log(`    URL: ${doc.fileUrl}`);
      console.log(`    Created: ${doc.createdAt}`);
    });

    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMinIOUpload();
