import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedMasterTypes() {
  console.log('🚀 Seeding Master Booster Types...');

  // Seed Booster Types
  const boosterTypes = [
    {
      code: 'NO',
      name: 'Nitric Oxide',
      icon: '🔵',
      description: 'Nitric Oxide booster therapy',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: 'GT',
      name: 'Glutathione',
      icon: '💚',
      description: 'Glutathione booster therapy',
      sortOrder: 2,
      isActive: true,
    },
    {
      code: 'MB',
      name: 'Methylene Blue',
      icon: '🔷',
      description: 'Methylene Blue booster therapy',
      sortOrder: 3,
      isActive: true,
    },
    {
      code: 'KCL',
      name: 'Potassium Chloride',
      icon: '⚪',
      description: 'Potassium Chloride booster therapy',
      sortOrder: 4,
      isActive: true,
    },
    {
      code: 'H2S',
      name: 'Hydrogen Sulfide',
      icon: '🟡',
      description: 'Hydrogen Sulfide booster therapy',
      sortOrder: 5,
      isActive: true,
    },
    {
      code: 'HK',
      name: 'Hypochlorous Acid',
      icon: '🔴',
      description: 'Hypochlorous Acid booster therapy',
      sortOrder: 6,
      isActive: true,
    },
    {
      code: 'O3',
      name: 'Ozone',
      icon: '🌀',
      description: 'Ozone booster therapy',
      sortOrder: 7,
      isActive: true,
    },
  ];

  for (const boosterType of boosterTypes) {
    await prisma.masterBoosterType.upsert({
      where: { code: boosterType.code },
      update: boosterType,
      create: boosterType,
    });
  }

  console.log(`✅ Created/Updated ${boosterTypes.length} booster types`);

  console.log('🏥 Seeding Master Service Types...');

  // Seed Service Types
  const serviceTypes = [
    {
      code: 'PM',
      name: 'Premiere',
      description: 'Premiere service',
      price: 1000000,
      sortOrder: 1,
      isActive: true,
    },
    {
      code: 'PS',
      name: 'Partnership',
      description: 'Partnership service',
      price: 650000,
      sortOrder: 2,
      isActive: true,
    },
    {
      code: 'PTY',
      name: 'Partnership Attiya',
      description: 'Partnership Attiya service',
      price: 600000,
      sortOrder: 3,
      isActive: true,
    },
    {
      code: 'PDA',
      name: 'Partnership Dr. Abhi',
      description: 'Partnership Dr. Abhi service (per ml)',
      price: 65000,
      sortOrder: 4,
      isActive: true,
    },
    {
      code: 'PHC',
      name: 'Partnership Homecare',
      description: 'Partnership Homecare service',
      price: 750000,
      sortOrder: 5,
      isActive: true,
    },
  ];

  for (const serviceType of serviceTypes) {
    await prisma.masterServiceType.upsert({
      where: { code: serviceType.code },
      update: serviceType,
      create: serviceType,
    });
  }

  console.log(`✅ Created/Updated ${serviceTypes.length} service types`);
}

// Run if called directly
if (require.main === module) {
  seedMasterTypes()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
