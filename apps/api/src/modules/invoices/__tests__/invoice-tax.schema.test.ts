import { createInvoiceSchema, updateInvoiceSchema } from '../invoices.schema';

const cuid = 'cmqt7o6w40001kfgkt8c8h32a';

describe('invoice tax fail-closed', () => {
  it('menerima invoice tanpa pajak', () => {
    expect(createInvoiceSchema.safeParse({
      memberId: cuid,
      items: [{ itemType: 'PACKAGE', itemId: cuid, quantity: 1 }],
      taxPercent: 0,
    }).success).toBe(true);
  });

  it('menolak pajak nonnol pada create dan update sampai tax ledger dikonfigurasi', () => {
    const created = createInvoiceSchema.safeParse({
      memberId: cuid,
      items: [{ itemType: 'PACKAGE', itemId: cuid, quantity: 1 }],
      taxPercent: 11,
    });
    const updated = updateInvoiceSchema.safeParse({ taxPercent: 11 });
    expect(created.success).toBe(false);
    expect(updated.success).toBe(false);
    expect(created.error?.issues[0].message).toContain('akun liabilitas pajak');
  });
});
