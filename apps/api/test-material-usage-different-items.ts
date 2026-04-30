import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMaterialUsageDifferentItems() {
  try {
    console.log('🧪 Testing Material Usage for Different Items\n');

    // Get a session
    const session = await prisma.treatmentSession.findFirst({
      where: { isCompleted: false },
      include: { branch: true },
    });

    if (!session) {
      console.log('❌ No pending session found');
      return;
    }

    console.log(`✅ Session: ${session.sessionCode} at ${session.branch.name}\n`);

    // Test different items
    const testItems = [
      { name: 'H2S', usage: 1 },
      { name: 'HHO', usage: 100 },
      { name: 'IFA', usage: 100 },
      { name: 'O2', usage: 100 },
      { name: 'MB', usage: 10 },
    ];

    for (const test of testItems) {
      console.log('='.repeat(80));
      console.log(`Testing: ${test.name} - ${test.usage} ml\n`);

      // Find inventory item
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          branchId: session.branchId,
          masterProduct: {
            name: { contains: test.name, mode: 'insensitive' },
          },
        },
        include: { masterProduct: true },
      });

      if (!inventoryItem) {
        console.log(`❌ ${test.name} not found in inventory\n`);
        continue;
      }

      const conversionFactor = Number(inventoryItem.masterProduct.conversionFactor);
      const stockBefore = Number(inventoryItem.stock);
      const usageQuantity = test.usage;
      const baseQuantityUsed = usageQuantity / conversionFactor;
      const stockAfter = stockBefore - baseQuantityUsed;

      console.log(`Product: ${inventoryItem.masterProduct.name}`);
      console.log(`Base Unit: ${inventoryItem.masterProduct.baseUnit}`);
      console.log(`Usage Unit: ${inventoryItem.masterProduct.usageUnit}`);
      console.log(`Conversion: 1 ${inventoryItem.masterProduct.baseUnit} = ${conversionFactor} ${inventoryItem.masterProduct.usageUnit}`);
      console.log();
      console.log(`Stock before: ${stockBefore.toFixed(4)} ${inventoryItem.masterProduct.baseUnit}`);
      console.log(`Usage: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit}`);
      console.log(`Base quantity used: ${baseQuantityUsed.toFixed(4)} ${inventoryItem.masterProduct.baseUnit}`);
      console.log(`Stock after: ${stockAfter.toFixed(4)} ${inventoryItem.masterProduct.baseUnit}`);
      console.log();

      // Create material usage
      try {
        const result = await prisma.$transaction(async (tx) => {
          const materialUsage = await tx.materialUsage.create({
            data: {
              treatmentSessionId: session.id,
              inventoryItemId: inventoryItem.id,
              quantity: usageQuantity,
              unit: inventoryItem.masterProduct.usageUnit,
              recordedBy: 'test-user',
            },
          });

          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: stockAfter },
          });

          await tx.stockMutation.create({
            data: {
              inventoryItemId: inventoryItem.id,
              type: 'USED',
              quantity: baseQuantityUsed,
              stockBefore,
              stockAfter,
              referenceType: 'MaterialUsage',
              referenceId: materialUsage.id,
              notes: `Test: ${usageQuantity} ${inventoryItem.masterProduct.usageUnit}`,
              createdBy: 'test-user',
            },
          });

          return materialUsage;
        });

        // Verify
        const updated = await prisma.inventoryItem.findUnique({
          where: { id: inventoryItem.id },
        });

        const actualStock = Number(updated?.stock);
        const isCorrect = Math.abs(actualStock - stockAfter) < 0.0001;

        console.log(`✅ Material usage created: ${result.id}`);
        console.log(`Actual stock: ${actualStock.toFixed(4)} ${inventoryItem.masterProduct.baseUnit}`);
        console.log(`Expected: ${stockAfter.toFixed(4)}`);
        console.log(`Match: ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);
        console.log();

      } catch (error: any) {
        console.log(`❌ Error: ${error.message}\n`);
      }
    }

    console.log('='.repeat(80));
    console.log('\n📊 Summary of Stock Changes:\n');

    // Show final stock for all test items
    for (const test of testItems) {
      const item = await prisma.inventoryItem.findFirst({
        where: {
          branchId: session.branchId,
          masterProduct: {
            name: { contains: test.name, mode: 'insensitive' },
          },
        },
        include: { masterProduct: true },
      });

      if (item) {
        console.log(`${item.masterProduct.name}: ${Number(item.stock).toFixed(4)} ${item.masterProduct.baseUnit}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMaterialUsageDifferentItems();
