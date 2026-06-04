const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('🔍 Checking database data...\n');
    
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.member.count(),
      prisma.branch.count(),
      prisma.masterProduct.count(),
      prisma.treatmentSession.count(),
      prisma.invoice.count(),
    ]);
    
    console.log('📊 Database Counts:');
    console.log('- Users:', counts[0]);
    console.log('- Members:', counts[1]);
    console.log('- Branches:', counts[2]);
    console.log('- Master Products:', counts[3]);
    console.log('- Treatment Sessions:', counts[4]);
    console.log('- Invoices:', counts[5]);
    
    if (counts.every(c => c === 0)) {
      console.log('\n⚠️  Database is EMPTY! You need to seed the database.');
      console.log('Run: npm run seed:essential');
    } else {
      console.log('\n✅ Database has data!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
