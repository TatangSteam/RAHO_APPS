process.env.RUN_INVENTORY_DB_TESTS = 'true';

const { run } = require('jest');

run([
  'src/modules/inventory/services/__tests__/inventory-ledger.concurrency.test.ts',
  'src/modules/inventory/services/__tests__/stock-reservation.integration.test.ts',
  'src/modules/inventory/services/__tests__/shipment-ledger.integration.test.ts',
  'src/modules/inventory/services/__tests__/internal-transfer.concurrency.integration.test.ts',
  'src/modules/inventory/services/__tests__/goods-receipt.integration.test.ts',
  '--runInBand',
  '--detectOpenHandles',
]);
