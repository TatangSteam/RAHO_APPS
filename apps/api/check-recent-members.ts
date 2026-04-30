import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking recent members...\n');
  
  const members = await prisma.member.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        include: { profile: true }
      },
      referralCode: true
    }
  });

  console.log('Recent members:');
  members.forEach(m => {
    console.log(`- ${m.memberNo}: ${m.user.profile?.fullName} | Referral: ${m.referralCode?.code || 'None'} | ID: ${m.id}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);