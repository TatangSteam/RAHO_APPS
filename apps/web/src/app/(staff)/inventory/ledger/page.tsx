'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, PackagePlus, RefreshCw, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { InventoryMasterProduct, inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import styles from '../operations.module.css';

import type { InventoryLegacyRow as Row } from '@/types/inventoryLegacy';

function idempotencyKey(prefix: string) {
  return `${prefix}:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function newInboundForm(mode: 'RECEIPT' | 'OPENING') {
  return {
    idempotencyKey: idempotencyKey(mode),
    inventoryItemId: '',
    masterProductId: '',
    quantity: '',
    unitCost: '',
    batchNumber: '',
    expiryDate: '',
    sourceId: idempotencyKey(`${mode}-DOC`),
  };
}

export default function InventoryLedgerPage() {
  const { user, activeBranchId } = useAuthStore();
  const [view, setView] = useState<'BALANCE' | 'POSTING'>('BALANCE');
  const [branches, setBranches] = useState<Row[]>([]);
  const [branchId, setBranchId] = useState(activeBranchId || user?.branchId || '');
  const [balances, setBalances] = useState<Row[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<Row | null>(null);
  const [balanceMeta, setBalanceMeta] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });
  const [balancePage, setBalancePage] = useState(1);
  const [postings, setPostings] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [products, setProducts] = useState<InventoryMasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inboundMode, setInboundMode] = useState<'RECEIPT' | 'OPENING'>('RECEIPT');
  const [receipt, setReceipt] = useState(() => newInboundForm('RECEIPT'));
  const [issue, setIssue] = useState({ inventoryItemId: '', quantity: '', sourceId: '' });
  const [reconciliation, setReconciliation] = useState<Row | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [lastInboundPosting, setLastInboundPosting] = useState<Row | null>(null);

  const canPostReceipt = permissions.has('INVENTORY.POST');
  const canPostOpening = permissions.has('INVENTORY.OPENING.POST');
  const canPost = canPostReceipt || canPostOpening;
  const canReverse = permissions.has('INVENTORY.REVERSE');
  const selectedInboundProduct = useMemo(() => (
    inboundMode === 'OPENING'
      ? products.find((product) => product.id === receipt.masterProductId)
      : items.find((item) => item.id === receipt.inventoryItemId)?.masterProduct
  ), [inboundMode, items, products, receipt.inventoryItemId, receipt.masterProductId]);

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
      const accessResponse = await api.get('/iam/me');
      const effectivePermissions = new Set<string>(accessResponse.data?.data?.permissions || []);
      setPermissions(effectivePermissions);
      const allowReconcile = effectivePermissions.has('INVENTORY.RECONCILE');
      if (!effectivePermissions.has('INVENTORY.POST') && effectivePermissions.has('INVENTORY.OPENING.POST')) {
        setInboundMode('OPENING');
      }
      const [branchResponse, balanceResponse, postingResponse, itemResponse, productResponse, reconciliationResponse] = await Promise.all([
        api.get('/branches', { params: { isActive: true, limit: 100 } }),
        inventoryApi.getLedgerBalances({ branchId, page: balancePage, limit: 100 }),
        inventoryApi.getLedgerPostings({ branchId, limit: 100 }),
        inventoryApi.getInventoryItems(branchId),
        inventoryApi.getMasterProducts(),
        allowReconcile ? inventoryApi.reconcileInventory(branchId) : Promise.resolve(null),
      ]);
      setBranches(branchResponse.data?.data || []);
      setBalances(balanceResponse.data?.data?.data || []);
      setBalanceSummary(balanceResponse.data?.data?.summary || null);
      setBalanceMeta(balanceResponse.data?.data?.meta || { page: balancePage, limit: 100, total: 0, totalPages: 1 });
      setPostings(postingResponse.data?.data || []);
      setItems(itemResponse.data?.data?.items || itemResponse.data?.data || []);
      setProducts((productResponse.data?.data?.products || []).filter((product) => product.isActive));
      setReconciliation(reconciliationResponse?.data?.data || null);
    } catch (requestError) {
      assertCaughtError(requestError);
      setError(requestError.response?.data?.error?.message || 'Gagal memuat inventory ledger. Jalankan migration terlebih dahulu.');
    } finally {
      setLoading(false);
    }
  }, [balancePage, branchId]);

  useEffect(() => { void load(); }, [load]);

  const submitReceipt = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = {
        idempotencyKey: receipt.idempotencyKey,
        branchId,
        ...(inboundMode === 'OPENING'
          ? { masterProductId: receipt.masterProductId }
          : { inventoryItemId: receipt.inventoryItemId }),
        quantity: receipt.quantity, unitCost: receipt.unitCost,
        sourceId: receipt.sourceId,
        ...(selectedInboundProduct?.tracksBatch ? { batch: { batchNumber: receipt.batchNumber, expiryDate: receipt.expiryDate || undefined } } : {}),
      };
      const response = inboundMode === 'OPENING'
        ? await inventoryApi.postOpeningStock(payload)
        : await inventoryApi.receiveInventory({ ...payload, sourceType: 'MANUAL_RECEIPT', reasonCode: 'MANUAL_RECEIPT' });
      setLastInboundPosting(response.data?.data || null);
      showToast.success(inboundMode === 'OPENING' ? 'Opening stock berhasil diposting.' : 'Receipt berhasil diposting.');
      await load();
    } catch (requestError) {
      assertCaughtError(requestError); showToast.error(requestError.response?.data?.error?.message || 'Receipt gagal.'); }
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
    } catch (requestError) {
      assertCaughtError(requestError); showToast.error(requestError.response?.data?.error?.message || 'Issue FIFO gagal.'); }
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
    } catch (requestError) {
      assertCaughtError(requestError); showToast.error(requestError.response?.data?.error?.message || 'Reversal gagal.'); }
    finally { setSaving(false); }
  };

  const pagedSummary = useMemo(() => balances.reduce((totals, row) => ({
    onHand: totals.onHand + Number(row.onHandQty || 0),
    available: totals.available + Number(row.availableQty || 0),
    reserved: totals.reserved + Number(row.reservedQty || 0),
    quarantine: totals.quarantine + Number(row.quarantineQty || 0),
    inTransit: totals.inTransit + Number(row.inTransitQty || 0),
  }), { onHand: 0, available: 0, reserved: 0, quarantine: 0, inTransit: 0 }), [balances]);
  const summary = balanceSummary ? {
    onHand: Number(balanceSummary.onHandQty || 0),
    available: Number(balanceSummary.availableQty || 0),
    reserved: Number(balanceSummary.reservedQty || 0),
    quarantine: Number(balanceSummary.quarantineQty || 0),
    inTransit: Number(balanceSummary.inTransitQty || 0),
  } : pagedSummary;
  const summaryLabels: Record<string, string> = {
    onHand: 'On hand',
    available: 'Available',
    reserved: 'Reserved',
    quarantine: 'Quarantine',
    inTransit: 'In transit',
  };
  const pendingValuationQty = Number(reconciliation?.pendingValuationQty || 0);
  const hasPendingValuation = pendingValuationQty > 0;
  const quantityMismatchCount = Number(reconciliation?.quantityMismatchCount ?? reconciliation?.mismatchCount ?? 0);
  const hasIncompleteValuation = hasPendingValuation || quantityMismatchCount > 0;

  return <main className={styles.page}>
    <header className={styles.header}><div><h1>Inventory Ledger</h1><p>Saldo per cabang dan batch, FIFO cost, mutation, serta reversal.</p></div><button className={styles.secondaryButton} onClick={() => void load()} title="Muat ulang"><RefreshCw size={16} /></button></header>
    <div className={styles.toolbar}><label className={styles.field}><span>Cabang</span><select className={styles.select} value={branchId} onChange={(event) => { setBalancePage(1); setBranchId(event.target.value); }}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label></div>

    {canPost && <>
      <form className={styles.form} onSubmit={submitReceipt}>
        {canPostReceipt && canPostOpening && <div className={styles.segmented} aria-label="Tipe inbound"><button type="button" className={inboundMode === 'RECEIPT' ? styles.segmentActive : styles.segment} onClick={() => { setInboundMode('RECEIPT'); setReceipt(newInboundForm('RECEIPT')); setLastInboundPosting(null); }}><ArrowDownToLine size={15} /> Receipt</button><button type="button" className={inboundMode === 'OPENING' ? styles.segmentActive : styles.segment} onClick={() => { setInboundMode('OPENING'); setReceipt(newInboundForm('OPENING')); setLastInboundPosting(null); }}><PackagePlus size={15} /> Opening</button></div>}
        <label className={styles.field}><span>{inboundMode === 'OPENING' ? 'Opening item' : 'Terima item'}</span>{inboundMode === 'OPENING'
          ? <select className={styles.select} required value={receipt.masterProductId} onChange={(event) => setReceipt({ ...receipt, masterProductId: event.target.value })}><option value="">Pilih produk</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku || ''} {product.name}</option>)}</select>
          : <select className={styles.select} required value={receipt.inventoryItemId} onChange={(event) => setReceipt({ ...receipt, inventoryItemId: event.target.value })}><option value="">Pilih item cabang</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || ''} {item.masterProduct?.name}</option>)}</select>}</label>
        <label className={styles.field}><span>Quantity</span><input className={styles.input} required type="number" min="0.0001" step="0.0001" value={receipt.quantity} onChange={(event) => setReceipt({ ...receipt, quantity: event.target.value })} /></label>
        <label className={styles.field}><span>Unit cost</span><input className={styles.input} required type="number" min="0" step="0.0001" value={receipt.unitCost} onChange={(event) => setReceipt({ ...receipt, unitCost: event.target.value })} /></label>
        <label className={styles.field}><span>Batch (jika wajib)</span><input className={styles.input} required={Boolean(selectedInboundProduct?.tracksBatch)} value={receipt.batchNumber} onChange={(event) => setReceipt({ ...receipt, batchNumber: event.target.value })} /></label>
        <label className={styles.field}><span>Expiry</span><input className={styles.input} required={Boolean(selectedInboundProduct?.tracksExpiry)} type="date" value={receipt.expiryDate} onChange={(event) => setReceipt({ ...receipt, expiryDate: event.target.value })} /></label>
        <label className={styles.field}><span>Source reference</span><input className={styles.input} required value={receipt.sourceId} onChange={(event) => setReceipt({ ...receipt, sourceId: event.target.value })} /></label>
        <label className={styles.field}><span>Idempotency key</span><input className={`${styles.input} ${styles.readOnlyInput}`} readOnly aria-readonly="true" value={receipt.idempotencyKey} title="Dibuat otomatis untuk mencegah transaksi ganda" /></label>
        <button className={styles.button} disabled={saving || (inboundMode === 'OPENING' ? !canPostOpening : !canPostReceipt)}>{inboundMode === 'OPENING' ? <PackagePlus size={15} /> : <ArrowDownToLine size={15} />} Posting {inboundMode === 'OPENING' ? 'opening' : 'receipt'}</button>
        <button type="button" className={styles.secondaryButton} disabled={saving} onClick={() => { setReceipt(newInboundForm(inboundMode)); setLastInboundPosting(null); }}>Transaksi baru</button>
        {lastInboundPosting && <output className={styles.badge}>Posting ID: {lastInboundPosting.id} · {lastInboundPosting.postingNumber}</output>}
      </form>
      <form className={styles.form} onSubmit={submitIssue}>
        <ArrowUpFromLine size={20} />
        <label className={styles.field}><span>Keluarkan item</span><select className={styles.select} required value={issue.inventoryItemId} onChange={(event) => setIssue({ ...issue, inventoryItemId: event.target.value })}><option value="">Pilih</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || ''} {item.masterProduct?.name}</option>)}</select></label>
        <label className={styles.field}><span>Quantity FIFO</span><input className={styles.input} required type="number" min="0.0001" step="0.0001" value={issue.quantity} onChange={(event) => setIssue({ ...issue, quantity: event.target.value })} /></label>
        <label className={styles.field}><span>Referensi</span><input className={styles.input} value={issue.sourceId} onChange={(event) => setIssue({ ...issue, sourceId: event.target.value })} /></label>
        <button className={styles.button} disabled={saving}><ArrowUpFromLine size={15} /> Posting issue</button>
      </form>
    </>}

    <div className={styles.summary}>{Object.entries(summary).map(([key, value]) => <div key={key} className={styles.summaryItem}><span>{summaryLabels[key]}</span><strong>{value.toLocaleString('id-ID', { maximumFractionDigits: 4 })}</strong></div>)}</div>
    {hasIncompleteValuation && <div className={styles.notice} role="status"><strong>Nilai persediaan belum lengkap.</strong>{hasPendingValuation && <> {pendingValuationQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} unit pada {Number(reconciliation?.pendingValuationItemCount || 0).toLocaleString('id-ID')} item masih menunggu unit cost.</>}{quantityMismatchCount > 0 && <> {quantityMismatchCount.toLocaleString('id-ID')} item memiliki selisih antara saldo, mirror stock, atau cost layer.</>} Lengkapi dan rekonsiliasi melalui Dashboard Logistik → Valuation sebelum memakai total nilai untuk laporan keuangan.</div>}
    {reconciliation && <div className={styles.summary}>
      <div className={styles.summaryItem}><span>Nilai cost layer</span><strong>Rp {Number(reconciliation.layerValue || 0).toLocaleString('id-ID')}</strong></div>
      <div className={styles.summaryItem}><span>Nilai in-transit</span><strong>Rp {Number(reconciliation.inTransitValue || 0).toLocaleString('id-ID')}</strong></div>
      <div className={`${styles.summaryItem} ${hasPendingValuation ? styles.summaryItemWarning : ''}`}><span>Pending valuation</span><strong>{pendingValuationQty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} unit</strong></div>
      <div className={`${styles.summaryItem} ${hasIncompleteValuation ? styles.summaryItemWarning : ''}`}><span>Total inventory value</span><strong>{hasIncompleteValuation ? 'Belum lengkap' : `Rp ${Number(reconciliation.totalInventoryValue || 0).toLocaleString('id-ID')}`}</strong>{hasIncompleteValuation && <small>Rp {Number(reconciliation.totalInventoryValue || 0).toLocaleString('id-ID')} sudah dinilai</small>}</div>
      <div className={`${styles.summaryItem} ${quantityMismatchCount > 0 ? styles.summaryItemWarning : ''}`}><span>Quantity mismatch</span><strong>{quantityMismatchCount}</strong></div>
    </div>}
    {view === 'BALANCE' && balanceMeta.total > 0 && <div className={styles.pagination}><span>Menampilkan {((balanceMeta.page - 1) * balanceMeta.limit) + 1}–{Math.min(balanceMeta.page * balanceMeta.limit, balanceMeta.total)} dari {balanceMeta.total} saldo</span><div><button type="button" className={styles.secondaryButton} disabled={balanceMeta.page <= 1 || loading} onClick={() => setBalancePage((page) => Math.max(1, page - 1))}>Sebelumnya</button><button type="button" className={styles.secondaryButton} disabled={balanceMeta.page >= balanceMeta.totalPages || loading} onClick={() => setBalancePage((page) => page + 1)}>Berikutnya</button></div></div>}
    <nav className={styles.tabs}><button className={`${styles.tab} ${view === 'BALANCE' ? styles.tabActive : ''}`} onClick={() => setView('BALANCE')}>Saldo</button><button className={`${styles.tab} ${view === 'POSTING' ? styles.tabActive : ''}`} onClick={() => setView('POSTING')}>Posting & FIFO</button></nav>
    {error && <div className={styles.error}>{error}</div>}
    {loading ? <div className={styles.loading}>Memuat ledger...</div> : view === 'BALANCE' ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Produk</th><th>Batch</th><th className={styles.number}>On hand</th><th className={styles.number}>Reserved</th><th className={styles.number}>Quarantine</th><th className={styles.number}>Available</th></tr></thead><tbody>{balances.map((row) => <tr key={row.id}><td>{row.masterProduct?.sku}<br />{row.masterProduct?.name}</td><td>{row.batch?.batchNumber || '-'}</td><td className={styles.number}>{String(row.onHandQty)}</td><td className={styles.number}>{String(row.reservedQty)}</td><td className={styles.number}>{String(row.quarantineQty)}</td><td className={styles.number}>{String(row.availableQty)}</td></tr>)}</tbody></table></div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Nomor / Tanggal</th><th>Type</th><th>Source</th><th>Mutation</th><th>FIFO layer</th><th className={styles.number}>Actual cost</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{postings.map((posting) => <tr key={posting.id}><td>{posting.postingNumber}<br />{new Date(String(posting.occurredAt)).toLocaleString('id-ID')}</td><td>{posting.type}</td><td>{posting.sourceType}<br />{posting.sourceId}</td><td>{posting.stockMutations?.map((mutation: Row) => `${mutation.inventoryItem?.masterProduct?.name}: ${mutation.quantity}`).join(', ') || '-'}</td><td>{posting.costLayers?.map((layer: Row) => `${layer.batch?.batchNumber || 'NO_BATCH'}: ${layer.originalQty} → ${layer.remainingQty} @ ${layer.unitCost}`).join(', ') || '-'}</td><td className={styles.number}>{String(posting.totalCost)}</td><td><span className={posting.status === 'POSTED' ? styles.badge : styles.inactiveBadge}>{posting.status}</span></td><td>{canReverse && posting.type === 'ISSUE' && posting.status === 'POSTED' ? <button className={styles.secondaryButton} disabled={saving} onClick={() => void reverse(posting)} title="Reverse"><RotateCcw size={15} /></button> : '-'}</td></tr>)}</tbody></table></div>}
  </main>;
}
