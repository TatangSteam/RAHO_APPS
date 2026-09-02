import fs from 'fs';
import path from 'path';

describe('Member hard destruction contract', () => {
  it('requires explicit finance/inventory consent and deletes their graphs', () => {
    const service = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/members/services/member-destruction.service.ts'),
      'utf8',
    );
    const schema = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/members/members.schema.ts'),
      'utf8',
    );

    expect(schema).toContain('deleteFinancialAndInventory: z.literal(true)');
    expect(service).toContain('returnAddOnStockInTransaction');
    expect(service).toContain('sessionCompletionService.cancelCompletion');
    expect(service).toContain('deleteInventoryGraph');
    expect(service).toContain('deleteJournalGraph');
    expect(service).toContain('invoicePaymentRefund.deleteMany');
    expect(service).toContain('cashBankTransaction.deleteMany');
    expect(service).toContain('Data member, keuangan, dan inventory terkait telah dihapus permanen');
  });
});
