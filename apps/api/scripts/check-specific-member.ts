import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpecificMember() {
  try {
    const searchTerm = process.argv[2] || '';
    console.log(`🔍 Checking member with search term: "${searchTerm}"...\n`);

    // Search for member by email, name, or member number
    const members = await prisma.member.findMany({
      where: searchTerm ? {
        OR: [
          {
            user: {
              email: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          },
          {
            user: {
              profile: {
                fullName: {
                  contains: searchTerm,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            memberNo: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      } : {},
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        documents: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (members.length === 0) {
      console.log('❌ No members found with that email pattern\n');
      
      // Show recent members instead
      console.log('📋 Showing 5 most recent members:\n');
      const recentMembers = await prisma.member.findMany({
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          documents: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });

      for (const member of recentMembers) {
        console.log(`\n👤 ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}`);
        console.log(`   Email: ${member.user.email}`);
        console.log(`   Member ID: ${member.id}`);
        console.log(`   Created: ${member.createdAt}`);
        console.log(`   Documents: ${member.documents.length}`);
        
        if (member.documents.length > 0) {
          member.documents.forEach((doc) => {
            console.log(`     - ${doc.documentType}: ${doc.fileName}`);
          });
        } else {
          console.log(`     ❌ No documents`);
        }
      }
    } else {
      console.log(`Found ${members.length} member(s):\n`);

      for (const member of members) {
        console.log(`\n👤 ${member.memberNo} - ${member.user.profile?.fullName || 'N/A'}`);
        console.log(`   Email: ${member.user.email}`);
        console.log(`   Member ID: ${member.id}`);
        console.log(`   Created: ${member.createdAt}`);
        console.log(`   Documents: ${member.documents.length}`);
        
        if (member.documents.length > 0) {
          member.documents.forEach((doc) => {
            console.log(`\n     📄 ${doc.documentType}`);
            console.log(`        ID: ${doc.id}`);
            console.log(`        File: ${doc.fileName}`);
            console.log(`        URL: ${doc.fileUrl}`);
            console.log(`        Size: ${doc.fileSize} bytes`);
            console.log(`        Uploaded: ${doc.createdAt}`);
          });
        } else {
          console.log(`     ❌ No documents found`);
          console.log(`     This member was created without uploading documents`);
        }
      }
    }

    console.log('\n\n📊 Summary of all documents:');
    const allDocs = await prisma.memberDocument.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    console.log(`Total recent documents: ${allDocs.length}\n`);
    allDocs.forEach((doc) => {
      console.log(`  - ${doc.documentType}: ${doc.fileName} (${new Date(doc.createdAt).toLocaleString()})`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificMember();
