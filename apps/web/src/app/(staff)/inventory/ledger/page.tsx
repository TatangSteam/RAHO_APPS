'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, PackagePlus, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import styles from '../operations.module.css';

type Row = Record<string, any>;

function idempotencyKey(prefix: string) {
  return `${prefix}:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

export default function InventoryLedgerPage() {
  const { user, activeBranchId } = useAuthStore();
  const [view, setView] = useState<'BALANCE' | 'POSTING'>('BALANCE');
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchId, setBranchId] = useState(activeBranchId || user?.branchId || '');
  const [balances, setBalances] = useState<Row[]>([]);
  const [postings, setPostings] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inboundMode, setInboundMode] = useState<'RECEIPT' | 'OPENING'>('RECEIPT');
  const [receipt, setReceipt] = useState({ inventoryItemId: '', quantity: '', unitCost: '', batchNumber: '', expiryDate: '', sourceId: '' });
  const [issue, setIssue] = useState({ inventoryItemId: '', quantity: '', sourceId: '' });

  const canPost = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'].includes(user?.role || '');
  const canPostOpening = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK'].includes(user?.role || '');
  const canReverse = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK'].includes(user?.role || '');

  const load = useCallback(async () => {
    if (!branchId) {
      try {
        const response = await api.get('/branches', { params: { isActive: true, limit: 100 } });
        const rows = response.data?.data || [];
        setBranches(rows);
        if (rows[0]?.id) setBranchId(rows[0].id);
      } catch { setError('Gagal memuat cabang.'); }
      return;
    }
    try {
      setLoading(true);
      setError('');
      const [branchResponse, balanceResponse, postingResponse, itemResponse] = await Promise.all([
        api.get('/branches', { params: { isActive: true, limit: 100 } }),
        inventoryApi.getLedgerBalances({ branchId, limit: 100 }),
        inventoryApi.getLedgerPostings({ branchId, limit: 100 }),
        inventoryApi.getInventoryItems(branchId),
      ]);
      setBranches(branchResponse.data?.data || []);
      setBalances(balanceResponse.data?.data?.data || []);
      setPostings(postingResponse.data?.data || []);
      setItems(itemResponse.data?.data?.items || itemResponse.data?.data || []);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Gagal memuat inventory ledger. Jalankan migration terlebih dahulu.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { void load(); }, [load]);

  const submitReceipt = async (event: FormEvent) => {
    event.preventDefault();
    const selected = items.find((item) => item.id === receipt.inventoryItemId);
    try {
      setSaving(true);
      const payload = {
        idempotencyKey: idempotencyKey(inboundMode), branchId, inventoryItemId: receipt.inventoryItemId,
        quantity: receipt.quantity, unitCost: receipt.unitCost,
        sourceId: receipt.sourceId || idempotencyKey(inboundMode === 'OPENING' ? 'OPENING' : 'SRC'),
        ...(selected?.masterProduct?.tracksBatch ? { batch: { batchNumber: receipt.batchNumber, expiryDate: receipt.expiryDate || undefined } } : {}),
      };
      if (inboundMode === 'OPENING') await inventoryApi.postOpeningStock(payload);
      else await inventoryApi.receiveInventory({ ...payload, sourceType: 'MANUAL_RECEIPT', reasonCode: 'MANUAL_RECEIPT' });
      setReceipt({ inventoryItemId: '', quantity: '', unitCost: '', batchNumber: '', expiryDate: '', sourceId: '' });
      showToast.success(inboundMode === 'OPENING' ? 'Opening stock berhasil diposting.' : 'Receipt berhasil diposting.');
      await load();
    } catch (requestError: any) { showToast.error(requestError.response?.data?.error?.message || 'Receipt gagal.'); }
    finally { setSaving(false); }
  };

  const submitIssue = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await inventoryApi.issueInventory({
        idempotencyKey: idempotencyKey('ISSUE'), branchId, sourceType: 'MANUAL_ISSUE',
        sourceId: issue.sourceId || idempotencyKey('SRC'), reasonCode: 'MANUAL_ISSUE',
        lines: [{ inventoryItemId: issue.inventoryItemId, quantity: issue.quantity }],
      });
      setIssue({ inventoryItemId: '', quantity: '', sourceId: '' });
      showToast.success('Issue FIFO berhasil diposting.');
      await load();
    } catch (requestError: any) { showToast.error(requestError.response?.data?.error?.message || 'Issue FIFO gagal.'); }
    finally { setSaving(false); }
  };

  const reverse = async (posting: Row) => {
    const reason = window.prompt('Alasan reversal');
    if (!reason) return;
    try {
      setSaving(true);
      await inventoryApi.reverseInventoryPosting(posting.id, { idempotencyKey: idempotencyKey('REVERSAL'), reasonCode: reason });
      showToast.success('Posting berhasil dibalik.');
      await load();
    } catch (requestError: any) { showToast.error(requestError.response?.data?.error?.message || 'Reversal gagal.'); }
    finally { setSaving(false); }
  };

  const summary = useMemo(() => balances.reduce((totals, row) => ({
    onHand: totals.onHand + Number(row.onHandQty || 0),
    available: totals.available + Number(row.availableQty || 0),
    reserved: totals.reserved + Number(row.reservedQty || 0),
    quarantine: totals.quarantine + Number(row.quarantineQty || 0),
  }), { onHand: 0, available: 0, reserved: 0, quarantine: 0 }), [balances]);

  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Inventory Ledger</h1><p>Saldo per lokasi dan batch, FIFO cost, mutation, serta reversal.</p></div><button className={styles.secondaryButton} onClick={() => void load()} title="Muat ulang"><RefreshCw size={16} /></button></header>
    <div className={styles.toolbar}><label className={styles.field}><span>Cabang</span><select className={styles.select} value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label></div>

    {canPost && <>
      <form className={styles.form} onSubmit={submitReceipt}>
        {canPostOpening && <div className={styles.segmented} aria-label="Tipe inbound"><button type="button" className={inboundMode === 'RECEIPT' ? styles.segmentActive : styles.segment} onClick={() => setInboundMode('RECEIPT')}><ArrowDownToLine size={15} /> Receipt</button><button type="button" className={inboundMode === 'OPENING' ? styles.segmentActive : styles.segment} onClick={() => setInboundMode('OPENING')}><PackagePlus size={15} /> Opening</button></div>}
        <label className={styles.field}><span>{inboundMode === 'OPENING' ? 'Opening item' : 'Terima item'}</span><select className={styles.select} required value={receipt.inventoryItemId} onChange={(event) => setReceipt({ ...receipt, inventoryItemId: event.target.value })}><option value="">Pilih</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || ''} {item.masterProduct?.name}</option>)}</select></label>
        <label className={styles.field}><span>Quantity</span><input className={styles.input} required inputMode="decimal" value={receipt.quantity} onChange={(event) => setReceipt({ ...receipt, quantity: event.target.value })} /></label>
        <label className={styles.field}><span>Unit cost</span><input className={styles.input} required inputMode="decimal" value={receipt.unitCost} onChange={(event) => setReceipt({ ...receipt, unitCost: event.target.value })} /></label>
        <label className={styles.field}><span>Batch (jika wajib)</span><input className={styles.input} value={receipt.batchNumber} onChange={(event) => setReceipt({ ...receipt, batchNumber: event.target.value })} /></label>
        <label className={styles.field}><span>Expiry</span><input className={styles.input} type="date" value={receipt.expiryDate} onChange={(event) => setReceipt({ ...receipt, expiryDate: event.target.value })} /></label>
        <button className={styles.button} disabled={saving}>{inboundMode === 'OPENING' ? <PackagePlus size={15} /> : <ArrowDownToLine size={15} />} Posting {inboundMode === 'OPENING' ? 'opening' : 'receipt'}</button>
      </form>
      <form className={styles.form} onSubmit={submitIssue}>
        <ArrowUpFromLine size={20} />
        <label className={styles.field}><span>Keluarkan item</span><select className={styles.select} required value={issue.inventoryItemId} onChange={(event) => setIssue({ ...issue, inventoryItemId: event.target.value })}><option value="">Pilih</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || ''} {item.masterProduct?.name}</option>)}</select></label>
        <label className={styles.field}><span>Quantity FIFO</span><input className={styles.input} required inputMode="decimal" value={issue.quantity} onChange={(event) => setIssue({ ...issue, quantity: event.target.value })} /></label>
        <label className={styles.field}><span>Referensi</span><input className={styles.input} value={issue.sourceId} onChange={(event) => setIssue({ ...issue, sourceId: event.target.value })} /></label>
        <button className={styles.button} disabled={saving}><ArrowUpFromLine size={15} /> Posting issue</button>
      </form>
    </>}

    <div className={styles.summary}>{Object.entries(summary).map(([key, value]) => <div key={key} className={styles.summaryItem}><span>{key}</span><strong>{value.toLocaleString('id-ID', { maximumFractionDigits: 4 })}</strong></div>)}</div>
    <nav className={styles.tabs}><button className={`${styles.tab} ${view === 'BALANCE' ? styles.tabActive : ''}`} onClick={() => setView('BALANCE')}>Saldo</button><button className={`${styles.tab} ${view === 'POSTING' ? styles.tabActive : ''}`} onClick={() => setView('POSTING')}>Posting & FIFO</button></nav>
    {error && <div className={styles.error}>{error}</div>}
    {loading ? <div className={styles.loading}>Memuat ledger...</div> : view === 'BALANCE' ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Produk</th><th>Warehouse / Lokasi</th><th>Batch</th><th className={styles.number}>On hand</th><th className={styles.number}>Reserved</th><th className={styles.number}>Quarantine</th><th className={styles.number}>Available</th></tr></thead><tbody>{balances.map((row) => <tr key={row.id}><td>{row.masterProduct?.sku}<br />{row.masterProduct?.name}</td><td>{row.stockLocation?.warehouse?.code} / {row.stockLocation?.code}</td><td>{row.batch?.batchNumber || '-'}</td><td className={styles.number}>{String(row.onHandQty)}</td><td className={styles.number}>{String(row.reservedQty)}</td><td className={styles.number}>{String(row.quarantineQty)}</td><td className={styles.number}>{String(row.availableQty)}</td></tr>)}</tbody></table></div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Nomor / Tanggal</th><th>Type</th><th>Source</th><th>Mutation</th><th className={styles.number}>Actual cost</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{postings.map((posting) => <tr key={posting.id}><td>{posting.postingNumber}<br />{new Date(posting.occurredAt).toLocaleString('id-ID')}</td><td>{posting.type}</td><td>{posting.sourceType}<br />{posting.sourceId}</td><td>{posting.stockMutations?.map((mutation: Row) => `${mutation.inventoryItem?.masterProduct?.name}: ${mutation.quantity}`).join(', ') || '-'}</td><td className={styles.number}>{String(posting.totalCost)}</td><td><span className={posting.status === 'POSTED' ? styles.badge : styles.inactiveBadge}>{posting.status}</span></td><td>{canReverse && posting.type === 'ISSUE' && posting.status === 'POSTED' ? <button className={styles.secondaryButton} disabled={saving} onClick={() => void reverse(posting)} title="Reverse"><RotateCcw size={15} /></button> : '-'}</td></tr>)}</tbody></table></div>}
  </main>;
}
