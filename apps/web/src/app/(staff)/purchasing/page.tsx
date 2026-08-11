'use client';

import { assertCaughtError, type CaughtError } from '@/lib/caughtError';
import { FormEvent, useEffect, useState } from 'react';
import { Plus, ShoppingCart, X } from 'lucide-react';
import { api } from '@/lib/api';
import { branchesApi, type Branch } from '@/lib/api/branchesApi';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import { purchasingApi, type PurchaseOrder, type PurchaseRequest, type Supplier, type SupplierInvoice, type SupplierPayment } from '@/lib/purchasingApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type MasterProduct = { id: string; sku: string; name: string; baseUnit?: string; unit?: string; isActive?: boolean };
type PrLine = { masterProductId: string; requestedQty: string; estimatedUnitCost: string };

export default function PurchasingPage() {
  const user = useAuthStore((state) => state.user);
  const isFinance =
    user?.roleTemplateName === 'Finance' ||
    user?.staffCode?.startsWith('FN-') === true ||
    user?.email.toLowerCase() === 'finance@raho.id';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashBankAccount[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [tab, setTab] = useState<'PR' | 'PO' | 'AP' | 'SUPPLIER'>('PR');
  const [loading, setLoading] = useState(true);
  const [showCreatePr, setShowCreatePr] = useState(false);
  const [approvalPr, setApprovalPr] = useState<PurchaseRequest | null>(null);
  const [createPoPr, setCreatePoPr] = useState<PurchaseRequest | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<SupplierInvoice | null>(null);
  const [refundingPayment, setRefundingPayment] = useState<{ invoice: SupplierInvoice; payment: SupplierPayment } | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [s, r, o, ap, cash] = await Promise.all([
        purchasingApi.suppliers(), purchasingApi.requests(), purchasingApi.orders(),
        purchasingApi.accountsPayable(), cashBankApi.listAccounts({ isActive: 'true' }),
      ]);
      setSuppliers(s); setRequests(r); setOrders(o); setInvoices(ap); setCashAccounts(cash);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(apiMessage(error, 'Gagal memuat purchasing.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    Promise.all([branchesApi.getAllBranches(), api.get('/inventory/master-products')])
      .then(([branchResponse, productResponse]) => {
        const branchPayload = branchResponse.data.data;
        const productPayload = productResponse.data?.data ?? productResponse.data;
        setBranches(branchPayload.filter((row: Branch) => row.isActive));
        setProducts((Array.isArray(productPayload) ? productPayload : productPayload?.products ?? []).filter((row: MasterProduct) => row.isActive !== false));
      })
      .catch(() => undefined);
  }, []);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try { await fn(); showToast.success(message); await reload(); }
    catch (error) {
      assertCaughtError(error); showToast.error(apiMessage(error, 'Aksi gagal.')); }
  };

  const postInvoiceForOrder = async (order: PurchaseOrder) => {
    const supplierInvoiceNumber = prompt('Nomor invoice supplier');
    if (!supplierInvoiceNumber) return;
    if (order.invoices.some((invoice) => !invoice.lines?.length)) {
      showToast.error('PO mempunyai invoice lama tanpa detail quantity. Rekonsiliasi data lama sebelum membuat partial Bill berikutnya.');
      return;
    }
    const lines: Array<{ purchaseOrderItemId: string; billedQty: string }> = [];
    let amount = 0;
    for (const item of order.items) {
      const alreadyBilled = order.invoices
        .flatMap((invoice) => invoice.lines || [])
        .filter((line) => line.purchaseOrderItemId === item.id)
        .reduce((sum, line) => sum + Number(line.billedQty), 0);
      const available = Math.max(0, Number(item.receivedQty) - alreadyBilled);
      if (available <= 0) continue;
      const value = prompt(
        `Quantity ${item.nameSnapshot} yang ditagihkan (maks ${available})`,
        String(available),
      );
      if (value === null) return;
      const billedQty = Number(value);
      if (!Number.isFinite(billedQty) || billedQty < 0 || billedQty > available) {
        showToast.error(`Quantity ${item.nameSnapshot} tidak valid.`);
        return;
      }
      if (billedQty === 0) continue;
      lines.push({ purchaseOrderItemId: item.id, billedQty: billedQty.toFixed(4) });
      amount += billedQty * Number(item.unitPrice);
    }
    if (!lines.length || amount <= 0) {
      showToast.error('Tidak ada quantity received yang dipilih untuk ditagihkan.');
      return;
    }
    await act(
      () => purchasingApi.postInvoice(
        order.id,
        supplierInvoiceNumber,
        amount.toFixed(2),
        order.supplier.paymentTermsDays,
        lines,
      ),
      'Supplier invoice diposting dan masuk antrean Zoho Bill.',
    );
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-neutral-950 dark:text-neutral-50"><ShoppingCart className="text-blue-600 dark:text-blue-400" /> Purchasing & Accounts Payable</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Alur auditabel PR → PO → Goods Receipt/GRNI → supplier invoice/AP → pembayaran kas/bank.</p>
    </header>
    <div className="flex gap-2">{(['PR','PO','AP','SUPPLIER'] as const).map((value) =>
      <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-sm ${tab === value ? 'bg-blue-600 text-white' : 'border'}`}>{value === 'SUPPLIER' ? 'Supplier' : value}</button>)}
    </div>

    {loading ? <p>Memuat…</p> : <>
      {tab === 'PR' && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-neutral-950 dark:text-neutral-50">Purchase Request</h2><p className="text-sm text-neutral-600 dark:text-neutral-300">{isFinance ? 'Finance mengelola PR secara mandiri. Finalisasi langsung menyetujui seluruh quantity.' : 'Maker membuat dan mengajukan PR; approver yang berbeda memberikan keputusan.'}</p></div>
          <button onClick={() => setShowCreatePr(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"><Plus size={16}/> Buat PR</button>
        </div>
        <Table headers={['PR','Tanggal','Keterangan','Maker','Status','Aksi']}>
          {requests.map((row) => <tr key={row.id} className="border-t">
            <Cell><b>{row.requestNumber}</b><small className="block text-neutral-500">{row.items.map((item) => `${item.requestedQty} ${item.masterProduct?.baseUnit || item.masterProduct?.unit || ''}`).join(', ')}</small></Cell>
            <Cell>{date(row.requestDate)}</Cell>
            <Cell>{row.description}<small className="block text-neutral-500">{row.items.length} item{row.rejectionReason ? ` · Ditolak: ${row.rejectionReason}` : ''}</small></Cell>
            <Cell>{row.creator?.email || '-'}</Cell>
            <Cell><Status value={row.status}/></Cell>
            <Cell><div className="flex flex-wrap gap-2">
              {['DRAFT','REJECTED'].includes(row.status) && <Small onClick={() => act(() => purchasingApi.submitRequest(row.id), isFinance ? 'PR langsung disetujui dan siap dibuatkan PO.' : 'PR diajukan untuk persetujuan.')}>{isFinance ? 'Finalisasi PR' : 'Ajukan'}</Small>}
              {row.status === 'SUBMITTED' && <><Small onClick={() => setApprovalPr(row)}>{isFinance ? 'Finalisasi' : 'Review'}</Small>{!isFinance && <Small onClick={() => { const reason = prompt('Alasan penolakan (minimal 3 karakter)'); if (reason) void act(() => purchasingApi.rejectRequest(row.id, reason), 'PR ditolak.'); }}>Tolak</Small>}</>}
              {row.status === 'APPROVED' && <Small onClick={() => setCreatePoPr(row)}>Buat PO</Small>}
            </div></Cell>
          </tr>)}
        </Table>
      </section>}
      {tab === 'PO' && <Table headers={['PO','Supplier','Status receipt','Nilai','Invoice / Aksi']}>{orders.map((row) => <tr key={row.id} className="border-t"><Cell><b>{row.poNumber}</b><small className="block">{date(row.orderDate)}</small></Cell><Cell>{row.supplier.code} — {row.supplier.name}</Cell><Cell>{row.status}<small className="block text-neutral-500">{row.goodsReceipts.length} receipt</small></Cell><Cell>Rp {money(row.totalAmount)}</Cell><Cell><div className="flex flex-wrap gap-2">{['PARTIALLY_RECEIVED','RECEIVED'].includes(row.status) && <Small onClick={() => void postInvoiceForOrder(row)}>Post invoice</Small>}{row.status === 'ISSUED' && row.goodsReceipts.length === 0 && <Small onClick={() => { const reason = prompt('Alasan pembatalan PO (minimal 3 karakter)'); if (reason) void act(() => purchasingApi.cancelOrder(row.id, reason), 'PO dibatalkan dan pembatalan masuk antrean Zoho.'); }}>Batalkan PO</Small>}</div></Cell></tr>)}</Table>}
      {tab === 'AP' && <Table headers={['Invoice','Supplier / PO','Jatuh tempo','Saldo','Pembayaran / Aksi']}>{invoices.map((row) => <tr key={row.id} className="border-t align-top"><Cell><b>{row.supplierInvoiceNumber}</b><small className="block">{row.journalEntry.journalNumber}</small></Cell><Cell>{row.supplier.name}<small className="block">{row.purchaseOrder.poNumber}</small></Cell><Cell>{date(row.dueDate)}</Cell><Cell>Rp {money(row.balanceAmount)}<small className="block">dibayar Rp {money(row.paidAmount)}</small><small className="block">{row.status}</small></Cell><Cell><div className="space-y-2">{row.status !== 'PAID' && <Small onClick={() => setPayingInvoice(row)}>Bayar</Small>}{row.payments.map((payment) => { const refunded = payment.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0); const refundable = Math.max(0, Number(payment.amount) - refunded); return <div key={payment.id} className="rounded border p-2 text-xs"><b>{payment.paymentNumber}</b><span className="ml-2">Rp {money(payment.amount)}</span>{refunded > 0 && <small className="block text-amber-700">Refund Rp {money(String(refunded))}</small>}{refundable > 0 && <button type="button" className="mt-1 text-red-600 underline" onClick={() => setRefundingPayment({ invoice: row, payment })}>Refund pembayaran</button>}</div>; })}</div></Cell></tr>)}</Table>}
      {tab === 'SUPPLIER' && <><SupplierForm onSaved={reload}/><Table headers={['Kode','Nama','Termin','Status']}>{suppliers.map((row) => <tr key={row.id} className="border-t"><Cell>{row.code}</Cell><Cell>{row.name}</Cell><Cell>{row.paymentTermsDays} hari</Cell><Cell><Status value={row.status}/></Cell></tr>)}</Table></>}
    </>}

    {showCreatePr && <CreatePrModal branches={branches} products={products} onClose={() => setShowCreatePr(false)} onSaved={async () => { setShowCreatePr(false); await reload(); }}/>}
    {approvalPr && <ApprovalModal request={approvalPr} isFinance={isFinance} onClose={() => setApprovalPr(null)} onApproved={async () => { setApprovalPr(null); await reload(); }}/>}
    {createPoPr && <CreatePoModal
      request={createPoPr}
      suppliers={suppliers}
      onClose={() => setCreatePoPr(null)}
      onSaved={async () => { setCreatePoPr(null); setTab('PO'); await reload(); }}
    />}
    {payingInvoice && <SupplierPaymentModal
      invoice={payingInvoice}
      cashAccounts={cashAccounts.filter((account) => account.branchId === payingInvoice.branchId)}
      onClose={() => setPayingInvoice(null)}
      onSaved={async () => { setPayingInvoice(null); await reload(); }}
    />}
    {refundingPayment && <SupplierRefundModal
      invoice={refundingPayment.invoice}
      payment={refundingPayment.payment}
      cashAccounts={cashAccounts.filter((account) => account.branchId === refundingPayment.invoice.branchId)}
      onClose={() => setRefundingPayment(null)}
      onSaved={async () => { setRefundingPayment(null); await reload(); }}
    />}
  </div>;
}

function SupplierPaymentModal({ invoice, cashAccounts, onClose, onSaved }: {
  invoice: SupplierInvoice;
  cashAccounts: CashBankAccount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [cashBankAccountId, setCashBankAccountId] = useState(cashAccounts[0]?.id || '');
  const [amount, setAmount] = useState(invoice.balanceAmount);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await purchasingApi.payInvoice(invoice.id, cashBankAccountId, amount, reference);
      showToast.success('Pembayaran supplier diposting.');
      await onSaved();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(apiMessage(error, 'Pembayaran supplier gagal.'));
    } finally {
      setSaving(false);
    }
  };
  return <Modal title={`Bayar ${invoice.supplierInvoiceNumber}`} subtitle={`Saldo AP Rp ${money(invoice.balanceAmount)}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Kas/bank"><select required className={inputClass} value={cashBankAccountId} onChange={(event) => setCashBankAccountId(event.target.value)}><option value="">Pilih rekening</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></Field>
      <Field label="Nominal"><input required className={inputClass} type="number" min="0.01" max={invoice.balanceAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
      <Field label="Referensi pembayaran"><input required minLength={2} maxLength={150} className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
      {cashAccounts.length === 0 && <p className="text-sm text-red-600">Belum ada rekening kas/bank aktif untuk cabang invoice.</p>}
      <div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Batal</button><button disabled={saving || cashAccounts.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Memproses…' : 'Post pembayaran'}</button></div>
    </form>
  </Modal>;
}

function SupplierRefundModal({ invoice, payment, cashAccounts, onClose, onSaved }: {
  invoice: SupplierInvoice;
  payment: SupplierPayment;
  cashAccounts: CashBankAccount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const refunded = payment.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const refundable = Math.max(0, Number(payment.amount) - refunded);
  const [cashBankAccountId, setCashBankAccountId] = useState(
    cashAccounts.some((account) => account.id === payment.cashBankAccountId)
      ? payment.cashBankAccountId
      : cashAccounts[0]?.id || '',
  );
  const [amount, setAmount] = useState(refundable.toFixed(2));
  const [reason, setReason] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await purchasingApi.refundSupplierPayment(payment.id, { cashBankAccountId, amount, reason, referenceNumber });
      showToast.success('Refund pembayaran supplier diposting dan saldo AP dikembalikan.');
      await onSaved();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(apiMessage(error, 'Refund pembayaran supplier gagal.'));
    } finally {
      setSaving(false);
    }
  };
  return <Modal title={`Refund ${payment.paymentNumber}`} subtitle={`${invoice.supplierInvoiceNumber} · Maksimal Rp ${money(String(refundable))}`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Kas/bank tujuan refund"><select required className={inputClass} value={cashBankAccountId} onChange={(event) => setCashBankAccountId(event.target.value)}><option value="">Pilih rekening</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></Field>
      <Field label="Nominal refund"><input required className={inputClass} type="number" min="0.01" max={refundable} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
      <Field label="Alasan"><textarea required minLength={3} maxLength={500} rows={3} className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      <Field label="Nomor referensi (opsional)"><input maxLength={150} className={inputClass} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></Field>
      <div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Batal</button><button disabled={saving || cashAccounts.length === 0 || refundable <= 0} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Memproses…' : 'Post refund'}</button></div>
    </form>
  </Modal>;
}

function CreatePrModal({ branches, products, onClose, onSaved }: { branches: Branch[]; products: MasterProduct[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [description, setDescription] = useState('');
  const [requestDate, setRequestDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState('');
  const [lines, setLines] = useState<PrLine[]>([{ masterProductId: '', requestedQty: '10', estimatedUnitCost: '' }]);
  const [saving, setSaving] = useState(false);
  const setLine = (index: number, patch: Partial<PrLine>) => setLines((old) => old.map((line, i) => i === index ? { ...line, ...patch } : line));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await purchasingApi.createRequest({
        postingKey: crypto.randomUUID(), branchId, requestDate: new Date(`${requestDate}T00:00:00`).toISOString(),
        ...(requiredDate ? { requiredDate: new Date(`${requiredDate}T00:00:00`).toISOString() } : {}),
        description,
        items: lines.map((line) => {
          const product = products.find((row) => row.id === line.masterProductId);
          return { ...line, description: product ? `${product.sku} — ${product.name}` : 'Item Purchase Request' };
        }),
      });
      showToast.success('Purchase Request dibuat sebagai DRAFT.'); await onSaved();
    } catch (error) {
      assertCaughtError(error); showToast.error(apiMessage(error, 'Gagal membuat Purchase Request.')); }
    finally { setSaving(false); }
  };
  return <Modal title="Buat Purchase Request" subtitle="Isi kebutuhan pembelian. PR akan disimpan sebagai DRAFT." onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Cabang"><select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}><option value="">Pilih cabang</option>{branches.map((row) => <option key={row.id} value={row.id}>{row.branchCode} — {row.name}</option>)}</select></Field>
        <Field label="Keterangan"><input required minLength={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Contoh: PR-01 pengadaan VIAL"/></Field>
        <Field label="Tanggal PR"><input required type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className={inputClass}/></Field>
        <Field label="Tanggal dibutuhkan"><input type="date" value={requiredDate} min={requestDate} onChange={(e) => setRequiredDate(e.target.value)} className={inputClass}/></Field>
      </div>
      <div className="space-y-3"><div className="flex items-center justify-between"><b className="text-sm">Item PR</b><button type="button" onClick={() => setLines((old) => [...old, { masterProductId: '', requestedQty: '1', estimatedUnitCost: '' }])} className="text-sm text-blue-600">+ Tambah item</button></div>
        {lines.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_120px_180px_auto]">
          <select required value={line.masterProductId} onChange={(e) => setLine(index, { masterProductId: e.target.value })} className={inputClass}><option value="">Pilih produk</option>{products.filter((p) => !lines.some((l, i) => i !== index && l.masterProductId === p.id)).map((row) => <option key={row.id} value={row.id}>{row.sku} — {row.name} ({row.baseUnit || row.unit || '-'})</option>)}</select>
          <input required type="number" min="0.0001" step="0.0001" value={line.requestedQty} onChange={(e) => setLine(index, { requestedQty: e.target.value })} className={inputClass} placeholder="Qty"/>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-neutral-500 dark:text-neutral-400">Rp</span>
            <input
              required
              type="text"
              inputMode="numeric"
              value={formatRupiahInput(line.estimatedUnitCost)}
              onChange={(e) => setLine(index, { estimatedUnitCost: onlyDigits(e.target.value) })}
              className={`${inputClass} pl-10 text-right tabular-nums`}
              placeholder="0"
              aria-label="Estimasi harga per unit"
            />
          </div>
          <button
            type="button"
            disabled={lines.length === 1}
            onClick={() => setLines((old) => old.filter((_, i) => i !== index))}
            className="rounded-lg border border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:shadow-none dark:border-red-500 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white dark:disabled:border-neutral-700 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
          >
            Hapus
          </button>
        </div>)}
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving || !branches.length || !products.length} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan DRAFT'}</button></div>
    </form>
  </Modal>;
}

function ApprovalModal({ request, isFinance, onClose, onApproved }: { request: PurchaseRequest; isFinance: boolean; onClose: () => void; onApproved: () => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(Object.fromEntries(request.items.map((item) => [item.id, item.requestedQty])));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const approve = async () => {
    setSaving(true);
    try {
      await purchasingApi.approveRequest(request.id, request.items.map((item) => ({ itemId: item.id, approvedQty: quantities[item.id] })), note || undefined);
      showToast.success('Purchase Request disetujui.'); await onApproved();
    } catch (error) {
      assertCaughtError(error); showToast.error(apiMessage(error, 'Approval gagal.')); }
    finally { setSaving(false); }
  };
  return <Modal title={`Review ${request.requestNumber}`} subtitle={`Maker: ${request.creator?.email || '-'} · Ubah quantity untuk menguji batas approval.`} onClose={onClose}>
    <div className="space-y-4">
      {request.items.map((item) => <div key={item.id} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_180px]"><div><b>{item.masterProduct?.sku || 'Item'} — {item.masterProduct?.name || item.description}</b><small className="block text-neutral-500">Diminta: {item.requestedQty} {item.masterProduct?.baseUnit || item.masterProduct?.unit || ''}</small></div><Field label="Quantity disetujui"><input type="number" min="0" step="0.0001" value={quantities[item.id]} onChange={(e) => setQuantities((old) => ({ ...old, [item.id]: e.target.value }))} className={inputClass}/></Field></div>)}
      <Field label="Catatan approver"><textarea value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} rows={3} placeholder="Opsional"/></Field>
      <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{isFinance ? 'Finance bertanggung jawab penuh. Finalisasi langsung menyetujui PR tanpa approval role lain.' : 'Maker tidak boleh menyetujui PR buatannya sendiri. Server akan menolak percobaan self-approval.'}</div>
      <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving} onClick={() => void approve()} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Memproses…' : isFinance ? 'Finalisasi PR' : 'Setujui PR'}</button></div>
    </div>
  </Modal>;
}

function CreatePoModal({ request, suppliers, onClose, onSaved }: { request: PurchaseRequest; suppliers: Supplier[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === 'ACTIVE');
  const [supplierId, setSupplierId] = useState(activeSuppliers[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const total = request.items.reduce(
    (sum, item) => sum + Number(item.requestedQty) * Number(item.estimatedUnitCost || 0),
    0,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await purchasingApi.createOrder(request.id, supplierId);
      showToast.success(`PO ${result.purchaseOrder.poNumber} berhasil dibuat.`);
      await onSaved();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(apiMessage(error, 'Gagal membuat Purchase Order.'));
    } finally {
      setSaving(false);
    }
  };
  return <Modal title="Buat Purchase Order" subtitle={`Konversi ${request.requestNumber} menjadi PO.`} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="text-sm text-blue-700 dark:text-blue-300">Nomor PO</div>
        <div className="mt-1 font-semibold text-blue-950 dark:text-blue-100">Dibuat otomatis setelah disimpan</div>
      </div>
      <Field label="Supplier aktif">
        <select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}>
          <option value="">Pilih supplier</option>
          {activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.code} — {supplier.name}</option>)}
        </select>
      </Field>
      <div className="rounded-xl border p-4 text-sm">
        <div className="mb-2 font-semibold">Ringkasan PR</div>
        {request.items.map((item) => <div key={item.id} className="flex justify-between gap-4 border-t py-2 first:border-t-0"><span>{item.masterProduct?.sku || item.description} · {item.requestedQty}</span><span className="tabular-nums">Rp {money(String(Number(item.requestedQty) * Number(item.estimatedUnitCost || 0)))}</span></div>)}
        <div className="flex justify-between border-t pt-3 font-semibold"><span>Total PO</span><span className="tabular-nums">Rp {money(String(total))}</span></div>
      </div>
      {activeSuppliers.length === 0 && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Tidak ada supplier aktif. Aktifkan atau buat supplier terlebih dahulu.</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving || !supplierId} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">{saving ? 'Membuat PO…' : 'Buat PO Otomatis'}</button></div>
    </form>
  </Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-950 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-neutral-950 dark:text-white">{title}</h2><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{subtitle}</p></div><button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"><X/></button></div>{children}</div></div>;
}
function SupplierForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ code: '', name: '', paymentTermsDays: '30' });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await purchasingApi.createSupplier({ ...form, paymentTermsDays: Number(form.paymentTermsDays) }); showToast.success('Supplier dibuat.'); setForm({ code: '', name: '', paymentTermsDays: '30' }); await onSaved(); } catch (error) {
      assertCaughtError(error); showToast.error(apiMessage(error, 'Gagal membuat supplier.')); } };
  return <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl border p-4 md:grid-cols-4"><input className={inputClass} required placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}/><input className={inputClass} required placeholder="Nama supplier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/><input className={inputClass} required type="number" min="0" placeholder="Termin hari" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}/><button className="rounded-lg bg-blue-600 px-4 py-2 text-white">Tambah supplier</button></form>;
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="text-left">{headers.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Cell({ children }: { children: React.ReactNode }) { return <td className="p-3 align-top">{children}</td>; }
function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{label}</span>{children}</label>; }
function Status({ value }: { value: string }) { const color = value === 'APPROVED' || value === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : value === 'REJECTED' || value === 'BLOCKED' ? 'bg-red-100 text-red-700' : value === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-700'; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{value}</span>; }
const inputClass = 'w-full rounded-lg border border-neutral-400 bg-white px-3 py-2 text-neutral-950 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light] dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-400 dark:[color-scheme:dark]';
const date = (value: string) => new Date(value).toLocaleDateString('id-ID');
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string) => new Intl.NumberFormat('id-ID').format(Number(value));
const onlyDigits = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
const formatRupiahInput = (value: string) => value ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value)) : '';
const apiMessage = (error: CaughtError, fallback: string) => error.response?.data?.error?.message || fallback;
