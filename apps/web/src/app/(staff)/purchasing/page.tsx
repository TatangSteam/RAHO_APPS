'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, ShoppingCart, X } from 'lucide-react';
import { api } from '@/lib/api';
import { branchesApi, type Branch } from '@/lib/api/branchesApi';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import { purchasingApi, type PurchaseOrder, type PurchaseRequest, type Supplier, type SupplierInvoice } from '@/lib/purchasingApi';
import { showToast } from '@/lib/toast';

type MasterProduct = { id: string; sku: string; name: string; baseUnit?: string; unit?: string; isActive?: boolean };
type PrLine = { masterProductId: string; requestedQty: string; estimatedUnitCost: string };

export default function PurchasingPage() {
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

  const reload = async () => {
    setLoading(true);
    try {
      const [s, r, o, ap, cash] = await Promise.all([
        purchasingApi.suppliers(), purchasingApi.requests(), purchasingApi.orders(),
        purchasingApi.accountsPayable(), cashBankApi.listAccounts({ isActive: 'true' }),
      ]);
      setSuppliers(s); setRequests(r); setOrders(o); setInvoices(ap); setCashAccounts(cash);
    } catch (error: any) {
      showToast.error(apiMessage(error, 'Gagal memuat purchasing.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    Promise.all([branchesApi.getAllBranches(), api.get('/inventory/master-products')])
      .then(([branchResponse, productResponse]) => {
        const branchPayload = branchResponse.data?.data ?? branchResponse.data;
        const productPayload = productResponse.data?.data ?? productResponse.data;
        setBranches((Array.isArray(branchPayload) ? branchPayload : branchPayload?.branches ?? []).filter((row: Branch) => row.isActive));
        setProducts((Array.isArray(productPayload) ? productPayload : productPayload?.products ?? []).filter((row: MasterProduct) => row.isActive !== false));
      })
      .catch(() => undefined);
  }, []);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try { await fn(); showToast.success(message); await reload(); }
    catch (error: any) { showToast.error(apiMessage(error, 'Aksi gagal.')); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><ShoppingCart /> Purchasing & Accounts Payable</h1>
      <p className="mt-1 text-sm text-neutral-500">Alur auditabel PR → PO → Goods Receipt/GRNI → supplier invoice/AP → pembayaran kas/bank.</p>
    </header>
    <div className="flex gap-2">{(['PR','PO','AP','SUPPLIER'] as const).map((value) =>
      <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-sm ${tab === value ? 'bg-blue-600 text-white' : 'border'}`}>{value === 'SUPPLIER' ? 'Supplier' : value}</button>)}
    </div>

    {loading ? <p>Memuat…</p> : <>
      {tab === 'PR' && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Purchase Request</h2><p className="text-sm text-neutral-500">Maker membuat dan mengajukan PR; approver yang berbeda memberikan keputusan.</p></div>
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
              {['DRAFT','REJECTED'].includes(row.status) && <Small onClick={() => act(() => purchasingApi.submitRequest(row.id), 'PR diajukan untuk persetujuan.')}>Ajukan</Small>}
              {row.status === 'SUBMITTED' && <><Small onClick={() => setApprovalPr(row)}>Review</Small><Small onClick={() => { const reason = prompt('Alasan penolakan (minimal 3 karakter)'); if (reason) void act(() => purchasingApi.rejectRequest(row.id, reason), 'PR ditolak.'); }}>Tolak</Small></>}
              {row.status === 'APPROVED' && <Small onClick={() => { const supplierId = promptSupplier(suppliers); if (supplierId) void act(() => purchasingApi.createOrder(row.id, supplierId), 'PO diterbitkan.'); }}>Buat PO</Small>}
            </div></Cell>
          </tr>)}
        </Table>
      </section>}
      {tab === 'PO' && <Table headers={['PO','Supplier','Status receipt','Nilai','Invoice']}>{orders.map((row) => <tr key={row.id} className="border-t"><Cell><b>{row.poNumber}</b><small className="block">{date(row.orderDate)}</small></Cell><Cell>{row.supplier.code} — {row.supplier.name}</Cell><Cell>{row.status}<small className="block text-neutral-500">{row.goodsReceipts.length} receipt</small></Cell><Cell>Rp {money(row.totalAmount)}</Cell><Cell>{['PARTIALLY_RECEIVED','RECEIVED'].includes(row.status) && <Small onClick={() => { const number = prompt('Nomor invoice supplier'); const amount = prompt('Nominal invoice', row.totalAmount); if (number && amount) void act(() => purchasingApi.postInvoice(row.id, number, amount, row.supplier.paymentTermsDays), 'Supplier invoice diposting.'); }}>Post invoice</Small>}</Cell></tr>)}</Table>}
      {tab === 'AP' && <Table headers={['Invoice','Supplier / PO','Jatuh tempo','Saldo','Status / Aksi']}>{invoices.map((row) => <tr key={row.id} className="border-t"><Cell><b>{row.supplierInvoiceNumber}</b><small className="block">{row.journalEntry.journalNumber}</small></Cell><Cell>{row.supplier.name}<small className="block">{row.purchaseOrder.poNumber}</small></Cell><Cell>{date(row.dueDate)}</Cell><Cell>Rp {money(row.balanceAmount)}<small className="block">dibayar Rp {money(row.paidAmount)}</small></Cell><Cell>{row.status !== 'PAID' ? <Small onClick={() => { const accountId = promptCash(cashAccounts.filter((account) => account.branchId === row.branchId)); const amount = prompt('Nominal pembayaran', row.balanceAmount); const reference = prompt('Referensi pembayaran'); if (accountId && amount && reference) void act(() => purchasingApi.payInvoice(row.id, accountId, amount, reference), 'Pembayaran supplier diposting.'); }}>Bayar</Small> : 'PAID'}</Cell></tr>)}</Table>}
      {tab === 'SUPPLIER' && <><SupplierForm onSaved={reload}/><Table headers={['Kode','Nama','Termin','Status']}>{suppliers.map((row) => <tr key={row.id} className="border-t"><Cell>{row.code}</Cell><Cell>{row.name}</Cell><Cell>{row.paymentTermsDays} hari</Cell><Cell><Status value={row.status}/></Cell></tr>)}</Table></>}
    </>}

    {showCreatePr && <CreatePrModal branches={branches} products={products} onClose={() => setShowCreatePr(false)} onSaved={async () => { setShowCreatePr(false); await reload(); }}/>}
    {approvalPr && <ApprovalModal request={approvalPr} onClose={() => setApprovalPr(null)} onApproved={async () => { setApprovalPr(null); await reload(); }}/>}
  </div>;
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
    } catch (error: any) { showToast.error(apiMessage(error, 'Gagal membuat Purchase Request.')); }
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
          <input required type="number" min="0" step="0.0001" value={line.estimatedUnitCost} onChange={(e) => setLine(index, { estimatedUnitCost: e.target.value })} className={inputClass} placeholder="Estimasi harga/unit"/>
          <button type="button" disabled={lines.length === 1} onClick={() => setLines((old) => old.filter((_, i) => i !== index))} className="px-2 text-red-600 disabled:opacity-30">Hapus</button>
        </div>)}
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving || !branches.length || !products.length} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan DRAFT'}</button></div>
    </form>
  </Modal>;
}

function ApprovalModal({ request, onClose, onApproved }: { request: PurchaseRequest; onClose: () => void; onApproved: () => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(Object.fromEntries(request.items.map((item) => [item.id, item.requestedQty])));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const approve = async () => {
    setSaving(true);
    try {
      await purchasingApi.approveRequest(request.id, request.items.map((item) => ({ itemId: item.id, approvedQty: quantities[item.id] })), note || undefined);
      showToast.success('Purchase Request disetujui.'); await onApproved();
    } catch (error: any) { showToast.error(apiMessage(error, 'Approval gagal.')); }
    finally { setSaving(false); }
  };
  return <Modal title={`Review ${request.requestNumber}`} subtitle={`Maker: ${request.creator?.email || '-'} · Ubah quantity untuk menguji batas approval.`} onClose={onClose}>
    <div className="space-y-4">
      {request.items.map((item) => <div key={item.id} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_180px]"><div><b>{item.masterProduct?.sku || 'Item'} — {item.masterProduct?.name || item.description}</b><small className="block text-neutral-500">Diminta: {item.requestedQty} {item.masterProduct?.baseUnit || item.masterProduct?.unit || ''}</small></div><Field label="Quantity disetujui"><input type="number" min="0" step="0.0001" value={quantities[item.id]} onChange={(e) => setQuantities((old) => ({ ...old, [item.id]: e.target.value }))} className={inputClass}/></Field></div>)}
      <Field label="Catatan approver"><textarea value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} rows={3} placeholder="Opsional"/></Field>
      <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Maker tidak boleh menyetujui PR buatannya sendiri. Server akan menolak percobaan self-approval.</div>
      <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={saving} onClick={() => void approve()} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Memproses…' : 'Setujui PR'}</button></div>
    </div>
  </Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-neutral-500">{subtitle}</p></div><button onClick={onClose} aria-label="Tutup"><X/></button></div>{children}</div></div>;
}
function SupplierForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ code: '', name: '', paymentTermsDays: '30' });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await purchasingApi.createSupplier({ ...form, paymentTermsDays: Number(form.paymentTermsDays) }); showToast.success('Supplier dibuat.'); setForm({ code: '', name: '', paymentTermsDays: '30' }); await onSaved(); } catch (error: any) { showToast.error(apiMessage(error, 'Gagal membuat supplier.')); } };
  return <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl border p-4 md:grid-cols-4"><input className={inputClass} required placeholder="Kode" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}/><input className={inputClass} required placeholder="Nama supplier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/><input className={inputClass} required type="number" min="0" placeholder="Termin hari" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}/><button className="rounded-lg bg-blue-600 px-4 py-2 text-white">Tambah supplier</button></form>;
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="text-left">{headers.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Cell({ children }: { children: React.ReactNode }) { return <td className="p-3 align-top">{children}</td>; }
function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>; }
function Status({ value }: { value: string }) { const color = value === 'APPROVED' || value === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : value === 'REJECTED' || value === 'BLOCKED' ? 'bg-red-100 text-red-700' : value === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-700'; return <span className={`rounded-full px-2 py-1 text-xs font-medium ${color}`}>{value}</span>; }
const inputClass = 'w-full rounded-lg border bg-transparent px-3 py-2';
const date = (value: string) => new Date(value).toLocaleDateString('id-ID');
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string) => new Intl.NumberFormat('id-ID').format(Number(value));
const apiMessage = (error: any, fallback: string) => error.response?.data?.error?.message || fallback;
function promptSupplier(rows: Supplier[]) { const code = prompt(`Kode supplier:\n${rows.filter((r) => r.status === 'ACTIVE').map((r) => `${r.code} — ${r.name}`).join('\n')}`)?.toUpperCase(); return rows.find((row) => row.code === code)?.id; }
function promptCash(rows: CashBankAccount[]) { const code = prompt(`Kode kas/bank:\n${rows.map((r) => `${r.code} — ${r.name}`).join('\n')}`)?.toUpperCase(); return rows.find((row) => row.code === code)?.id; }
