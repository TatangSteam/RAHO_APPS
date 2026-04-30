import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIncentiveData() {
  const result = await prisma.member.findUnique({
    where: { id: 'cmokukz4i00jpan3wpe8q2t3m' },
    select: {
      id: true,
      memberNo: true,
      referralCodeId: true,
      firstIncentiveType: true,
      firstIncentiveValue: true,
      nextIncentiveType: true,
      nextIncentiveValue: true
    }
  });
  
  console.log('Database result:', JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

checkIncentiveData();