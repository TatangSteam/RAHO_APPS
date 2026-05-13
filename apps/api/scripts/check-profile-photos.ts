import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProfilePhotos() {
  try {
    console.log('📸 Checking profile photos in database...\n');

    const photos = await prisma.memberDocument.findMany({
      where: {
        documentType: 'FOTO_PROFIL',
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

    console.log(`Total profile photos: ${photos.length}\n`);

    if (photos.length === 0) {
      console.log('❌ No profile photos found in database!\n');
      console.log('This is why avatarUrl is null.\n');
    } else {
      photos.forEach((photo) => {
        console.log(`📷 ${photo.member.memberNo} - ${photo.member.user.profile?.fullName || 'N/A'}`);
        console.log(`   File: ${photo.fileName}`);
        console.log(`   URL: ${photo.fileUrl}\n`);
      });
    }

    // Check all documents
    const allDocs = await prisma.memberDocument.findMany({
      select: {
        documentType: true,
      },
    });

    const docTypes = allDocs.reduce((acc, doc) => {
      acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Document types summary:');
    Object.entries(docTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProfilePhotos();
