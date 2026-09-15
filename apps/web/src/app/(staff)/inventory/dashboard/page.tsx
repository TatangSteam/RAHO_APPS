'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  PackageSearch,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import {
  InventoryValuation,
  LogisticsDashboard,
  StockCard,
  logisticsReportApi,
} from '@/lib/logisticsReportApi';
import { useAuthStore } from '@/stores/authStore';
import styles from './logistics-dashboard.module.css';

import type { InventoryLegacyRow as Row } from '@/types/inventoryLegacy';
type View = 'OVERVIEW' | 'STOCK_CARD' | 'VALUATION';
type ValuationTarget = {
  branchId: string; inventoryItemId: string; stockLocationId: string; batchId: string | null;
  batchLabel: string; sku: string; productName: string; baseUnit: string; quantityToValue: string;
  pendingLayerCount: number;
};
type SkuLookup = NonNullable<InventoryValuation['skuLookup']>;

const skuStatusTitle: Record<string, string> = {
  SKU_NOT_FOUND: 'SKU tidak ditemukan',
  SKU_INACTIVE: 'Produk tidak aktif',
  NOT_ASSIGNED_TO_BRANCH: 'Produk belum ada di cabang ini',
  NO_STOCK_LOCATION: 'Lokasi stok belum siap',
  NO_LEDGER_BALANCE: 'Stok perlu HPP',
  MIRROR_MISMATCH: 'Data stok perlu diperiksa',
  STOCK_IN_OTHER_LOCATION: 'Stok ada di lokasi lain',
  NO_STOCK: 'Stok belum tersedia',
  LAYER_MISMATCH: 'Data stok perlu diperiksa',
  NO_COST_LAYER: 'Stok perlu HPP',
  PENDING_VALUATION: 'Stok perlu HPP',
  NO_SALEABLE_HPP: 'Stok belum siap dijual',
  READY: 'Stok siap dijual',
};

const skuStatusHint = (lookup: SkuLookup) => {
  switch (lookup.status) {
    case 'SKU_NOT_FOUND': return 'Periksa SKU. Untuk add-on per dus, stok biasanya memakai SKU botol penyusunnya.';
    case 'SKU_INACTIVE': return 'Aktifkan produk master sebelum transaksi.';
    case 'NOT_ASSIGNED_TO_BRANCH': return 'Pilih cabang transaksi yang benar. Jika tetap tidak ada, minta Admin menambahkan produk ke cabang ini.';
    case 'NO_STOCK_LOCATION': return 'Minta Admin menyiapkan lokasi stok produk.';
    case 'NO_LEDGER_BALANCE': return 'Stok sudah tercatat. Isi HPP dari dokumen; jumlah stok tidak akan bertambah.';
    case 'MIRROR_MISMATCH': return 'Minta Admin mencocokkan data stok sebelum mengisi HPP. Jangan menambah stok untuk menutup selisih.';
    case 'STOCK_IN_OTHER_LOCATION': return 'Minta Admin memindahkan stok ke lokasi jual produk.';
    case 'NO_STOCK': return 'Jika barang memang ada, catat penerimaan atau stok awal yang benar.';
    case 'LAYER_MISMATCH': return 'Minta Admin mencocokkan data stok sebelum mengisi HPP.';
    case 'NO_COST_LAYER': return 'Stok sudah ada. Isi HPP dari dokumen; jumlah stok tidak akan bertambah.';
    case 'PENDING_VALUATION': return 'Klik Isi HPP pada produk di bawah. Gunakan harga pokok, bukan harga jual.';
    case 'NO_SALEABLE_HPP': return 'Minta Admin memeriksa stok tersedia, HPP, dan batch produk.';
    case 'READY': return 'Jika transaksi masih gagal, pastikan cabang dan jumlah stok yang dijual sudah benar.';
    default: return 'Periksa data inventori produk ini.';
  }
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const finiteNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : null;
};
const quantity = (value: unknown) => finiteNumber(value)?.toLocaleString('id-ID', { maximumFractionDigits: 4 }) ?? '-';
const currency = (value: unknown) => {
  const amount = finiteNumber(value);
  return amount === null ? 'Belum dinilai' : `Rp ${amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};
const valuedCost = (value: unknown) => value === null || value === undefined || finiteNumber(value) === null ? 'Belum ada' : currency(value);
const hasPendingLayer = (row: InventoryValuation['data'][number]) => row.costLayers.some((layer) =>
  layer.valuationStatus === 'PENDING_VALUATION' && layer.unitCost === null && Number(layer.remainingQty) > 0);
const hasMissingCostLayer = (row: InventoryValuation['data'][number]) => Number(row.onHandQty) > 0 && row.costLayers.length === 0;
const statusLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());

function Kpi({ label, value, note, icon }: { label: string; value: string; note?: string; icon: ReactNode }) {
  return <div className={styles.kpi}>
    <div className={styles.kpiIcon}>{icon}</div>
    <div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>
  </div>;
}

function StatusBreakdown({ title, total, values }: { title: string; total: number; values: Record<string, number> }) {
  const rows = Object.entries(values).sort((left, right) => right[1] - left[1]);
  return <section className={styles.statusPanel}>
    <header><h2>{title}</h2><strong>{total}</strong></header>
    <div className={styles.statusRows}>{rows.length === 0 ? <p className={styles.muted}>Belum ada transaksi</p> : rows.map(([status, count]) => <div className={styles.statusRow} key={status}>
      <div><span>{statusLabel(status)}</span><b>{count}</b></div>
      <div className={styles.statusTrack}><span style={{ width: `${total ? Math.max(4, count / total * 100) : 0}%` }} /></div>
    </div>)}</div>
  </section>;
}

export default function LogisticsDashboardPage() {
  const { user, activeBranchId } = useAuthStore();
  const [view, setView] = useState<View>('OVERVIEW');
  const [branches, setBranches] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [branchId, setBranchId] = useState(activeBranchId || user?.branchId || '');
  const [startDate, setStartDate] = useState(daysAgo(29));
  const [endDate, setEndDate] = useState(today());
  const [dashboard, setDashboard] = useState<LogisticsDashboard | null>(null);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [stockCard, setStockCard] = useState<StockCard | null>(null);
  const [stockItemId, setStockItemId] = useState('');
  const [stockPage, setStockPage] = useState(1);
  const [valuationPage, setValuationPage] = useState(1);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [valuationSearch, setValuationSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [valuationTarget, setValuationTarget] = useState<ValuationTarget | null>(null);
  const [unitCost, setUnitCost] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [valuationSaving, setValuationSaving] = useState(false);
  const [valuationError, setValuationError] = useState('');
  const valuationRequest = useRef<{ signature: string; key: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [error, setError] = useState('');

  const loadMain = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const branchResponse = await api.get('/branches', { params: { isActive: true, limit: 100 } });
      const branchRows = branchResponse.data?.data || [];
      setBranches(branchRows);
      const selectedBranch = branchId || branchRows[0]?.id || '';
      if (!branchId && selectedBranch) {
        setBranchId(selectedBranch);
        return;
      }
      if (!selectedBranch) return;
      const [itemResponse, dashboardResponse, valuationResponse] = await Promise.all([
        inventoryApi.getInventoryItems(selectedBranch),
        logisticsReportApi.dashboard({ branchId: selectedBranch, startDate, endDate }),
        logisticsReportApi.valuation({ branchId: selectedBranch, pendingOnly, search: appliedSearch || undefined, page: valuationPage, limit: 25 }),
      ]);
      const itemRows = itemResponse.data?.data?.items || itemResponse.data?.data || [];
      setItems(itemRows);
      setStockItemId((current) => itemRows.some((item: Row) => item.id === current) ? current : (itemRows[0]?.id || ''));
      setDashboard(dashboardResponse);
      setValuation(valuationResponse);
    } catch (requestError) {
      assertCaughtError(requestError);
      setError(requestError.response?.data?.error?.message || 'Dashboard logistik gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, branchId, endDate, pendingOnly, startDate, valuationPage]);

  const loadStockCard = useCallback(async () => {
    if (!branchId || !stockItemId) {
      setStockCard(null);
      return;
    }
    try {
      setCardLoading(true);
      setError('');
      setStockCard(await logisticsReportApi.stockCard({
        branchId,
        inventoryItemId: stockItemId,
        startDate,
        endDate,
        page: stockPage,
        limit: 25,
      }));
    } catch (requestError) {
      assertCaughtError(requestError);
      setError(requestError.response?.data?.error?.message || 'Stock card gagal dimuat.');
    } finally {
      setCardLoading(false);
    }
  }, [branchId, endDate, startDate, stockItemId, stockPage]);

  useEffect(() => { void loadMain(); }, [loadMain]);
  useEffect(() => { if (view === 'STOCK_CARD') void loadStockCard(); }, [loadStockCard, view]);
  useEffect(() => { setStockPage(1); }, [branchId, endDate, startDate, stockItemId]);
  useEffect(() => {
    if (valuation && valuationPage > Math.max(1, valuation.meta.totalPages)) {
      setValuationPage(Math.max(1, valuation.meta.totalPages));
    }
  }, [valuation, valuationPage]);
  useEffect(() => {
    if (!valuationTarget) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !valuationSaving) setValuationTarget(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [valuationTarget, valuationSaving]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(valuationSearch.trim());
      setValuationPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [valuationSearch]);

  const refresh = async () => {
    await loadMain();
    if (view === 'STOCK_CARD') await loadStockCard();
  };

  const openValuation = (target: ValuationTarget) => {
    valuationRequest.current = null;
    setValuationTarget(target);
    setUnitCost('');
    setDocumentReference('');
    setValuationError('');
  };

  const saveValuation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valuationTarget || valuationSaving) return;
    if (valuationTarget.branchId !== branchId) {
      setValuationError('Cabang berubah. Muat ulang laporan sebelum menilai stok.');
      return;
    }
    if (!/^\d+(?:\.\d{1,4})?$/.test(unitCost) || Number(unitCost) <= 0) {
      setValuationError('Isi HPP per unit lebih dari 0, maksimal 4 angka desimal.');
      return;
    }
    if (documentReference.trim().length < 3) {
      setValuationError('Isi nomor dokumen sumber HPP.');
      return;
    }
    try {
      setValuationSaving(true);
      setValuationError('');
      const signature = JSON.stringify([
        valuationTarget.inventoryItemId, valuationTarget.stockLocationId, valuationTarget.batchId,
        unitCost, documentReference.trim(),
      ]);
      if (valuationRequest.current?.signature !== signature) {
        valuationRequest.current = { signature, key: crypto.randomUUID() };
      }
      await inventoryApi.valueLegacyStock(valuationTarget.inventoryItemId, {
        idempotencyKey: valuationRequest.current.key,
        adjustment: 0,
        unitCost,
        valuationDocumentReference: documentReference.trim(),
        reasonCode: 'LEGACY_OPENING_VALUATION',
        notes: `HPP stok awal berdasarkan dokumen ${documentReference.trim()}`,
        stockLocationId: valuationTarget.stockLocationId,
        ...(valuationTarget.batchId ? { batchId: valuationTarget.batchId } : {}),
      });
      setValuationTarget(null);
      showToast.success(`HPP ${valuationTarget.sku} tersimpan tanpa mengubah jumlah stok.`);
      setValuationPage(1);
      if (valuationPage === 1) await loadMain();
    } catch (requestError) {
      assertCaughtError(requestError);
      setValuationError(requestError.response?.data?.error?.message || 'Valuasi gagal disimpan. Periksa stok dan dokumen, lalu coba lagi.');
    } finally {
      setValuationSaving(false);
    }
  };

  const rowTarget = (row: InventoryValuation['data'][number]): ValuationTarget => ({
    branchId: row.branch.id,
    inventoryItemId: row.inventoryItemId,
    stockLocationId: row.stockLocation.id,
    batchId: row.batch?.id || null,
    batchLabel: row.batch?.batchNumber || 'Tanpa batch',
    sku: row.masterProduct.sku,
    productName: row.masterProduct.name,
    baseUnit: row.masterProduct.baseUnit || row.masterProduct.unit,
    quantityToValue: hasMissingCostLayer(row) ? row.onHandQty : row.pendingValuationQty,
    pendingLayerCount: row.costLayers.filter((layer) => layer.valuationStatus === 'PENDING_VALUATION' && layer.unitCost === null).length,
  });

  const skuLookup = valuation?.skuLookup;
  const rowStatus = (row: InventoryValuation['data'][number]) => {
    if (!row.quantityReconciled && !hasMissingCostLayer(row)) return 'Periksa data stok';
    if (hasPendingLayer(row) || hasMissingCostLayer(row)) return 'Perlu HPP';
    if (Number(row.pendingValuationQty) > 0) return 'Periksa data stok';
    return 'Sudah ada HPP';
  };
  const valueAction = (row: InventoryValuation['data'][number]): ReactNode => {
    const searchedItem = !!appliedSearch && skuLookup?.inventoryItemId === row.inventoryItemId;
    if (searchedItem && skuLookup?.status === 'STOCK_IN_OTHER_LOCATION') return <span>Periksa lokasi stok</span>;
    if (searchedItem && ['MIRROR_MISMATCH', 'LAYER_MISMATCH'].includes(skuLookup?.status || '')) return <span>Periksa data stok</span>;
    if (searchedItem && skuLookup?.status === 'NO_COST_LAYER' && !skuLookup.canValue) return <span>Hubungi Super Admin</span>;
    if (hasPendingLayer(row) || hasMissingCostLayer(row)) {
      if (row.masterProduct.tracksBatch && !row.batch) return <span>Batch diperlukan</span>;
      if (user?.role !== 'SUPER_ADMIN') return <span>Hubungi Super Admin</span>;
      const needsReconciliation = !row.quantityReconciled && !hasMissingCostLayer(row);
      return <button className={styles.valueButton} type="button" onClick={() => openValuation(rowTarget(row))} disabled={needsReconciliation || loading} title={needsReconciliation ? 'Perbaiki selisih stok sebelum valuasi' : 'Isi HPP stok lama'}>Isi HPP</button>;
    }
    return Number(row.pendingValuationQty) > 0 ? <span>Periksa data stok</span> : <span>-</span>;
  };

  const openLookupValuation = () => {
    if (!skuLookup?.canValue || !skuLookup.inventoryItemId || !skuLookup.stockLocationId) return;
    openValuation({
      branchId,
      inventoryItemId: skuLookup.inventoryItemId,
      stockLocationId: skuLookup.stockLocationId,
      batchId: skuLookup.valuationBatchId,
      batchLabel: skuLookup.valuationBatchNumber || 'Tanpa batch',
      sku: skuLookup.sku,
      productName: skuLookup.productName || skuLookup.sku,
      baseUnit: skuLookup.baseUnit || 'unit',
      quantityToValue: skuLookup.status === 'NO_LEDGER_BALANCE' ? skuLookup.mirrorQty : skuLookup.missingLayerQty,
      pendingLayerCount: 0,
    });
  };

  const chartData = useMemo(() => dashboard?.movements.trend.map((row) => ({
    ...row,
    label: new Date(`${row.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    inboundQty: Number(row.inboundQty),
    outboundQty: Number(row.outboundQty),
  })) || [], [dashboard]);

  const dashboardPendingValuationQty = Number(dashboard?.valuation.pendingValuationQty || 0);
  const dashboardLayerMismatchCount = Number(dashboard?.valuation.layerMismatchCount || 0);
  const dashboardValuationComplete = dashboardPendingValuationQty === 0 && dashboardLayerMismatchCount === 0;
  const valuationPendingQty = Number(valuation?.summary.pendingValuationQty || 0) + Number(valuation?.summary.missingCostLayerQty || 0);
  const valuationMismatchCount = dashboardLayerMismatchCount;
  const valuationComplete = valuationPendingQty === 0 && valuationMismatchCount === 0;

  return <main className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>Dashboard Logistik</h1><span>{dashboard ? `${dashboard.filter.startDate} - ${dashboard.filter.endDate}` : 'Inventory reporting'}</span></div>
      <button className={styles.iconButton} onClick={() => void refresh()} disabled={loading || cardLoading} title="Muat ulang"><RefreshCw size={18} /></button>
    </header>

    <section className={styles.filters} aria-label="Filter laporan">
      <label><span>Cabang</span><select value={branchId} onChange={(event) => { setBranchId(event.target.value); setValuationPage(1); setValuationTarget(null); }}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label>
      <label><span>Dari</span><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Sampai</span><input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <div className={styles.snapshot}><span>Data nilai stok diperbarui</span><strong>{valuation ? new Date(valuation.generatedAt).toLocaleString('id-ID') : '-'}</strong></div>
    </section>

    <nav className={styles.tabs} aria-label="Tampilan laporan">
      <button className={view === 'OVERVIEW' ? styles.activeTab : ''} onClick={() => setView('OVERVIEW')}><Boxes size={16} /> Ringkasan</button>
      <button className={view === 'STOCK_CARD' ? styles.activeTab : ''} onClick={() => setView('STOCK_CARD')}><PackageSearch size={16} /> Stock Card</button>
      <button className={view === 'VALUATION' ? styles.activeTab : ''} onClick={() => setView('VALUATION')}><CircleDollarSign size={16} /> Nilai Stok</button>
    </nav>

    {error && <div className={styles.error}>{error}</div>}
    {loading && !dashboard ? <div className={styles.loading}>Memuat laporan...</div> : null}

    {view === 'OVERVIEW' && dashboard && <>
      {!dashboardValuationComplete && <div className={styles.valuationNotice} role="status">
        <AlertTriangle size={18} />
        <div><strong>Nilai inventory belum lengkap.</strong><span>{dashboardPendingValuationQty > 0 && <> {quantity(dashboardPendingValuationQty)} unit masih menunggu HPP.</>}{dashboardLayerMismatchCount > 0 && <> {dashboardLayerMismatchCount.toLocaleString('id-ID')} saldo memiliki selisih jumlah atau cost layer.</>} Buka tab Nilai Stok sebelum memakai nilai aset untuk laporan keuangan.</span></div>
      </div>}
      <section className={styles.kpiGrid}>
        <Kpi label="Nilai aset inventory" value={dashboardValuationComplete ? currency(dashboard.valuation.totalAssetValue) : 'Belum lengkap'} note={`${currency(dashboard.valuation.totalAssetValue)} sudah terhitung · In-transit ${currency(dashboard.valuation.inTransitValue)}`} icon={<CircleDollarSign size={19} />} />
        <Kpi label="On hand" value={quantity(dashboard.stockSnapshot.onHandQty)} note={`Available ${quantity(dashboard.stockSnapshot.availableQty)}`} icon={<Boxes size={19} />} />
        <Kpi label="Reserved" value={quantity(dashboard.stockSnapshot.reservedQty)} note="Tidak mengubah nilai aset" icon={<ClipboardCheck size={19} />} />
        <Kpi label="Material usage" value={currency(dashboard.usage.actualCost)} note={`${dashboard.usage.usageLines} baris konsumsi`} icon={<ArrowUpFromLine size={19} />} />
        <Kpi label="Shipment" value={String(dashboard.shipments.total)} note={`${quantity(dashboard.shipments.receivedQty)} diterima`} icon={<Truck size={19} />} />
        <Kpi label="Discrepancy terbuka" value={String(dashboard.discrepancies.open)} note={`${quantity(dashboard.discrepancies.quarantineQty)} quarantine`} icon={<AlertTriangle size={19} />} />
      </section>

      <section className={styles.alertBand}>
        <div><AlertTriangle size={17} /><span>Low stock</span><strong>{dashboard.stockSnapshot.lowStockItems}</strong></div>
        <div><Boxes size={17} /><span>Stock kosong</span><strong>{dashboard.stockSnapshot.outOfStockItems}</strong></div>
        <div><ClipboardCheck size={17} /><span>Batch expiry 30 hari</span><strong>{dashboard.stockSnapshot.expiringBatchCount}</strong></div>
        <div className={dashboardPendingValuationQty ? styles.alertDanger : styles.alertOk}>{dashboardPendingValuationQty ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>Pending valuation</span><strong>{quantity(dashboardPendingValuationQty)}</strong></div>
        <div className={dashboardLayerMismatchCount ? styles.alertDanger : styles.alertOk}>{dashboardLayerMismatchCount ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>Mismatch quantity/layer</span><strong>{dashboardLayerMismatchCount}</strong></div>
      </section>

      <section className={styles.reportGrid}>
        <div className={styles.chartPanel}>
          <header><div><h2>Arus Persediaan</h2><span>{dashboard.movements.postingCount} posting</span></div><div className={styles.flowTotals}><span><ArrowDownToLine size={14} /> Inbound</span><span><ArrowUpFromLine size={14} /> Outbound</span></div></header>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => quantity(value)} />
                <Legend />
                <Line type="monotone" dataKey="inboundQty" name="Inbound" stroke="#167a62" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outboundQty" name="Outbound" stroke="#c85b39" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={styles.shipmentPanel}>
          <header><h2>Shipment Metrics</h2></header>
          <dl>
            <div><dt>Quantity dikirim</dt><dd>{quantity(dashboard.shipments.sentQty)}</dd></div>
            <div><dt>Quantity diterima</dt><dd>{quantity(dashboard.shipments.receivedQty)}</dd></div>
            <div><dt>Quantity quarantine</dt><dd>{quantity(dashboard.shipments.quarantineQty)}</dd></div>
            <div><dt>Rata-rata lead time</dt><dd>{dashboard.shipments.averageLeadTimeHours === null ? '-' : `${quantity(dashboard.shipments.averageLeadTimeHours)} jam`}</dd></div>
            <div><dt>Selisih opname</dt><dd>{quantity(dashboard.opnames.absoluteDifferenceQty)}</dd></div>
            <div><dt>Nilai selisih opname</dt><dd>{currency(dashboard.opnames.differenceValue)}</dd></div>
          </dl>
        </div>
      </section>

      <section className={styles.statusGrid}>
        <StatusBreakdown title="Stock Request" total={dashboard.requests.total} values={dashboard.requests.byStatus} />
        <StatusBreakdown title="Shipment" total={dashboard.shipments.total} values={dashboard.shipments.byStatus} />
        <StatusBreakdown title="Stock Opname" total={dashboard.opnames.total} values={dashboard.opnames.byStatus} />
      </section>

      <section className={styles.tableSection}>
        <header><h2>Top Material Usage</h2><span>{currency(dashboard.usage.actualCost)}</span></header>
        <div className={styles.tableWrap}><table><thead><tr><th>Produk</th><th className={styles.number}>Quantity</th><th className={styles.number}>Baris usage</th><th className={styles.number}>Actual cost</th></tr></thead><tbody>
          {dashboard.usage.topProducts.length ? dashboard.usage.topProducts.map((row) => <tr key={row.masterProductId}><td><strong>{row.sku}</strong><span>{row.productName}</span></td><td className={styles.number}>{quantity(row.quantity)}</td><td className={styles.number}>{row.usageLines}</td><td className={styles.number}>{currency(row.actualCost)}</td></tr>) : <tr><td colSpan={4} className={styles.empty}>Belum ada material usage</td></tr>}
        </tbody></table></div>
      </section>
    </>}

    {view === 'STOCK_CARD' && <section className={styles.viewSection}>
      <div className={styles.viewToolbar}><label><span>Inventory item</span><select value={stockItemId} onChange={(event) => setStockItemId(event.target.value)}><option value="">Pilih item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || item.sku || item.masterProductId} - {item.masterProduct?.name || item.name}</option>)}</select></label></div>
      {cardLoading ? <div className={styles.loading}>Memuat stock card...</div> : stockCard ? <>
        <section className={styles.stockSummary}>
          <div><span>Saldo awal</span><strong>{quantity(stockCard.summary.openingQty)}</strong></div>
          <div className={styles.inbound}><span>Total masuk</span><strong>{quantity(stockCard.summary.totalInQty)}</strong></div>
          <div className={styles.outbound}><span>Total keluar</span><strong>{quantity(stockCard.summary.totalOutQty)}</strong></div>
          <div><span>Saldo akhir</span><strong>{quantity(stockCard.summary.closingQty)}</strong></div>
          <div><span>Actual cost</span><strong>{currency(stockCard.summary.actualCost)}</strong></div>
        </section>
        <div className={styles.tableWrap}><table><thead><tr><th>Tanggal / Posting</th><th>Referensi</th><th>Batch</th><th className={styles.number}>Masuk</th><th className={styles.number}>Keluar</th><th className={styles.number}>Saldo</th><th className={styles.number}>Actual cost</th></tr></thead><tbody>
          {stockCard.data.length ? stockCard.data.map((row) => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleString('id-ID')}<span>{row.inventoryPosting?.postingNumber || row.type}</span></td><td>{row.inventoryPosting?.sourceNumber || row.referenceId || '-'}<span>{row.inventoryPosting?.sourceType || row.referenceType || '-'}</span></td><td>{row.batch?.batchNumber || 'Tanpa batch'}</td><td className={`${styles.number} ${styles.inboundText}`}>{Number(row.inboundQty) ? quantity(row.inboundQty) : '-'}</td><td className={`${styles.number} ${styles.outboundText}`}>{Number(row.outboundQty) ? quantity(row.outboundQty) : '-'}</td><td className={styles.number}><strong>{quantity(row.runningQty)}</strong></td><td className={styles.number}>{currency(row.actualCost)}</td></tr>) : <tr><td colSpan={7} className={styles.empty}>Tidak ada mutasi pada periode ini</td></tr>}
        </tbody></table></div>
        <footer className={styles.pagination}><span>{stockCard.meta.total} mutasi</span><div><button className={styles.iconButton} disabled={stockPage <= 1} onClick={() => setStockPage((page) => page - 1)} title="Halaman sebelumnya"><ArrowLeft size={17} /></button><strong>{stockPage} / {Math.max(1, stockCard.meta.totalPages)}</strong><button className={styles.iconButton} disabled={stockPage >= stockCard.meta.totalPages} onClick={() => setStockPage((page) => page + 1)} title="Halaman berikutnya"><ArrowRight size={17} /></button></div></footer>
      </> : <div className={styles.empty}>Pilih inventory item</div>}
    </section>}

    {view === 'VALUATION' && valuation && <section className={styles.viewSection}>
      {!valuationComplete && <div className={styles.valuationNotice} role="status">
        <AlertTriangle size={18} />
        <div><strong>Ada stok yang belum siap dinilai.</strong><span>{valuationPendingQty > 0 && <> {quantity(valuationPendingQty)} unit perlu HPP.</>}{valuationMismatchCount > 0 && <> {valuationMismatchCount.toLocaleString('id-ID')} data stok perlu diperiksa.</>}</span></div>
      </div>}
      <section className={`${styles.stockSummary} ${styles.valuationSummary}`}>
        <div className={valuationPendingQty ? styles.outbound : ''}><span>Stok perlu HPP</span><strong>{quantity(valuationPendingQty)}</strong></div>
        <div><span>Total nilai persediaan</span><strong>{valuationComplete ? currency(valuation.summary.totalAssetValue) : 'Belum lengkap'}</strong></div>
      </section>
      <div className={styles.valuationToolbar}>
        <div><strong>Isi harga pokok (HPP)</strong><span>Pilih cabang, cari produk, lalu isi HPP dari dokumen. Stok tidak bertambah.</span></div>
        <div className={styles.valuationFilters}>
          <button type="button" className={pendingOnly ? styles.selectedFilter : ''} onClick={() => { setPendingOnly(true); setValuationPage(1); }} disabled={loading}>Belum dinilai</button>
          <button type="button" className={!pendingOnly ? styles.selectedFilter : ''} onClick={() => { setPendingOnly(false); setValuationPage(1); }} disabled={loading}>Semua stok</button>
        </div>
      </div>
      <form className={styles.valuationSearch} onSubmit={(event) => { event.preventDefault(); setAppliedSearch(valuationSearch.trim()); setValuationPage(1); }}>
        <label htmlFor="valuation-search">Cari produk</label>
        <input id="valuation-search" placeholder="Nama atau SKU" value={valuationSearch} onChange={(event) => setValuationSearch(event.target.value)} />
        <button type="submit" disabled={loading}>Cari</button>
        {appliedSearch && <button type="button" onClick={() => { setValuationSearch(''); setAppliedSearch(''); setValuationPage(1); }} disabled={loading}>Hapus</button>}
      </form>
      {skuLookup && <section className={styles.skuDiagnosis} role="status" aria-label={`Diagnosis SKU ${skuLookup.sku}`}>
        <div><strong>{skuStatusTitle[skuLookup.status] || 'Status stok'}: {skuLookup.sku}</strong><p>{skuStatusHint(skuLookup)}</p></div>
        {skuLookup.inventoryItemId && <div className={styles.skuDiagnosisFacts}><span>Stok tercatat: {quantity(skuLookup.mirrorQty)}</span><span>Siap jual: {quantity(skuLookup.readyQty)}</span></div>}
        {skuLookup.canValue && user?.role === 'SUPER_ADMIN' && !valuation.data.some((row) => row.inventoryItemId === skuLookup.inventoryItemId) && <button className={styles.valueButton} type="button" onClick={openLookupValuation} disabled={loading}>Isi HPP</button>}
      </section>}
      <div className={styles.mobileValuationList}>
        {valuation.data.length ? valuation.data.map((row) => <article key={row.id}>
          <strong>{row.masterProduct.sku}</strong><span>{row.masterProduct.name}</span>
          <div><span>Stok: {quantity(row.onHandQty)} {row.masterProduct.baseUnit || row.masterProduct.unit}</span><span>{rowStatus(row)}</span></div>
          <div><span>HPP: {valuedCost(row.averageUnitCost)}</span>{row.batch && <span>Batch: {row.batch.batchNumber}</span>}</div>
          <footer>{valueAction(row)}</footer>
        </article>) : <p>{appliedSearch ? 'Tidak ada stok pada daftar ini. Lihat status SKU di atas atau pilih Semua stok.' : pendingOnly ? 'Tidak ada stok yang perlu HPP.' : 'Belum ada stok.'}</p>}
      </div>
      <div className={`${styles.tableWrap} ${styles.valuationTable}`}><table><thead><tr><th>Produk</th><th className={styles.number}>Stok</th><th className={styles.number}>HPP rata-rata</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {valuation.data.length ? valuation.data.map((row) => <tr key={row.id}>
          <td><strong>{row.masterProduct.sku}</strong><span>{row.masterProduct.name}{row.batch ? ` · Batch ${row.batch.batchNumber}` : ''}</span></td>
          <td className={styles.number}>{quantity(row.onHandQty)}</td>
          <td className={styles.number}>{valuedCost(row.averageUnitCost)}</td>
          <td>{rowStatus(row)}</td>
          <td>{valueAction(row)}</td>
        </tr>) : <tr><td colSpan={5} className={styles.empty}>{appliedSearch ? 'Tidak ada stok pada daftar ini. Lihat status SKU di atas atau pilih Semua stok.' : pendingOnly ? 'Tidak ada stok yang perlu HPP.' : 'Belum ada stok.'}</td></tr>}
      </tbody></table></div>
      <footer className={styles.pagination}><span>{valuation.meta.total} baris {pendingOnly ? 'belum dinilai' : 'stok'}</span><div><button className={styles.iconButton} disabled={loading || valuationPage <= 1} onClick={() => setValuationPage((page) => page - 1)} title="Halaman sebelumnya"><ArrowLeft size={17} /></button><strong>{valuationPage} / {Math.max(1, valuation.meta.totalPages)}</strong><button className={styles.iconButton} disabled={loading || valuationPage >= valuation.meta.totalPages} onClick={() => setValuationPage((page) => page + 1)} title="Halaman berikutnya"><ArrowRight size={17} /></button></div></footer>
    </section>}
    {valuationTarget && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !valuationSaving) setValuationTarget(null); }}>
      <section className={styles.valuationModal} role="dialog" aria-modal="true" aria-labelledby="valuation-modal-title">
        <form onSubmit={(event) => void saveValuation(event)}>
          <header><h2 id="valuation-modal-title">Isi HPP stok lama</h2><p>{valuationTarget.sku} — {valuationTarget.productName}</p></header>
          <div className={styles.modalBody}>
            <div className={styles.valuationFacts}><span>Stok perlu HPP: <strong>{quantity(valuationTarget.quantityToValue)} {valuationTarget.baseUnit}</strong></span><span>Batch: <strong>{valuationTarget.batchLabel}</strong></span></div>
            <label><span>HPP per {valuationTarget.baseUnit}</span><input autoFocus required inputMode="decimal" placeholder="Contoh: 15000" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} disabled={valuationSaving} /></label>
            <label><span>Nomor invoice / PO / dokumen saldo awal</span><input required minLength={3} maxLength={160} placeholder="Contoh: OPENING-2026-001" value={documentReference} onChange={(event) => setDocumentReference(event.target.value)} disabled={valuationSaving} /></label>
            <p className={styles.valuationPreview}>Nilai stok yang akan dicatat: <strong>{unitCost && finiteNumber(unitCost) !== null ? currency(Number(unitCost) * Number(valuationTarget.quantityToValue)) : '-'}</strong></p>
            <p className={styles.valuationHelp}>Jumlah stok tidak berubah. Gunakan HPP dari dokumen, bukan harga jual.{valuationTarget.pendingLayerCount > 1 && ' HPP ini akan berlaku untuk beberapa stok masuk; pastikan harga pokoknya sama.'}</p>
            {valuationError && <p className={styles.modalError} role="alert">{valuationError}</p>}
          </div>
          <footer><button type="button" onClick={() => setValuationTarget(null)} disabled={valuationSaving}>Batal</button><button type="submit" disabled={valuationSaving}>{valuationSaving ? 'Menyimpan...' : 'Simpan HPP'}</button></footer>
        </form>
      </section>
    </div>}
  </main>;
}
