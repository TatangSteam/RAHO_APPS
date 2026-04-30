import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBasicPackages() {
  const branch = await prisma.branch.findFirst({
    where: { branchCode: 'PST' }
  });

  if (!branch) {
    console.log('Branch not found');
    return;
  }

  const basicPackages = await prisma.packagePricing.findMany({
    where: {
      branchId: branch.id,
      packageType: 'BASIC'
    },
    select: {
      productCode: true,
      name: true,
      totalSessions: true,
      price: true,
    },
    orderBy: { productCode: 'asc' }
  });

  console.log('\n📦 BASIC PACKAGES - Jakarta Pusat:\n');
  console.log('PRODUCT CODE    | NAME                                      | SESSIONS | PRICE');
  console.log('----------------|-------------------------------------------|----------|---------------');
  
  basicPackages.forEach(p => {
    const price = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(Number(p.price));
    
    const code = p.productCode.padEnd(15);
    const name = p.name.padEnd(41);
    const sessions = p.totalSessions.toString().padEnd(8);
    
    console.log(`${code} | ${name} | ${sessions} | ${price}`);
  });

  console.log(`\n✅ Total BASIC packages: ${basicPackages.length}`);
  
  // Expected packages
  const expected = [
    'TNB-P1-HC',
    'TNB-P7-HC',
    'TNB-P15-HC',
    'TNB-P1-PS',
    'TNB-P1-PHC'
  ];
  
  const existing = basicPackages.map(p => p.productCode);
  const missing = expected.filter(code => !existing.includes(code));
  
  if (missing.length > 0) {
    console.log(`\n⚠️  MISSING PACKAGES: ${missing.join(', ')}`);
  } else {
    console.log('\n✅ All 5 expected packages are present!');
  }

  await prisma.$disconnect();
}

checkBasicPackages().catch(console.error);
