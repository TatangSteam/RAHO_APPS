process.env.RUN_FINANCE_DB_TESTS = 'true';
process.env.RUN_INVENTORY_DB_TESTS = 'true';

const { run } = require('jest');

run([
  'src/modules/invoices/services/__tests__/payment-posting.integration.test.ts',
  'src/modules/purchasing/__tests__/ac003.integration.test.ts',
  'src/modules/sessions/services/__tests__/session-completion.integration.test.ts',
  'src/modules/inventory/services/__tests__/internal-transfer.concurrency.integration.test.ts',
  'src/modules/inventory/services/__tests__/inventory-ledger.concurrency.test.ts',
  'src/modules/inventory/services/__tests__/goods-receipt.integration.test.ts',
  '--runInBand',
  '--detectOpenHandles',
]);
