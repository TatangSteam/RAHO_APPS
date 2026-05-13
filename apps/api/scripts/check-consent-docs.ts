import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConsentDocuments() {
  try {
    console.log('🔍 Checking consent documents in database...\n');

    // Get all members
    const members = await prisma.member.findMany({
      select: {
        id: true,
        memberNo: true,
        user: {
          select: {
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
      take: 10,
    });

    console.log(`📊 Found ${members.length} members\n`);

    for (const member of members) {
      const documents = await prisma.memberDocument.findMany({
        where: {
          memberId: member.id,
        },
      });

      const consentDocs = documents.filter(
        (doc) => doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN'
      );

      console.log(`\n👤 Member: ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}`);
      console.log(`   ID: ${member.id}`);
      console.log(`   Total Documents: ${documents.length}`);
      console.log(`   Consent Documents: ${consentDocs.length}`);

      if (documents.length > 0) {
        console.log('   Documents:');
        documents.forEach((doc) => {
          console.log(`     - ${doc.documentType}: ${doc.fileName}`);
          console.log(`       URL: ${doc.fileUrl}`);
        });
      }
    }

    // Check all consent documents
    console.log('\n\n📋 All Consent Documents:');
    const allConsentDocs = await prisma.memberDocument.findMany({
      where: {
        documentType: 'PERSETUJUAN_SETELAH_PENJELASAN',
      },
      include: {
        member: {
          select: {
            memberNo: true,
            user: {
              select: {
                profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(`\nTotal consent documents: ${allConsentDocs.length}\n`);

    allConsentDocs.forEach((doc) => {
      console.log(`\n📄 Document ID: ${doc.id}`);
      console.log(`   Member: ${doc.member.memberNo} - ${doc.member.user.profile?.fullName || 'N/A'}`);
      console.log(`   Member ID: ${doc.memberId}`);
      console.log(`   File: ${doc.fileName}`);
      console.log(`   URL: ${doc.fileUrl}`);
      console.log(`   Size: ${doc.fileSize} bytes`);
      console.log(`   Uploaded: ${doc.createdAt}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConsentDocuments();
