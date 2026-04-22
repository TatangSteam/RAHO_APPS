import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateHHOProductName() {
  try {
    console.log('🔍 Mencari produk Infus HHO (5ml)...');
    
    // Find the master product
    const masterProduct = await prisma.masterProduct.findFirst({
      where: {
        name: {
          in: ['Infus HHO (5ml)', 'Infus Gassotraus HHO (5ml)']
        }
      }
    });

    if (!masterProduct) {
      console.log('❌ Produk HHO tidak ditemukan');
      console.log('   Mencari: "Infus HHO (5ml)" atau "Infus Gassotraus HHO (5ml)"');
      return;
    }

    console.log('✅ Produk ditemukan:', masterProduct);
    
    // Prompt for new name
    const newName = process.argv[2];
    if (!newName) {
      console.log('❌ Nama baru harus disediakan sebagai argument');
      console.log('Contoh: npx tsx scripts/updateHHOProductName.ts "Infus Gassotraus HHO (5ml)"');
      return;
    }

    // Update the master product name
    const updatedProduct = await prisma.masterProduct.update({
      where: {
        id: masterProduct.id
      },
      data: {
        name: newName
      }
    });

    console.log('✅ Nama produk berhasil diubah:');
    console.log('   Nama lama:', masterProduct.name);
    console.log('   Nama baru:', updatedProduct.name);

    // Check affected inventory items
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        masterProductId: masterProduct.id
      },
      include: {
        branch: true
      }
    });

    console.log(`📦 ${inventoryItems.length} inventory items terpengaruh:`);
    inventoryItems.forEach(item => {
      console.log(`   - Cabang: ${item.branch.name}, Stok: ${item.stock}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateHHOProductName();