'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Unlock } from 'lucide-react';
import { api } from '@/lib/api';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import styles from '../operations.module.css';
import { extractCollectionRows } from './stockReservationPresentation';

type Row = Record<string, any>;
type DraftLine = { approvedQty: string; stockLocationId: string };

function idempotencyKey(prefix: string) {
  return `${prefix}:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function availableByLocation(balances: Row[], masterProductId: string) {
  const grouped = new Map<string, { id: string; label: string; available: number }>();
  balances
    .filter((balance) => balance.masterProductId === masterProductId)
    .forEach((balance) => {
      const current = grouped.get(balance.stockLocationId);
      const available = Number(balance.availableQty || 0);
      const label = `${balance.stockLocation?.warehouse?.code || '-'} / ${balance.stockLocation?.code || '-'}`;
      grouped.set(balance.stockLocationId, {
        id: balance.stockLocationId,
        label,
        available: (current?.available || 0) + available,
      });
    });
  return Array.from(grouped.values()).filter((location) => location.available > 0);
}

export default function StockReservationsPage() {
  const { user, activeBranchId } = useAuthStore();
  const [sourceBranchId, setSourceBranchId] = useState(activeBranchId || user?.branchId || '');
  const [branches, setBranches] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [balances, setBalances] = useState<Row[]>([]);
  const [reservations, setReservations] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, DraftLine>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const branchResponse = await api.get('/branches', { params: { isActive: true, limit: 100 } });
      const branchRows = extractCollectionRows<Row>(branchResponse.data);
      setBranches(branchRows);
      const selectedBranchId = sourceBranchId || branchRows[0]?.id || '';
      if (!sourceBranchId && selectedBranchId) setSourceBranchId(selectedBranchId);
      if (!selectedBranchId) return;

      const [requestResponse, balanceResponse, reservationResponse] = await Promise.all([
        inventoryApi.getStockRequests({ status: 'PENDING', limit: 100 }),
        inventoryApi.getLedgerBalances({ branchId: selectedBranchId, limit: 100 }),
        inventoryApi.getStockReservations({ sourceBranchId: selectedBranchId, status: 'ACTIVE', limit: 100 }),
      ]);
      const requestRows = extractCollectionRows<Row>(requestResponse.data);
      const balanceRows = extractCollectionRows<Row>(balanceResponse.data);
      const reservationRows = extractCollectionRows<Row>(reservationResponse.data);
      setRequests(requestRows);
      setBalances(balanceRows);
      setReservations(reservationRows);

      const nextDrafts: Record<string, Record<string, DraftLine>> = {};
      requestRows.forEach((request: Row) => {
        nextDrafts[request.id] = {};
        extractCollectionRows<Row>(request.items).forEach((item: Row) => {
          const locations = availableByLocation(balanceRows, item.masterProductId);
          const location = locations[0];
          const requested = Number(item.finalQty ?? item.requestedQty ?? 0);
          nextDrafts[request.id][item.id] = {
            approvedQty: String(Math.min(requested, location?.available || 0)),
            stockLocationId: location?.id || '',
          };
        });
      });
      setDrafts(nextDrafts);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'Gagal memuat stock request dan reservation.');
    } finally {
      setLoading(false);
    }
  }, [sourceBranchId]);

  useEffect(() => { void load(); }, [load]);

  const updateDraft = (requestId: string, itemId: string, patch: Partial<DraftLine>) => {
    setDrafts((current) => ({
      ...current,
      [requestId]: {
        ...current[requestId],
        [itemId]: { ...current[requestId]?.[itemId], ...patch },
      },
    }));
  };

  const approve = async (request: Row) => {
    const lines = extractCollectionRows<Row>(request.items).map((item: Row) => ({
      stockRequestItemId: item.id,
      approvedQty: drafts[request.id]?.[item.id]?.approvedQty || '0',
      stockLocationId: drafts[request.id]?.[item.id]?.stockLocationId || undefined,
    }));
    if (!lines.some((line: Row) => Number(line.approvedQty) > 0)) {
      showToast.error('Minimal satu item harus memiliki approved quantity.');
      return;
    }
    try {
      setSaving(true);
      const response = await inventoryApi.approveAndReserveStockRequest(request.id, {
        idempotencyKey: idempotencyKey('STOCK-REQUEST-APPROVAL'),
        sourceBranchId,
        lines,
      });
      const status = response.data?.data?.status;
      showToast.success(status === 'PARTIALLY_APPROVED' ? 'Request disetujui parsial dan stok direservasi.' : 'Request disetujui penuh dan stok direservasi.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Approval dan reservation gagal.');
    } finally { setSaving(false); }
  };

  const release = async (requestId: string) => {
    const reason = window.prompt('Alasan release reservation');
    if (!reason) return;
    try {
      setSaving(true);
      await inventoryApi.releaseStockRequestReservations(requestId, {
        idempotencyKey: idempotencyKey('STOCK-RESERVATION-RELEASE'),
        reason,
      });
      showToast.success('Reservation berhasil dilepas.');
      await load();
    } catch (requestError: any) {
      showToast.error(requestError.response?.data?.error?.message || 'Release reservation gagal.');
    } finally { setSaving(false); }
  };

  const reservationGroups = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    reservations.forEach((reservation) => grouped.set(
      reservation.stockRequestId,
      [...(grouped.get(reservation.stockRequestId) || []), reservation],
    ));
    return Array.from(grouped.entries());
  }, [reservations]);

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1>Stock Request & Reservation</h1><p>Approval penuh atau parsial berdasarkan available quantity per lokasi.</p></div>
      <button className={styles.secondaryButton} onClick={() => void load()} title="Muat ulang"><RefreshCw size={16} /></button>
    </header>
    <div className={styles.toolbar}>
      <label className={styles.field}><span>Source branch</span><select className={styles.select} value={sourceBranchId} onChange={(event) => setSourceBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} - {branch.name}</option>)}</select></label>
    </div>
    {error && <div className={styles.error}>{error}</div>}
    {loading ? <div className={styles.loading}>Memuat reservation...</div> : <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}><h2>Menunggu approval</h2><span>{requests.length} request</span></div>
        <div className={styles.requestList}>{requests.length === 0 ? <div className={styles.empty}>Tidak ada request pending.</div> : requests.map((request) => <article className={styles.requestCard} key={request.id}>
          <div className={styles.requestHeader}><div><strong>{request.requestCode}</strong><span>{request.branchName}</span></div><span className={styles.warningBadge}>PENDING</span></div>
          <div className={styles.lineGrid}>{extractCollectionRows<Row>(request.items).map((item: Row) => {
            const locations = availableByLocation(balances, item.masterProductId);
            const draft = drafts[request.id]?.[item.id] || { approvedQty: '0', stockLocationId: '' };
            const selectedLocation = locations.find((location) => location.id === draft.stockLocationId);
            return <div className={styles.lineRow} key={item.id}>
              <div><strong>{item.productName}</strong><span>Diminta {item.finalQty ?? item.requestedQty} {item.unit}</span></div>
              <label className={styles.field}><span>Stock location</span><select className={styles.select} value={draft.stockLocationId} onChange={(event) => updateDraft(request.id, item.id, { stockLocationId: event.target.value })}><option value="">Tidak tersedia</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label} - tersedia {location.available}</option>)}</select></label>
              <label className={styles.field}><span>Approved quantity</span><input className={styles.input} type="number" min="0" max={Number(item.finalQty ?? item.requestedQty)} step="0.01" value={draft.approvedQty} onChange={(event) => updateDraft(request.id, item.id, { approvedQty: event.target.value })} /></label>
              <span className={styles.available}>Available {selectedLocation?.available || 0}</span>
            </div>;
          })}</div>
          <div className={styles.actions}><button className={styles.button} disabled={saving} onClick={() => void approve(request)}><CheckCircle2 size={16} /> Approve & reserve</button></div>
        </article>)}</div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><h2>Reservation aktif</h2><span>{reservations.length} allocation</span></div>
        {reservationGroups.length === 0 ? <div className={styles.empty}>Tidak ada reservation aktif.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Request / Tujuan</th><th>Produk</th><th>Lokasi / Batch</th><th className={styles.number}>Reserved</th><th>Aksi</th></tr></thead><tbody>{reservationGroups.flatMap(([requestId, rows]) => rows.map((reservation, index) => <tr key={reservation.id}><td>{reservation.stockRequest?.requestCode}<br />{reservation.stockRequest?.branch?.name}</td><td>{reservation.stockRequestItem?.masterProduct?.sku}<br />{reservation.stockRequestItem?.masterProduct?.name}</td><td>{reservation.inventoryBalance?.stockLocation?.warehouse?.code} / {reservation.inventoryBalance?.stockLocation?.code}<br />{reservation.inventoryBalance?.batch?.batchNumber || 'Tanpa batch'}</td><td className={styles.number}>{String(reservation.quantity)}</td><td>{index === 0 ? <button className={styles.dangerButton} disabled={saving} onClick={() => void release(requestId)}><Unlock size={15} /> Release</button> : null}</td></tr>))}</tbody></table></div>}
      </section>
    </>}
  </main>;
}
