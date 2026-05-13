import { PrismaClient, DocumentType } from '@prisma/client';

const prisma = new PrismaClient();

async function addSampleConsentDocuments() {
  try {
    console.log('📄 Adding sample consent documents to existing members...\n');

    // Get first 5 members
    const members = await prisma.member.findMany({
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
      take: 5,
    });

    console.log(`Found ${members.length} members\n`);

    for (const member of members) {
      // Check if member already has consent document
      const existingDoc = await prisma.memberDocument.findFirst({
        where: {
          memberId: member.id,
          documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
        },
      });

      if (existingDoc) {
        console.log(`  ⏭️  ${member.memberNo} - already has consent document, skipping...`);
        continue;
      }

      // Create sample consent document
      const doc = await prisma.memberDocument.create({
        data: {
          memberId: member.id,
          documentType: DocumentType.PERSETUJUAN_SETELAH_PENJELASAN,
          fileUrl: `uploads/members/${member.id}/documents/psp-sample-${Date.now()}.pdf`,
          fileName: `PSP-${member.memberNo}-${Date.now()}.pdf`,
          fileSize: 1024 * 100, // 100 KB
          mimeType: 'application/pdf',
          uploadedBy: member.user.id,
        },
      });

      console.log(`  ✅ ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}`);
      console.log(`     Document ID: ${doc.id}`);
      console.log(`     File: ${doc.fileName}`);
    }

    console.log('\n✅ Sample consent documents added successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleConsentDocuments();
