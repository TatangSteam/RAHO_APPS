import { PrismaClient, DocumentType } from '@prisma/client';

const prisma = new PrismaClient();

async function addSampleProfilePhotos() {
  try {
    console.log('📸 Adding sample profile photos to existing members...\n');

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
      // Check if member already has profile photo
      const existingPhoto = await prisma.memberDocument.findFirst({
        where: {
          memberId: member.id,
          documentType: DocumentType.FOTO_PROFIL,
        },
      });

      if (existingPhoto) {
        console.log(`  ⏭️  ${member.memberNo} - already has profile photo, skipping...`);
        continue;
      }

      // Create sample profile photo
      const photo = await prisma.memberDocument.create({
        data: {
          memberId: member.id,
          documentType: DocumentType.FOTO_PROFIL,
          fileUrl: `uploads/members/${member.id}/documents/profile-${Date.now()}.jpg`,
          fileName: `PHOTO-${member.memberNo}-${Date.now()}.jpg`,
          fileSize: 1024 * 50, // 50 KB
          mimeType: 'image/jpeg',
          uploadedBy: member.user.id,
        },
      });

      console.log(`  ✅ ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}`);
      console.log(`     Photo ID: ${photo.id}`);
      console.log(`     File: ${photo.fileName}`);
    }

    console.log('\n✅ Sample profile photos added successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleProfilePhotos();
