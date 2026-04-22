import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMemberPhotos() {
  console.log('🔍 Checking member photos...\n');

  const members = await prisma.member.findMany({
    take: 5,
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  for (const member of members) {
    console.log(`\n📋 Member: ${member.memberNo} - ${member.user.profile?.fullName}`);
    
    const documents = await prisma.memberDocument.findMany({
      where: {
        memberId: member.id,
      },
    });

    console.log(`   Documents: ${documents.length}`);
    documents.forEach((doc) => {
      console.log(`   - ${doc.documentType}: ${doc.fileName}`);
      console.log(`     URL: ${doc.fileUrl}`);
    });

    const profilePhoto = await prisma.memberDocument.findFirst({
      where: {
        memberId: member.id,
        documentType: 'FOTO_PROFIL',
      },
    });

    if (profilePhoto) {
      console.log(`   ✅ Has profile photo: ${profilePhoto.fileUrl}`);
    } else {
      console.log(`   ❌ No profile photo`);
    }
  }

  await prisma.$disconnect();
}

checkMemberPhotos().catch(console.error);
