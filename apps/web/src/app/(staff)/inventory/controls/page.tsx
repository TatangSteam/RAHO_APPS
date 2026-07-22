'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import styles from '../operations.module.css';

type Row = Record<string, any>;
type View = 'ADJUSTMENT' | 'OPNAME';
type AdjustmentLine = {
  inventoryItemId: string;
  batchId: string;
  direction: 'IN' | 'OUT';
  quantity: string;
  unitCost: string;
  notes: string;
};

const emptyLine = (): AdjustmentLine => ({
  inventoryItemId: '', batchId: '', direction: 'OUT', quantity: '', unitCost: '', notes: '',
});

const formatQuantity = (value: unknown) => Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });
const formatMoney = (value: unknown) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(Number(value || 0));
const newKey = (prefix: string) => `${prefix}:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

function statusStyle(status: string) {
  if (status === 'POSTED' || status === 'APPROVED') return styles.badge;
  if (status === 'REJECTED' || status === 'CANCELLED') return styles.inactiveBadge;
  return styles.warningBadge;
}

export default function InventoryControlsPage() {
  const { user, activeBranchId } = useAuthStore();
  const [view, setView] = useState<View>('ADJUSTMENT');
  const [branchId, setBranchId] = useState(activeBranchId || user?.branchId || '');
  const [branches, setBranches] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [reasons, setReasons] = useState<Row[]>([]);
  const [adjustments, setAdjustments] = useState<Row[]>([]);
  const [opnames, setOpnames] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ stockLocationId: '', reasonCode: 'OTHER', description: '' });
  const [adjustmentLines, setAdjustmentLines] = useState<AdjustmentLine[]>([emptyLine()]);
  const [opnameForm, setOpnameForm] = useState({ stockLocationId: '', notes: '' });
  const [selectedOpname, setSelectedOpname] = useState<Row | null>(null);
  const [counts, setCounts] = useState<Record<string, { physicalQty: string; resolvedUnitCost: string; resolutionNote: string }>>({});

  const role = user?.role || '';
  const canCreateAdjustment = ['SUPER_ADMIN', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'].includes(role);
  const canApprove = ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(role);
  const canPost = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK'].includes(role);
  const canCount = ['SUPER_ADMIN', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'].includes(role);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const branchResponse = await api.get('/branches', { params: { isActive: true, limit: 100 } });
      const branchRows = branchResponse.data?.data || [];
      setBranches(branchRows);
      const selectedBranch = branchId || branchRows[0]?.id || '';
      if (!branchId && selectedBranch) setBranchId(selectedBranch);
      if (!selectedBranch) return;
      const [itemResponse, warehouseResponse, reasonResponse, adjustmentResponse, opnameResponse, batchResponse] = await Promise.all([
        inventoryApi.getInventoryItems(selectedBranch),
        inventoryApi.getWarehouses({ branchId: selectedBranch }),
        inventoryApi.getAdjustmentReasons(),
        inventoryApi.getAdjustments({ branchId: selectedBranch, limit: 100 }),
        inventoryApi.getStockOpnames({ branchId: selectedBranch, limit: 100 }),
        inventoryApi.getBatches({ includeBlocked: false }),
      ]);
      const warehouses = warehouseResponse.data?.data || [];
      const locationResponses = await Promise.all(warehouses.map((warehouse: Row) => inventoryApi.getStockLocations(warehouse.id)));
      const locationRows = locationResponses.flatMap((response) => response.data?.data || []);
      setItems(itemResponse.data?.data?.items || itemResponse.data?.data || []);
      setLocations(locationRows);
      setReasons(reasonResponse.data?.data || []);
      setAdjustments(adjustmentResponse.data?.data?.data || []);
      setOpnames(opnameResponse.data?.data?.data || []);
      setBatches(batchResponse.data?.data || []);
      setAdjustmentForm((current) => ({ ...current, stockLocationId: current.stockLocationId || locationRows[0]?.id || '' }));
      setOpnameForm((current) => ({ ...current, stockLocationId: current.stockLocationId || locationRows[0]?.id || '' }));
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Gagal memuat inventory control.');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { void load(); }, [load]);

  const updateAdjustmentLine = (index: number, patch: Partial<AdjustmentLine>) => {
    setAdjustmentLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  const submitAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await inventoryApi.createAdjustment({
        idempotencyKey: newKey('ADJUSTMENT'), branchId,
        stockLocationId: adjustmentForm.stockLocationId,
        reasonCode: adjustmentForm.reasonCode,
        description: adjustmentForm.description,
        submit: true,
        lines: adjustmentLines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          batchId: line.batchId || undefined,
          direction: line.direction,
          quantity: line.quantity,
          unitCost: line.direction === 'IN' ? line.unitCost : undefined,
          notes: line.notes || undefined,
        })),
      });
      showToast.success('Adjustment diajukan untuk approval.');
      setShowAdjustmentForm(false);
      setAdjustmentForm((current) => ({ ...current, reasonCode: 'OTHER', description: '' }));
      setAdjustmentLines([emptyLine()]);
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Adjustment gagal dibuat.');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (kind: View, row: Row, decision: 'APPROVE' | 'REJECT') => {
    const note = window.prompt(decision === 'APPROVE' ? 'Catatan persetujuan' : 'Alasan penolakan');
    if (!note || note.trim().length < 3) return;
    try {
      setSaving(true);
      if (kind === 'ADJUSTMENT') await inventoryApi.decideAdjustment(row.id, decision, note);
      else await inventoryApi.decideStockOpname(row.id, decision, note);
      showToast.success(decision === 'APPROVE' ? 'Dokumen disetujui.' : 'Dokumen ditolak.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Keputusan gagal disimpan.');
    } finally { setSaving(false); }
  };

  const post = async (kind: View, row: Row) => {
    try {
      setSaving(true);
      if (kind === 'ADJUSTMENT') await inventoryApi.postAdjustment(row.id);
      else await inventoryApi.postStockOpname(row.id);
      showToast.success('Mutation dan journal berhasil diposting.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Posting gagal.');
    } finally { setSaving(false); }
  };

  const startOpname = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      const response = await inventoryApi.startStockOpname({ branchId, ...opnameForm });
      const opname = response.data?.data;
      showToast.success('Snapshot dibuat dan lokasi dikunci.');
      openCount(opname);
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Stock opname gagal dimulai.');
    } finally { setSaving(false); }
  };

  const openCount = (opname: Row) => {
    setSelectedOpname(opname);
    setCounts(Object.fromEntries((opname.lines || []).map((line: Row) => [line.id, {
      physicalQty: line.physicalQty ?? line.systemQty,
      resolvedUnitCost: line.resolvedUnitCost ?? line.systemUnitCost ?? '',
      resolutionNote: line.resolutionNote || '',
    }])));
  };

  const saveCounts = async () => {
    if (!selectedOpname) return;
    try {
      setSaving(true);
      const lines = selectedOpname.lines.map((line: Row) => {
        const count = counts[line.id];
        const difference = Number(count.physicalQty) - Number(line.systemQty);
        return {
          lineId: line.id,
          physicalQty: count.physicalQty,
          resolvedUnitCost: difference > 0 ? count.resolvedUnitCost : undefined,
          resolution: difference === 0 ? undefined : 'ADJUST',
          resolutionNote: difference === 0 ? undefined : count.resolutionNote || 'Selisih fisik terverifikasi',
        };
      });
      const response = await inventoryApi.countStockOpname(selectedOpname.id, lines);
      setSelectedOpname(response.data?.data);
      showToast.success('Hitungan opname disimpan.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Hitungan gagal disimpan.');
    } finally { setSaving(false); }
  };

  const submitOpname = async () => {
    if (!selectedOpname) return;
    try {
      setSaving(true);
      await inventoryApi.submitStockOpname(selectedOpname.id);
      setSelectedOpname(null);
      showToast.success('Hasil opname diajukan.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Opname gagal diajukan.');
    } finally { setSaving(false); }
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1>Inventory Control</h1><p>Adjustment, stock opname, approval, dan posting selisih.</p></div>
      <button className={styles.secondaryButton} type="button" onClick={() => void load()} title="Muat ulang"><RefreshCw size={16} /></button>
    </header>

    <div className={styles.toolbar}>
      <label className={styles.field}><span>Cabang</span><select className={styles.select} value={branchId} onChange={(event) => { setBranchId(event.target.value); setSelectedOpname(null); }}><option value="">Pilih cabang</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label>
      <div className={styles.segmented} aria-label="Inventory control view">
        <button type="button" className={view === 'ADJUSTMENT' ? styles.segmentActive : styles.segment} onClick={() => setView('ADJUSTMENT')}><ListChecks size={15} /> Adjustment</button>
        <button type="button" className={view === 'OPNAME' ? styles.segmentActive : styles.segment} onClick={() => setView('OPNAME')}><ClipboardCheck size={15} /> Stock Opname</button>
      </div>
    </div>

    {error && <div className={styles.error}>{error}</div>}
    {loading ? <div className={styles.loading}>Memuat inventory control...</div> : view === 'ADJUSTMENT' ? <>
      {canCreateAdjustment && <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={() => setShowAdjustmentForm((value) => !value)}>{showAdjustmentForm ? <X size={15} /> : <Plus size={15} />} {showAdjustmentForm ? 'Tutup' : 'Buat Adjustment'}</button>
      </div>}
      {showAdjustmentForm && <form className={styles.section} onSubmit={submitAdjustment}>
        <div className={styles.form}>
          <label className={styles.field}><span>Lokasi</span><select className={styles.select} required value={adjustmentForm.stockLocationId} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, stockLocationId: event.target.value })}><option value="">Pilih lokasi</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.code || ''} / {location.code} - {location.name}</option>)}</select></label>
          <label className={styles.field}><span>Reason code</span><select className={styles.select} required value={adjustmentForm.reasonCode} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reasonCode: event.target.value })}>{reasons.map((reason) => <option key={reason.id} value={reason.code}>{reason.code} - {reason.name}</option>)}</select></label>
          <label className={styles.field}><span>Deskripsi</span><input className={styles.input} required minLength={5} value={adjustmentForm.description} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, description: event.target.value })} /></label>
        </div>
        <div className={styles.lineGrid}>{adjustmentLines.map((line, index) => {
          const selected = itemById.get(line.inventoryItemId);
          const productBatches = batches.filter((batch) => batch.masterProductId === selected?.masterProductId);
          return <div className={styles.goodsReceiptLine} key={index}>
            <label className={styles.field}><span>Item</span><select className={styles.select} required value={line.inventoryItemId} onChange={(event) => updateAdjustmentLine(index, { inventoryItemId: event.target.value, batchId: '' })}><option value="">Pilih item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.masterProduct?.sku || '-'} - {item.masterProduct?.name}</option>)}</select></label>
            <label className={styles.field}><span>Arah</span><select className={styles.select} value={line.direction} onChange={(event) => updateAdjustmentLine(index, { direction: event.target.value as 'IN' | 'OUT' })}><option value="OUT">Keluar</option><option value="IN">Masuk</option></select></label>
            <label className={styles.field}><span>Quantity</span><input className={styles.input} required inputMode="decimal" value={line.quantity} onChange={(event) => updateAdjustmentLine(index, { quantity: event.target.value })} /></label>
            {selected?.masterProduct?.tracksBatch && <label className={styles.field}><span>Batch</span><select className={styles.select} required value={line.batchId} onChange={(event) => updateAdjustmentLine(index, { batchId: event.target.value })}><option value="">Pilih batch</option>{productBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchNumber}</option>)}</select></label>}
            {line.direction === 'IN' && <label className={styles.field}><span>Unit cost</span><input className={styles.input} required inputMode="decimal" value={line.unitCost} onChange={(event) => updateAdjustmentLine(index, { unitCost: event.target.value })} /></label>}
            <label className={styles.field}><span>Catatan baris</span><input className={styles.input} value={line.notes} onChange={(event) => updateAdjustmentLine(index, { notes: event.target.value })} /></label>
            <button className={styles.secondaryButton} type="button" disabled={adjustmentLines.length === 1} onClick={() => setAdjustmentLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} title="Hapus baris"><Trash2 size={15} /></button>
          </div>;
        })}</div>
        <div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setAdjustmentLines((current) => [...current, emptyLine()])}><Plus size={15} /> Tambah Baris</button><button className={styles.button} disabled={saving}><Send size={15} /> Ajukan</button></div>
      </form>}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Dokumen</th><th>Reason</th><th>Baris</th><th className={styles.number}>Estimasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{adjustments.length === 0 ? <tr><td className={styles.empty} colSpan={6}>Belum ada adjustment.</td></tr> : adjustments.map((row) => <tr key={row.id}><td><strong>{row.adjustmentNumber}</strong><br />{new Date(row.createdAt).toLocaleString('id-ID')}</td><td>{row.reasonCode}<br />{row.description}</td><td>{row.lines?.length || 0}</td><td className={styles.number}>{formatMoney(row.totalEstimatedValue)}</td><td><span className={statusStyle(row.status)}>{row.status}</span></td><td><div className={styles.actions}>{canApprove && row.status === 'PENDING_APPROVAL' && <><button className={styles.secondaryButton} disabled={saving} onClick={() => void decide('ADJUSTMENT', row, 'APPROVE')} title="Setujui"><Check size={15} /></button><button className={styles.dangerButton} disabled={saving} onClick={() => void decide('ADJUSTMENT', row, 'REJECT')} title="Tolak"><X size={15} /></button></>}{canPost && row.status === 'APPROVED' && <button className={styles.button} disabled={saving} onClick={() => void post('ADJUSTMENT', row)}><Save size={15} /> Posting</button>}</div></td></tr>)}</tbody></table></div>
    </> : <>
      {canCount && <form className={styles.form} onSubmit={startOpname}>
        <label className={styles.field}><span>Lokasi</span><select className={styles.select} required value={opnameForm.stockLocationId} onChange={(event) => setOpnameForm({ ...opnameForm, stockLocationId: event.target.value })}><option value="">Pilih lokasi</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.warehouse?.code || ''} / {location.code} - {location.name}</option>)}</select></label>
        <label className={styles.field}><span>Catatan</span><input className={styles.input} value={opnameForm.notes} onChange={(event) => setOpnameForm({ ...opnameForm, notes: event.target.value })} /></label>
        <button className={styles.button} disabled={saving}><ClipboardCheck size={15} /> Mulai Opname</button>
      </form>}
      {selectedOpname && <section className={styles.section}>
        <div className={styles.sectionHeader}><div><h2>{selectedOpname.opnameNumber}</h2><span>{selectedOpname.status}</span></div><button className={styles.secondaryButton} onClick={() => setSelectedOpname(null)} title="Tutup"><X size={15} /></button></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Item</th><th className={styles.number}>System</th><th className={styles.number}>Fisik</th><th className={styles.number}>Unit Cost</th><th>Catatan Selisih</th></tr></thead><tbody>{selectedOpname.lines.map((line: Row) => <tr key={line.id}><td>{itemById.get(line.inventoryItemId)?.masterProduct?.name || line.inventoryItemId}</td><td className={styles.number}>{formatQuantity(line.systemQty)}</td><td><input className={styles.input} inputMode="decimal" value={counts[line.id]?.physicalQty || ''} onChange={(event) => setCounts((current) => ({ ...current, [line.id]: { ...current[line.id], physicalQty: event.target.value } }))} /></td><td><input className={styles.input} inputMode="decimal" value={counts[line.id]?.resolvedUnitCost || ''} onChange={(event) => setCounts((current) => ({ ...current, [line.id]: { ...current[line.id], resolvedUnitCost: event.target.value } }))} /></td><td><input className={styles.input} value={counts[line.id]?.resolutionNote || ''} onChange={(event) => setCounts((current) => ({ ...current, [line.id]: { ...current[line.id], resolutionNote: event.target.value } }))} /></td></tr>)}</tbody></table></div>
        <div className={styles.actions}><button className={styles.secondaryButton} disabled={saving} onClick={() => void saveCounts()}><Save size={15} /> Simpan Hitungan</button><button className={styles.button} disabled={saving} onClick={() => void submitOpname()}><Send size={15} /> Ajukan</button></div>
      </section>}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Opname</th><th>Lokasi</th><th>Snapshot</th><th>Baris</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{opnames.length === 0 ? <tr><td className={styles.empty} colSpan={6}>Belum ada stock opname.</td></tr> : opnames.map((row) => <tr key={row.id}><td><strong>{row.opnameNumber}</strong></td><td>{locations.find((location) => location.id === row.stockLocationId)?.name || row.stockLocationId}</td><td>{new Date(row.snapshotAt).toLocaleString('id-ID')}</td><td>{row.lines?.length || 0}</td><td><span className={statusStyle(row.status)}>{row.status}</span></td><td><div className={styles.actions}>{canCount && row.status === 'COUNTING' && <button className={styles.secondaryButton} onClick={() => openCount(row)}><ListChecks size={15} /> Hitung</button>}{canApprove && row.status === 'PENDING_APPROVAL' && <><button className={styles.secondaryButton} disabled={saving} onClick={() => void decide('OPNAME', row, 'APPROVE')} title="Setujui"><Check size={15} /></button><button className={styles.dangerButton} disabled={saving} onClick={() => void decide('OPNAME', row, 'REJECT')} title="Tolak"><X size={15} /></button></>}{canPost && row.status === 'APPROVED' && <button className={styles.button} disabled={saving} onClick={() => void post('OPNAME', row)}><Save size={15} /> Posting</button>}</div></td></tr>)}</tbody></table></div>
    </>}
  </main>;
}
