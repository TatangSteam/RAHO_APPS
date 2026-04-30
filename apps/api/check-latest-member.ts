import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestMember() {
  const member = await prisma.member.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        include: { profile: true }
      },
      referralCode: true
    }
  });
  
  console.log('Latest member:', JSON.stringify(member, null, 2));
  await prisma.$disconnect();
}

checkLatestMember().catch(console.error);