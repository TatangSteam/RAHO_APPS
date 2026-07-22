'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  InventoryValuation,
  LogisticsDashboard,
  StockCard,
  logisticsReportApi,
} from '@/lib/logisticsReportApi';
import { useAuthStore } from '@/stores/authStore';
import styles from './logistics-dashboard.module.css';

type Row = Record<string, any>;
type View = 'OVERVIEW' | 'STOCK_CARD' | 'VALUATION';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const quantity = (value: unknown) => Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });
const currency = (value: unknown) => `Rp ${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
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
        logisticsReportApi.valuation({ branchId: selectedBranch, limit: 100 }),
      ]);
      const itemRows = itemResponse.data?.data?.items || itemResponse.data?.data || [];
      setItems(itemRows);
      setStockItemId((current) => itemRows.some((item: Row) => item.id === current) ? current : (itemRows[0]?.id || ''));
      setDashboard(dashboardResponse);
      setValuation(valuationResponse);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Dashboard logistik gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [branchId, endDate, startDate]);

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
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Stock card gagal dimuat.');
    } finally {
      setCardLoading(false);
    }
  }, [branchId, endDate, startDate, stockItemId, stockPage]);

  useEffect(() => { void loadMain(); }, [loadMain]);
  useEffect(() => { if (view === 'STOCK_CARD') void loadStockCard(); }, [loadStockCard, view]);
  useEffect(() => { setStockPage(1); }, [branchId, endDate, startDate, stockItemId]);

  const refresh = async () => {
    await loadMain();
    if (view === 'STOCK_CARD') await loadStockCard();
  };

  const chartData = useMemo(() => dashboard?.movements.trend.map((row) => ({
    ...row,
    label: new Date(`${row.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    inboundQty: Number(row.inboundQty),
    outboundQty: Number(row.outboundQty),
  })) || [], [dashboard]);

  return <main className={styles.page}>
    <header className={styles.pageHeader}>
      <div><h1>Dashboard Logistik</h1><span>{dashboard ? `${dashboard.filter.startDate} - ${dashboard.filter.endDate}` : 'Inventory reporting'}</span></div>
      <button className={styles.iconButton} onClick={() => void refresh()} disabled={loading || cardLoading} title="Muat ulang"><RefreshCw size={18} /></button>
    </header>

    <section className={styles.filters} aria-label="Filter laporan">
      <label><span>Cabang</span><select value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label>
      <label><span>Dari</span><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
      <label><span>Sampai</span><input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <div className={styles.snapshot}><span>Snapshot valuation</span><strong>{valuation ? new Date(valuation.generatedAt).toLocaleString('id-ID') : '-'}</strong></div>
    </section>

    <nav className={styles.tabs} aria-label="Tampilan laporan">
      <button className={view === 'OVERVIEW' ? styles.activeTab : ''} onClick={() => setView('OVERVIEW')}><Boxes size={16} /> Ringkasan</button>
      <button className={view === 'STOCK_CARD' ? styles.activeTab : ''} onClick={() => setView('STOCK_CARD')}><PackageSearch size={16} /> Stock Card</button>
      <button className={view === 'VALUATION' ? styles.activeTab : ''} onClick={() => setView('VALUATION')}><CircleDollarSign size={16} /> Valuation</button>
    </nav>

    {error && <div className={styles.error}>{error}</div>}
    {loading && !dashboard ? <div className={styles.loading}>Memuat laporan...</div> : null}

    {view === 'OVERVIEW' && dashboard && <>
      <section className={styles.kpiGrid}>
        <Kpi label="Nilai aset inventory" value={currency(dashboard.valuation.totalAssetValue)} note={`In-transit ${currency(dashboard.valuation.inTransitValue)}`} icon={<CircleDollarSign size={19} />} />
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
        <div className={dashboard.valuation.layerMismatchCount ? styles.alertDanger : styles.alertOk}>{dashboard.valuation.layerMismatchCount ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}<span>Mismatch layer</span><strong>{dashboard.valuation.layerMismatchCount}</strong></div>
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
        <div className={styles.tableWrap}><table><thead><tr><th>Tanggal / Posting</th><th>Referensi</th><th>Lokasi / Batch</th><th className={styles.number}>Masuk</th><th className={styles.number}>Keluar</th><th className={styles.number}>Saldo</th><th className={styles.number}>Actual cost</th></tr></thead><tbody>
          {stockCard.data.length ? stockCard.data.map((row) => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleString('id-ID')}<span>{row.inventoryPosting?.postingNumber || row.type}</span></td><td>{row.inventoryPosting?.sourceNumber || row.referenceId || '-'}<span>{row.inventoryPosting?.sourceType || row.referenceType || '-'}</span></td><td>{row.inventoryBalance?.stockLocation ? `${row.inventoryBalance.stockLocation.warehouse.code} / ${row.inventoryBalance.stockLocation.code}` : '-'}<span>{row.batch?.batchNumber || 'Tanpa batch'}</span></td><td className={`${styles.number} ${styles.inboundText}`}>{Number(row.inboundQty) ? quantity(row.inboundQty) : '-'}</td><td className={`${styles.number} ${styles.outboundText}`}>{Number(row.outboundQty) ? quantity(row.outboundQty) : '-'}</td><td className={styles.number}><strong>{quantity(row.runningQty)}</strong></td><td className={styles.number}>{currency(row.actualCost)}</td></tr>) : <tr><td colSpan={7} className={styles.empty}>Tidak ada mutasi pada periode ini</td></tr>}
        </tbody></table></div>
        <footer className={styles.pagination}><span>{stockCard.meta.total} mutasi</span><div><button className={styles.iconButton} disabled={stockPage <= 1} onClick={() => setStockPage((page) => page - 1)} title="Halaman sebelumnya"><ArrowLeft size={17} /></button><strong>{stockPage} / {Math.max(1, stockCard.meta.totalPages)}</strong><button className={styles.iconButton} disabled={stockPage >= stockCard.meta.totalPages} onClick={() => setStockPage((page) => page + 1)} title="Halaman berikutnya"><ArrowRight size={17} /></button></div></footer>
      </> : <div className={styles.empty}>Pilih inventory item</div>}
    </section>}

    {view === 'VALUATION' && valuation && <section className={styles.viewSection}>
      <section className={styles.stockSummary}>
        <div><span>Layer value</span><strong>{currency(valuation.summary.layerValue)}</strong></div>
        <div><span>In-transit value</span><strong>{currency(valuation.summary.inTransitValue)}</strong></div>
        <div><span>Total asset</span><strong>{currency(valuation.summary.totalAssetValue)}</strong></div>
        <div><span>Valued quantity</span><strong>{quantity(valuation.summary.valuedQty)}</strong></div>
        <div className={Number(valuation.summary.pendingValuationQty) ? styles.outbound : ''}><span>Pending valuation</span><strong>{quantity(valuation.summary.pendingValuationQty)}</strong></div>
      </section>
      <div className={styles.tableWrap}><table><thead><tr><th>Produk</th><th>Lokasi / Batch</th><th className={styles.number}>On hand</th><th className={styles.number}>Reserved</th><th className={styles.number}>Avg cost</th><th className={styles.number}>Inventory value</th><th>FIFO layer</th></tr></thead><tbody>
        {valuation.data.length ? valuation.data.map((row) => <tr key={row.id}><td><strong>{row.masterProduct.sku}</strong><span>{row.masterProduct.name}</span></td><td>{row.stockLocation.warehouse.code} / {row.stockLocation.code}<span>{row.batch?.batchNumber || 'Tanpa batch'}</span></td><td className={styles.number}>{quantity(row.onHandQty)}</td><td className={styles.number}>{quantity(row.reservedQty)}</td><td className={styles.number}>{currency(row.averageUnitCost)}</td><td className={styles.number}><strong>{currency(row.inventoryValue)}</strong>{!row.quantityReconciled && <span className={styles.warningText}>Mismatch quantity</span>}</td><td><div className={styles.layers}>{row.costLayers.map((layer) => <span key={layer.id}>{layer.sourceType} · {quantity(layer.remainingQty)} @ {currency(layer.unitCost)}</span>)}</div></td></tr>) : <tr><td colSpan={7} className={styles.empty}>Belum ada cost layer</td></tr>}
      </tbody></table></div>
    </section>}
  </main>;
}
