'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { openingBalanceApi, type OpeningBalance, type OpeningLine } from '@/lib/openingBalanceApi';
import { accountingApi, type Account } from '@/lib/accountingApi';
import { cashBankApi, type CashBankAccount } from '@/lib/cashBankApi';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';

type Branch = { id: string; branchCode: string; name: string };

const emptyLines: OpeningLine[] = [
  { type: 'GENERAL', accountCode: '', description: '', debit: '0', credit: '0' },
  { type: 'GENERAL', accountCode: '', description: '', debit: '0', credit: '0' },
];

const editableLines = (opening: OpeningBalance): OpeningLine[] => opening.lines.map((line) => ({
  type: line.type,
  accountCode: line.accountCode,
  description: line.description,
  debit: line.debit,
  credit: line.credit,
  counterpartyRef: line.counterpartyRef,
  cashBankAccountId: line.cashBankAccountId,
  inventoryItemId: line.inventoryItemId,
  stockLocationId: line.stockLocationId,
  quantity: line.quantity,
  unitCost: line.unitCost,
  batchNumber: line.batchNumber,
  manufactureDate: line.manufactureDate,
  expiryDate: line.expiryDate,
}));

export default function OpeningBalancesPage() {
  const [rows, setRows] = useState<OpeningBalance[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [permissions, setPermissions] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OpeningBalance | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [opening, branchResponse, access] = await Promise.all([
        openingBalanceApi.list(),
        api.get('/branches/all'),
        api.get('/iam/me'),
      ]);
      setRows(opening);
      setBranches(branchResponse.data.data || []);
      setPermissions(new Set(access.data.data?.permissions || []));
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat opening balance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const action = async (operation: () => Promise<unknown>, message: string) => {
    try {
      await operation();
      showToast.success(message);
      await reload();
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Aksi gagal.');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6
      [&_select]:text-neutral-900 [&_option]:bg-white [&_option]:text-neutral-900
      dark:[&_select]:text-neutral-100 dark:[&_select]:[color-scheme:dark]
      dark:[&_option]:bg-neutral-900 dark:[&_option]:text-neutral-100">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Scale /> Opening Balance</h1>
          <p className="mt-1 text-sm text-neutral-500">Saldo awal finance dan stok diposting atomik, traceable ke jurnal serta FIFO cost layer.</p>
        </div>
        {permissions.has('OPENING_BALANCE.MANAGE') && (
          <button onClick={() => { setEditing(null); setShowForm((value) => !value); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
            Buat opening
          </button>
        )}
      </header>

      {showForm && (
        <OpeningForm
          branches={branches}
          existing={editing || undefined}
          onCancel={closeForm}
          onSaved={async () => { closeForm(); await reload(); }}
        />
      )}

      {loading ? <p>Memuat…</p> : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong>{row.documentNumber}</strong>
                  <p className="text-sm text-neutral-500">{row.branch.branchCode} · {new Date(row.balanceDate).toLocaleDateString('id-ID')} · {row.description}</p>
                  <p className="mt-1 text-xs text-neutral-500">Maker: {row.creator?.email || row.createdBy}{row.reviewer && <> · Reviewer: {row.reviewer.email}</>}</p>
                  {row.rejectionReason && <p className="mt-1 text-xs font-medium text-red-600">Alasan: {row.rejectionReason}</p>}
                </div>
                <div className="text-right">
                  <span className="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{row.status}</span>
                  <p className="mt-2 font-mono text-sm">Dr/Cr Rp {row.totalDebit}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['DRAFT', 'REJECTED'].includes(row.status) && permissions.has('OPENING_BALANCE.MANAGE') && (
                  <Small onClick={() => { setEditing(row); setShowForm(true); }}>Edit / Koreksi</Small>
                )}
                {row.status === 'DRAFT' && permissions.has('OPENING_BALANCE.MANAGE') && (
                  <Small onClick={() => action(() => openingBalanceApi.submit(row.id), 'Opening balance diajukan.')}>Ajukan</Small>
                )}
                {row.status === 'REJECTED' && permissions.has('OPENING_BALANCE.MANAGE') && (
                  <Small onClick={() => action(() => openingBalanceApi.submit(row.id), 'Opening balance diajukan ulang.')}>Ajukan ulang</Small>
                )}
                {row.status === 'SUBMITTED' && permissions.has('OPENING_BALANCE.POST') && (
                  <>
                    <Small onClick={() => action(() => openingBalanceApi.post(row.id), 'Opening balance dan cost layer diposting.')}>Posting sebagai Finance</Small>
                    <Small onClick={() => {
                      const reason = window.prompt('Alasan penolakan');
                      if (reason) void action(() => openingBalanceApi.reject(row.id, reason), 'Opening balance ditolak.');
                    }}>Tolak</Small>
                  </>
                )}
                {row.journalEntry && <span className="text-xs text-neutral-500">Jurnal {row.journalEntry.journalNumber}</span>}
              </div>

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer">{row.lines.length} line, subledger, dan riwayat status</summary>
                <div className="mt-2 space-y-1">
                  {row.lines.map((line) => (
                    <div key={line.id} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t py-2">
                      <span>
                        {line.accountCode} — {line.description}
                        {line.inventoryPosting && <small className="block text-neutral-500">Inventory: {line.inventoryPosting.postingNumber} · {line.inventoryPosting.id}</small>}
                        {line.cashBankTransaction && <small className="block text-neutral-500">Cash/Bank: {line.cashBankTransaction.transactionNumber} · {line.cashBankTransaction.id}</small>}
                      </span>
                      <span className="font-mono">Dr {line.debit}</span>
                      <span className="font-mono">Cr {line.credit}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Riwayat status</h4>
                  {row.history.map((history) => (
                    <div key={history.id} className="border-t py-2 text-xs">
                      <span className="font-medium">{new Date(history.createdAt).toLocaleString('id-ID')} · {history.user?.email || 'system'}</span>
                      <p>{history.description}</p>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          ))}
          {rows.length === 0 && <p className="rounded-xl border p-6 text-center text-neutral-500">Belum ada opening balance.</p>}
        </div>
      )}
    </div>
  );
}

function OpeningForm({ branches, existing, onSaved, onCancel }: {
  branches: Branch[];
  existing?: OpeningBalance;
  onSaved: () => void;
  onCancel: () => void;
}) {
  type InventoryItemOption = { id: string; masterProduct?: { sku?: string; name?: string } };
  type LocationOption = { id: string; code?: string; name: string };
  const [form, setForm] = useState({
    branchId: existing?.branch.id || '',
    balanceDate: existing?.balanceDate.slice(0, 10) || new Date().toISOString().slice(0, 10),
    description: existing?.description || 'Opening balance go-live',
  });
  const [lines, setLines] = useState<OpeningLine[]>(existing ? editableLines(existing) : emptyLines);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashBankAccount[]>([]);
  const [items, setItems] = useState<InventoryItemOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    void accountingApi.accounts()
      .then((result) => setAccounts(result.filter((account) => account.isActive && account.allowPosting)))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    if (!form.branchId) {
      setCashAccounts([]);
      setItems([]);
      setLocations([]);
      return;
    }
    void Promise.all([
      cashBankApi.listAccounts({ branchId: form.branchId, isActive: 'true' }),
      inventoryApi.getInventoryItems(form.branchId),
      api.get('/inventory/warehouses', { params: { branchId: form.branchId } }),
    ]).then(async ([cash, itemResponse, warehouseResponse]) => {
      setCashAccounts(cash);
      setItems(itemResponse.data.data || []);
      const warehouses = warehouseResponse.data.data || [];
      const locationResponses = await Promise.all(
        warehouses.map((warehouse: { id: string }) => api.get('/inventory/stock-locations', { params: { warehouseId: warehouse.id } })),
      );
      setLocations(locationResponses.flatMap((response) => response.data.data || []));
    }).catch(() => {
      setCashAccounts([]);
      setItems([]);
      setLocations([]);
    });
  }, [form.branchId]);

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const difference = totalDebit - totalCredit;
  const balanced = totalDebit > 0 && Math.abs(difference) < 0.005;
  const currency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);

  const updateLine = (index: number, patch: Partial<OpeningLine>) => {
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const updated = { ...line, ...patch };
      if (updated.type === 'INVENTORY' && (patch.quantity !== undefined || patch.unitCost !== undefined)) {
        updated.debit = (Number(updated.quantity || 0) * Number(updated.unitCost || 0)).toFixed(2);
        updated.credit = '0';
      }
      return updated;
    }));
  };

  const changeType = (index: number, type: OpeningLine['type']) => {
    updateLine(index, {
      type,
      cashBankAccountId: undefined,
      inventoryItemId: undefined,
      stockLocationId: undefined,
      quantity: undefined,
      unitCost: undefined,
      batchNumber: undefined,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setFormError('');
      if (!balanced) {
        setFormError(`Total belum seimbang. Selisih ${currency(Math.abs(difference))}.`);
        return;
      }
      if (lines.some((line) => !line.accountCode || !line.description.trim() || ((Number(line.debit) > 0) === (Number(line.credit) > 0)))) {
        setFormError('Lengkapi akun dan keterangan; setiap baris harus memiliki tepat satu nilai debit atau kredit.');
        return;
      }
      if (existing) {
        await openingBalanceApi.update(existing.id, { description: form.description, lines });
      } else {
        await openingBalanceApi.create({ ...form, postingKey: crypto.randomUUID(), lines });
      }
      showToast.success(existing ? 'Opening balance dikoreksi.' : 'Draft opening balance dibuat.');
      onSaved();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Gagal menyimpan opening balance.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        <Field label="Cabang">
          <select required disabled={Boolean(existing)} value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}>
            <option value="">Pilih cabang</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} — {branch.name}</option>)}
          </select>
        </Field>
        <Field label="Tanggal saldo"><input required disabled={Boolean(existing)} type="date" value={form.balanceDate} onChange={(event) => setForm({ ...form, balanceDate: event.target.value })} /></Field>
        <Field label="Keterangan"><input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
      </div>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">Rincian saldo awal</h3><p className="text-xs text-neutral-500">Tambahkan baris debit dan kredit seperti lembar kerja jurnal.</p></div>
          <button type="button" onClick={() => setLines((current) => [...current, { type: 'GENERAL', accountCode: '', description: '', debit: '0', credit: '0' }])} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Plus size={15} /> Tambah baris</button>
        </div>
        {lines.map((line, index) => (
          <div key={index} className="min-w-0 space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[180px_minmax(240px,1fr)_minmax(280px,1fr)_44px]">
              <label className="grid min-w-0 gap-1 text-xs font-medium">Jenis saldo
                <select value={line.type} onChange={(event) => changeType(index, event.target.value as OpeningLine['type'])} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-2 text-sm">
                  <option value="GENERAL">Umum</option><option value="CASH_BANK">Kas / Bank</option><option value="INVENTORY">Persediaan</option><option value="AR">Piutang</option><option value="AP">Utang</option><option value="DEPOSIT">Deposit</option><option value="DEFERRED_REVENUE">Pendapatan diterima di muka</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-medium">Akun
                <select required value={line.accountCode} onChange={(event) => updateLine(index, { accountCode: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-2 text-sm">
                  <option value="">Pilih akun</option>
                  {accounts.map((account) => <option key={account.id} value={account.code}>{account.code} — {account.name}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-medium md:col-span-2 xl:col-span-1">Keterangan
                <input required value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-sm" placeholder="Contoh: Saldo awal kas" />
              </label>
              <button type="button" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="h-10 w-11 self-end justify-self-end rounded-lg border text-red-600 disabled:cursor-not-allowed disabled:opacity-30 md:col-start-2 xl:col-start-auto" title={lines.length <= 2 ? 'Minimal dua baris diperlukan' : 'Hapus baris'}><Trash2 className="mx-auto" size={16} /></button>
            </div>

            {line.type === 'CASH_BANK' && (
              <label className="grid min-w-0 gap-1 text-xs font-medium">Rekening kas/bank
                <select required value={line.cashBankAccountId || ''} onChange={(event) => {
                  const selected = cashAccounts.find((account) => account.id === event.target.value);
                  updateLine(index, { cashBankAccountId: event.target.value, accountCode: selected?.coaAccount.code || line.accountCode });
                }} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-2 text-sm">
                  <option value="">Pilih rekening</option>
                  {cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
                </select>
              </label>
            )}

            {['AR', 'AP', 'DEPOSIT', 'DEFERRED_REVENUE'].includes(line.type) && (
              <label className="grid min-w-0 gap-1 text-xs font-medium">Referensi pihak/dokumen
                <input value={line.counterpartyRef || ''} onChange={(event) => updateLine(index, { counterpartyRef: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-sm" placeholder="Contoh: INV-001, Supplier ABC, atau kontrak member" />
              </label>
            )}

            {line.type === 'INVENTORY' && (
              <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid min-w-0 gap-1 text-xs font-medium">Item persediaan<select required value={line.inventoryItemId || ''} onChange={(event) => updateLine(index, { inventoryItemId: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-2 text-sm"><option value="">Pilih item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || '-'} — {item.masterProduct?.name || item.id}</option>)}</select></label>
                <label className="grid min-w-0 gap-1 text-xs font-medium">Lokasi stok<select required value={line.stockLocationId || ''} onChange={(event) => updateLine(index, { stockLocationId: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-2 text-sm"><option value="">Pilih lokasi</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code ? `${location.code} — ` : ''}{location.name}</option>)}</select></label>
                <label className="grid min-w-0 gap-1 text-xs font-medium">Jumlah<input required type="number" min="0" step="0.0001" value={line.quantity || ''} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-sm" /></label>
                <label className="grid min-w-0 gap-1 text-xs font-medium">Harga per unit<input required type="number" min="0" step="0.0001" value={line.unitCost || ''} onChange={(event) => updateLine(index, { unitCost: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-sm" /></label>
                <label className="grid min-w-0 gap-1 text-xs font-medium">Batch (opsional)<input value={line.batchNumber || ''} onChange={(event) => updateLine(index, { batchNumber: event.target.value })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 text-sm" /></label>
              </div>
            )}

            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-xs font-medium">Debit
                <div className="relative min-w-0"><span className="absolute left-3 top-2.5 text-sm text-neutral-500">Rp</span><input type="number" min="0" step="0.01" disabled={line.type === 'INVENTORY'} value={line.debit} onChange={(event) => updateLine(index, { debit: event.target.value, credit: Number(event.target.value) > 0 ? '0' : line.credit })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent pl-10 pr-3 text-right text-sm" /></div>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-medium">Kredit
                <div className="relative min-w-0"><span className="absolute left-3 top-2.5 text-sm text-neutral-500">Rp</span><input type="number" min="0" step="0.01" disabled={line.type === 'INVENTORY'} value={line.credit} onChange={(event) => updateLine(index, { credit: event.target.value, debit: Number(event.target.value) > 0 ? '0' : line.debit })} className="h-10 w-full min-w-0 rounded-lg border bg-transparent pl-10 pr-3 text-right text-sm" /></div>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className={`grid gap-3 rounded-xl border p-4 sm:grid-cols-3 ${balanced ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'}`}>
        <div><p className="text-xs text-neutral-500">Total debit</p><strong>{currency(totalDebit)}</strong></div>
        <div><p className="text-xs text-neutral-500">Total kredit</p><strong>{currency(totalCredit)}</strong></div>
        <div><p className="text-xs text-neutral-500">Status</p><strong>{balanced ? 'Seimbang' : `Belum seimbang · selisih ${currency(Math.abs(difference))}`}</strong></div>
      </div>
      {formError && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">{formError}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2">Batal</button>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">{existing ? 'Simpan koreksi' : 'Simpan draft'}</button>
      </div>
    </form>
  );
}

function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm [&_input]:rounded-lg [&_input]:border [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2 [&_select]:rounded-lg [&_select]:border [&_select]:bg-transparent [&_select]:px-3 [&_select]:py-2">{label}{children}</label>;
}
