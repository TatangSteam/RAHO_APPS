import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMemberDocuments() {
  try {
    console.log('🔍 Checking member documents (complete view)...\n');

    // Get first 5 members with all their documents
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
        documents: true,
      },
      take: 5,
    });

    console.log(`Found ${members.length} members\n`);

    for (const member of members) {
      console.log(`\n👤 ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}`);
      console.log(`   Member ID: ${member.id}`);
      console.log(`   Total Documents: ${member.documents.length}`);

      if (member.documents.length > 0) {
        member.documents.forEach((doc) => {
          console.log(`\n   📄 ${doc.documentType}`);
          console.log(`      ID: ${doc.id}`);
          console.log(`      File: ${doc.fileName}`);
          console.log(`      URL: ${doc.fileUrl}`);
          console.log(`      Size: ${doc.fileSize} bytes`);
        });
      } else {
        console.log('   ❌ No documents');
      }

      // Check what avatarUrl would be
      const profilePhoto = member.documents.find((doc) => doc.documentType === 'FOTO_PROFIL');
      console.log(`\n   🖼️  avatarUrl would be: ${profilePhoto?.fileUrl || 'null'}`);
    }

    console.log('\n\n📊 Summary:');
    const allDocs = await prisma.memberDocument.findMany();
    const byType = allDocs.reduce((acc, doc) => {
      acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`   Total documents: ${allDocs.length}`);
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMemberDocuments();
