'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, PackageCheck, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  GoodsReceiptCondition,
  inventoryApi,
  PurchaseOrderInventory,
} from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import styles from '../operations.module.css';

type Row = Record<string, any>;

type ReceiptLineForm = {
  purchaseOrderItemId: string;
  quantity: string;
  condition: GoodsReceiptCondition;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  notes: string;
};

const conditionLabels: Record<GoodsReceiptCondition, string> = {
  GOOD: 'Baik',
  DAMAGED: 'Rusak',
  EXPIRED: 'Expired',
  OTHER: 'Lainnya',
};

function newIdempotencyKey() {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  return `GOODS-RECEIPT:${value}`;
}

function formatQuantity(value: unknown) {
  return Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });
}

function formatMoney(value: unknown, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function GoodsReceiptsPage() {
  const { user, activeBranchId } = useAuthStore();
  const [branchId, setBranchId] = useState(activeBranchId || user?.branchId || '');
  const [branches, setBranches] = useState<Row[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderInventory[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderInventory | null>(null);
  const [lines, setLines] = useState<ReceiptLineForm[]>([]);
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [view, setView] = useState<'OPEN_PO' | 'RECEIPTS'>('OPEN_PO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canPost = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'].includes(user?.role || '');

  const load = useCallback(async () => {
    if (!branchId) {
      try {
        const branchResponse = await api.get('/branches', { params: { isActive: true, limit: 100 } });
        const rows = branchResponse.data?.data || [];
        setBranches(rows);
        if (rows[0]?.id) setBranchId(rows[0].id);
      } catch {
        setError('Gagal memuat cabang.');
      }
      return;
    }
    try {
      setLoading(true);
      setError('');
      const [branchResponse, poResponse, receiptResponse] = await Promise.all([
        api.get('/branches', { params: { isActive: true, limit: 100 } }),
        inventoryApi.getPurchaseOrdersForReceipt({ branchId, limit: 100 }),
        inventoryApi.getGoodsReceipts({ branchId, limit: 100 }),
      ]);
      setBranches(branchResponse.data?.data || []);
      setPurchaseOrders((poResponse.data?.data?.data || []).filter(
        (po: PurchaseOrderInventory) => po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED',
      ));
      setReceipts(receiptResponse.data?.data?.data || []);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Gagal memuat Goods Receipt.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { void load(); }, [load]);

  const openPurchaseOrder = (purchaseOrder: PurchaseOrderInventory) => {
    setSelectedPo(purchaseOrder);
    setLines(purchaseOrder.items
      .filter((item) => Number(item.remainingQty) > 0)
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantity: '',
        condition: 'GOOD',
        batchNumber: '',
        manufactureDate: '',
        expiryDate: '',
        notes: '',
      })));
  };

  const closePurchaseOrder = () => {
    setSelectedPo(null);
    setLines([]);
    setDeliveryNumber('');
    setNotes('');
  };

  const updateLine = (index: number, patch: Partial<ReceiptLineForm>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPo) return;
    const submittedLines = lines.filter((line) => Number(line.quantity) > 0);
    if (submittedLines.length === 0) {
      showToast.error('Isi minimal satu quantity penerimaan.');
      return;
    }
    try {
      setSaving(true);
      await inventoryApi.postGoodsReceipt(selectedPo.id, {
        idempotencyKey: newIdempotencyKey(),
        receivedAt: new Date(`${receivedAt}T12:00:00`).toISOString(),
        supplierDeliveryNumber: deliveryNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: submittedLines.map((line) => {
          const orderItem = selectedPo.items.find((item) => item.id === line.purchaseOrderItemId)!;
          return {
            purchaseOrderItemId: line.purchaseOrderItemId,
            quantity: line.quantity,
            condition: line.condition,
            ...(orderItem.masterProduct.tracksBatch ? {
              batch: {
                batchNumber: line.batchNumber,
                manufactureDate: line.manufactureDate || undefined,
                expiryDate: line.expiryDate || undefined,
              },
            } : {}),
            notes: line.notes.trim() || undefined,
          };
        }),
      });
      showToast.success('Goods Receipt berhasil diposting.');
      closePurchaseOrder();
      await load();
      setView('RECEIPTS');
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Goods Receipt gagal diposting.');
    } finally {
      setSaving(false);
    }
  };

  const receiptSummary = useMemo(() => receipts.reduce((summary, receipt) => ({
    quantity: summary.quantity + Number(receipt.totalQuantity || 0),
    quarantine: summary.quarantine + Number(receipt.quarantinedQuantity || 0),
    value: summary.value + Number(receipt.totalCost || 0),
  }), { quantity: 0, quarantine: 0, value: 0 }), [receipts]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1>Goods Receipt</h1><p>Penerimaan per PO, batch, expiry, dan kondisi. Scope stok mengikuti cabang PO secara otomatis.</p></div>
      <button className={styles.secondaryButton} type="button" onClick={() => void load()} title="Muat ulang"><RefreshCw size={16} /></button>
    </header>

    <div className={styles.toolbar}>
      <label className={styles.field}><span>Cabang</span><select className={styles.select} value={branchId} onChange={(event) => { setBranchId(event.target.value); closePurchaseOrder(); }}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label>
    </div>

    <div className={styles.summary}>
      <div className={styles.summaryItem}><span>PO terbuka</span><strong>{purchaseOrders.length}</strong></div>
      <div className={styles.summaryItem}><span>Receipt</span><strong>{receipts.length}</strong></div>
      <div className={styles.summaryItem}><span>Quantity diterima</span><strong>{formatQuantity(receiptSummary.quantity)}</strong></div>
      <div className={styles.summaryItem}><span>Nilai diterima</span><strong>{formatMoney(receiptSummary.value)}</strong></div>
    </div>

    <nav className={styles.tabs}>
      <button className={`${styles.tab} ${view === 'OPEN_PO' ? styles.tabActive : ''}`} onClick={() => setView('OPEN_PO')}><ClipboardCheck size={15} /> PO Terbuka</button>
      <button className={`${styles.tab} ${view === 'RECEIPTS' ? styles.tabActive : ''}`} onClick={() => setView('RECEIPTS')}><PackageCheck size={15} /> Riwayat Receipt</button>
    </nav>

    {error && <div className={styles.error}>{error}</div>}
    {loading ? <div className={styles.loading}>Memuat Goods Receipt...</div> : view === 'OPEN_PO' ? <>
      {selectedPo && <form className={styles.section} onSubmit={submit}>
        <div className={styles.sectionHeader}><div><h2>{selectedPo.poNumber}</h2><span>{selectedPo.supplier.name} / {selectedPo.currency}</span></div><button className={styles.secondaryButton} type="button" onClick={closePurchaseOrder} title="Tutup"><X size={16} /></button></div>
        <div className={styles.form}>
          <label className={styles.field}><span>Tanggal terima</span><input className={styles.input} type="date" required value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></label>
          <label className={styles.field}><span>Surat jalan supplier</span><input className={styles.input} value={deliveryNumber} onChange={(event) => setDeliveryNumber(event.target.value)} /></label>
          <label className={styles.field}><span>Catatan receipt</span><input className={styles.input} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className={styles.field}><span>Scope stok</span><strong>{selectedPo.branch?.name || 'Cabang PO'}</strong></div>
        </div>
        <div className={styles.lineGrid}>{lines.map((line, index) => {
          const item = selectedPo.items.find((candidate) => candidate.id === line.purchaseOrderItemId)!;
          return <div className={styles.goodsReceiptLine} key={line.purchaseOrderItemId}>
            <div><strong>{item.masterProduct.sku || '-'}</strong><span>{item.masterProduct.name}</span><span>Sisa {formatQuantity(item.remainingQty)} / {formatMoney(item.unitCost, selectedPo.currency)}</span></div>
            <label className={styles.field}><span>Quantity</span><input className={styles.input} inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /></label>
            {item.masterProduct.tracksBatch && <label className={styles.field}><span>Batch</span><input className={styles.input} required={Number(line.quantity) > 0} value={line.batchNumber} onChange={(event) => updateLine(index, { batchNumber: event.target.value })} /></label>}
            {item.masterProduct.tracksBatch && <label className={styles.field}><span>Manufacture</span><input className={styles.input} type="date" value={line.manufactureDate} onChange={(event) => updateLine(index, { manufactureDate: event.target.value })} /></label>}
            {item.masterProduct.tracksExpiry && <label className={styles.field}><span>Expiry</span><input className={styles.input} required={Number(line.quantity) > 0} type="date" value={line.expiryDate} onChange={(event) => updateLine(index, { expiryDate: event.target.value })} /></label>}
            <label className={styles.field}><span>Kondisi</span><select className={styles.select} value={line.condition} onChange={(event) => updateLine(index, { condition: event.target.value as GoodsReceiptCondition })}>{Object.entries(conditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={styles.field}><span>Catatan kondisi</span><input className={styles.input} required={line.condition !== 'GOOD' && Number(line.quantity) > 0} value={line.notes} onChange={(event) => updateLine(index, { notes: event.target.value })} /></label>
          </div>;
        })}</div>
        <div className={styles.actions}>{lines.some((line) => line.condition !== 'GOOD' && Number(line.quantity) > 0) && <span className={styles.warningBadge}><AlertTriangle size={13} /> Masuk quarantine</span>}<button className={styles.button} disabled={saving || !canPost}><PackageCheck size={16} /> Posting Goods Receipt</button></div>
      </form>}
      <div className={styles.requestList}>{purchaseOrders.length === 0 ? <div className={styles.empty}>Tidak ada PO yang dapat diterima.</div> : purchaseOrders.map((purchaseOrder) => <article className={styles.requestCard} key={purchaseOrder.id}><div className={styles.requestHeader}><div><strong>{purchaseOrder.poNumber}</strong><span>{purchaseOrder.supplier.supplierCode} / {purchaseOrder.supplier.name}</span><span>{new Date(purchaseOrder.orderDate).toLocaleDateString('id-ID')}</span></div><div className={styles.actions}><span className={purchaseOrder.status === 'ISSUED' ? styles.badge : styles.warningBadge}>{purchaseOrder.status}</span>{canPost && <button className={styles.secondaryButton} type="button" onClick={() => openPurchaseOrder(purchaseOrder)}><PackageCheck size={15} /> Terima</button>}</div></div><div className={styles.lineGrid}>{purchaseOrder.items.filter((item) => Number(item.remainingQty) > 0).map((item) => <div className={styles.lineRow} key={item.id}><div><strong>{item.masterProduct.sku || '-'}</strong><span>{item.masterProduct.name}</span></div><div><span>Ordered / Received</span><strong>{formatQuantity(item.orderedQty)} / {formatQuantity(item.receivedQty)}</strong></div><div><span>Sisa</span><strong>{formatQuantity(item.remainingQty)}</strong></div><div className={styles.number}>{formatMoney(item.unitCost, purchaseOrder.currency)}</div></div>)}</div></article>)}</div>
    </> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Receipt / Tanggal</th><th>PO / Supplier</th><th>Posting</th><th className={styles.number}>Quantity</th><th className={styles.number}>Quarantine</th><th className={styles.number}>Nilai</th><th>Status</th></tr></thead><tbody>{receipts.length === 0 ? <tr><td colSpan={7} className={styles.empty}>Belum ada Goods Receipt.</td></tr> : receipts.map((receipt) => <tr key={receipt.id}><td>{receipt.receiptNumber}<br />{new Date(receipt.receivedAt).toLocaleString('id-ID')}</td><td>{receipt.purchaseOrder?.poNumber}<br />{receipt.purchaseOrder?.supplier?.name}</td><td>{receipt.inventoryPosting?.postingNumber}</td><td className={styles.number}>{formatQuantity(receipt.totalQuantity)}</td><td className={styles.number}>{formatQuantity(receipt.quarantinedQuantity)}</td><td className={styles.number}>{formatMoney(receipt.totalCost, receipt.purchaseOrder?.currency)}</td><td><span className={styles.badge}>{receipt.status}</span></td></tr>)}</tbody></table></div>}
  </main>;
}
