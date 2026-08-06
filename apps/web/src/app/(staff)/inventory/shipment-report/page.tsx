'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link as LinkIcon,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';
import { inventoryApi, type Shipment } from '@/lib/api/inventoryApi';
import { devError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import type { Role } from '@/types/auth';

type ShipmentStatusFilter = 'ALL' | 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'RECEIVED_WITH_ISSUE';
type PartnerScope = 'PARTNERSHIP' | 'ALL';

interface DailyReportRow {
  day: number;
  dateKey: string;
  dateLabel: string;
  shipments: Shipment[];
  requestedQty: number;
  sentQty: number;
  receivedQty: number;
  itemCount: number;
  issueCount: number;
  invoiceAmount: number;
  invoiceNumbers: string[];
  paymentProofs: Array<{
    invoiceNumber: string;
    fileName?: string | null;
    url: string;
  }>;
}

interface PartnerSummary {
  id: string;
  name: string;
  type?: string;
  city?: string | null;
  address?: string | null;
  shipmentCount: number;
  invoiceAmount: number;
}

const REPORT_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN_MANAGER',
  'ADMIN_LOGISTIK',
  'FINANCE_LOGISTICS_CONTROLLER',
];

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const STATUS_LABELS: Record<ShipmentStatusFilter, string> = {
  ALL: 'Semua Status',
  PREPARING: 'Disiapkan',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
  RECEIVED_WITH_ISSUE: 'Ada Masalah',
};

function unwrapApiData<T>(response: { data?: unknown }, fallback: T): T {
  const body = response.data;

  if (typeof body !== 'object' || body === null) {
    return fallback;
  }

  const firstLevel = (body as { data?: unknown }).data;
  if (Array.isArray(firstLevel)) {
    return firstLevel as T;
  }

  if (typeof firstLevel === 'object' && firstLevel !== null) {
    const secondLevel = (firstLevel as { data?: unknown }).data;
    if (Array.isArray(secondLevel)) return secondLevel as T;
  }

  return fallback;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toDateKey(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return formatDateInput(date);
}

function getShipmentDate(shipment: Shipment) {
  return shipment.shippedAt || shipment.createdAt;
}

function formatDateLabel(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getNumeric(value: unknown) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function sumShipmentItems(shipments: Shipment[], field: 'requestedQty' | 'sentQty' | 'receivedQty') {
  return shipments.reduce((sum, shipment) => (
    sum + shipment.items.reduce((itemSum, item) => {
      if (field === 'receivedQty' && item.receivedQty === undefined && item.receivedQty === null) {
        return itemSum;
      }

      return itemSum + getNumeric(item[field]);
    }, 0)
  ), 0);
}

function getUniqueInvoiceMap(shipments: Shipment[]) {
  const invoices = new Map<string, NonNullable<Shipment['stockRequest']>['invoice']>();

  shipments.forEach((shipment) => {
    const invoice = shipment.stockRequest?.invoice;
    if (invoice?.id) {
      invoices.set(invoice.id, invoice);
    }
  });

  return invoices;
}

function sumUniqueInvoices(shipments: Shipment[]) {
  return Array.from(getUniqueInvoiceMap(shipments).values()).reduce((sum, invoice) => (
    sum + getNumeric(invoice?.totalAmount)
  ), 0);
}

function getIssueCount(shipments: Shipment[]) {
  return shipments.filter((shipment) => (
    shipment.status === 'RECEIVED_WITH_ISSUE' ||
    shipment.hasDiscrepancies ||
    Boolean(shipment.discrepancyCount && shipment.discrepancyCount > 0)
  )).length;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function ShipmentReportPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const now = useMemo(() => new Date(), []);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [partnerScope, setPartnerScope] = useState<PartnerScope>('PARTNERSHIP');
  const [partnerId, setPartnerId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatusFilter>('ALL');
  const [openingProof, setOpeningProof] = useState<string | null>(null);

  const hasReportAccess = Boolean(
    user &&
      REPORT_ROLES.includes(user.role) &&
      !(user.role === 'ADMIN_MANAGER' && user.adminManagerAccessScope === 'MEMBER_VIEW_ONLY')
  );

  const yearOptions = useMemo(() => {
    const baseYear = now.getFullYear();
    return [baseYear - 2, baseYear - 1, baseYear, baseYear + 1];
  }, [now]);

  const fetchShipments = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      const response = await inventoryApi.getShipments({
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
      });
      setShipments(unwrapApiData<Shipment[]>(response, []));
    } catch (error) {
      assertCaughtError(error);
      devError('Shipment report fetch error:', error);
      showToast.error('Gagal memuat laporan pengiriman');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedYear]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    if (!hasReportAccess) {
      showToast.error('Anda tidak memiliki akses ke laporan pengiriman');
      router.replace('/dashboard');
      return;
    }

    fetchShipments();
  }, [accessToken, fetchShipments, hasReportAccess, mounted, router, user]);

  const filteredYearShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      if (partnerScope === 'PARTNERSHIP' && shipment.toBranchType !== 'PARTNERSHIP') {
        return false;
      }

      if (partnerId !== 'ALL' && shipment.toBranchId !== partnerId) {
        return false;
      }

      if (statusFilter !== 'ALL' && shipment.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [partnerId, partnerScope, shipments, statusFilter]);

  const monthShipments = useMemo(() => {
    return filteredYearShipments.filter((shipment) => {
      const date = new Date(getShipmentDate(shipment));
      return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
    });
  }, [filteredYearShipments, selectedMonth, selectedYear]);

  const partnerSummaries = useMemo<PartnerSummary[]>(() => {
    const partners = new Map<string, PartnerSummary>();

    shipments.forEach((shipment) => {
      if (partnerScope === 'PARTNERSHIP' && shipment.toBranchType !== 'PARTNERSHIP') {
        return;
      }

      const existing = partners.get(shipment.toBranchId);
      const invoiceAmount = sumUniqueInvoices([shipment]);

      if (existing) {
        existing.shipmentCount += 1;
        existing.invoiceAmount += invoiceAmount;
        return;
      }

      partners.set(shipment.toBranchId, {
        id: shipment.toBranchId,
        name: shipment.toBranchName,
        type: shipment.toBranchType,
        city: shipment.toBranchCity,
        address: shipment.toBranchAddress,
        shipmentCount: 1,
        invoiceAmount,
      });
    });

    return Array.from(partners.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [partnerScope, shipments]);

  const dailyRows = useMemo<DailyReportRow[]>(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = formatDateInput(new Date(selectedYear, selectedMonth, day));
      const rowShipments = monthShipments.filter((shipment) => toDateKey(getShipmentDate(shipment)) === dateKey);
      const invoiceMap = getUniqueInvoiceMap(rowShipments);
      const invoices = Array.from(invoiceMap.values());

      return {
        day,
        dateKey,
        dateLabel: formatDateLabel(selectedYear, selectedMonth, day),
        shipments: rowShipments,
        requestedQty: sumShipmentItems(rowShipments, 'requestedQty'),
        sentQty: sumShipmentItems(rowShipments, 'sentQty'),
        receivedQty: sumShipmentItems(rowShipments, 'receivedQty'),
        itemCount: rowShipments.reduce((sum, shipment) => sum + shipment.items.length, 0),
        issueCount: getIssueCount(rowShipments),
        invoiceAmount: invoices.reduce((sum, invoice) => sum + getNumeric(invoice?.totalAmount), 0),
        invoiceNumbers: invoices
          .map((invoice) => invoice?.invoiceNumber)
          .filter((invoiceNumber): invoiceNumber is string => Boolean(invoiceNumber)),
        paymentProofs: invoices
          .filter((invoice) => Boolean(invoice?.paymentProofUrl))
          .map((invoice) => ({
            invoiceNumber: invoice?.invoiceNumber || '-',
            fileName: invoice?.paymentProofFileName,
            url: invoice?.paymentProofUrl as string,
          })),
      };
    });
  }, [monthShipments, selectedMonth, selectedYear]);

  const monthTotals = useMemo(() => ({
    shipmentCount: monthShipments.length,
    requestedQty: sumShipmentItems(monthShipments, 'requestedQty'),
    sentQty: sumShipmentItems(monthShipments, 'sentQty'),
    receivedQty: sumShipmentItems(monthShipments, 'receivedQty'),
    itemCount: monthShipments.reduce((sum, shipment) => sum + shipment.items.length, 0),
    issueCount: getIssueCount(monthShipments),
    invoiceAmount: sumUniqueInvoices(monthShipments),
  }), [monthShipments]);

  const monthlySummary = useMemo(() => {
    return MONTHS.map((month, monthIndex) => {
      const rows = filteredYearShipments.filter((shipment) => {
        const date = new Date(getShipmentDate(shipment));
        return date.getFullYear() === selectedYear && date.getMonth() === monthIndex;
      });

      return {
        month,
        shipmentCount: rows.length,
        requestedQty: sumShipmentItems(rows, 'requestedQty'),
        sentQty: sumShipmentItems(rows, 'sentQty'),
        receivedQty: sumShipmentItems(rows, 'receivedQty'),
        itemCount: rows.reduce((sum, shipment) => sum + shipment.items.length, 0),
        issueCount: getIssueCount(rows),
        invoiceAmount: sumUniqueInvoices(rows),
      };
    });
  }, [filteredYearShipments, selectedYear]);

  const yearlyTotals = useMemo(() => ({
    shipmentCount: filteredYearShipments.length,
    requestedQty: sumShipmentItems(filteredYearShipments, 'requestedQty'),
    sentQty: sumShipmentItems(filteredYearShipments, 'sentQty'),
    receivedQty: sumShipmentItems(filteredYearShipments, 'receivedQty'),
    itemCount: filteredYearShipments.reduce((sum, shipment) => sum + shipment.items.length, 0),
    issueCount: getIssueCount(filteredYearShipments),
    invoiceAmount: sumUniqueInvoices(filteredYearShipments),
  }), [filteredYearShipments]);

  const getRowStatus = (row: DailyReportRow) => {
    if (row.shipments.length === 0) return '-';
    if (row.issueCount > 0) return 'Issue';
    if (row.shipments.every((shipment) => shipment.status === 'RECEIVED')) return 'Selesai';
    if (row.shipments.some((shipment) => shipment.status === 'SHIPPED')) return 'Dikirim';
    return 'Disiapkan';
  };

  const getRowStatusClass = (row: DailyReportRow) => {
    const status = getRowStatus(row);

    if (status === 'Issue') return 'text-red-700';
    if (status === 'Selesai') return 'text-emerald-700';
    if (status === 'Dikirim') return 'text-blue-700';
    if (status === 'Disiapkan') return 'text-amber-700';
    return 'text-neutral-400';
  };

  const buildPaymentProofUrl = (proofUrl: string) => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';

    if (proofUrl.startsWith('http')) {
      return proofUrl;
    }

    if (proofUrl.startsWith('/api/v1/')) {
      return apiBaseUrl + proofUrl.replace('/api/v1', '');
    }

    if (proofUrl.startsWith('/')) {
      return apiBaseUrl + proofUrl;
    }

    return `${apiBaseUrl}/${proofUrl}`;
  };

  const openPaymentProof = async (proofUrl: string, label: string) => {
    if (!accessToken) {
      showToast.error('Token tidak ditemukan');
      return;
    }

    setOpeningProof(proofUrl);
    try {
      const response = await fetch(buildPaymentProofUrl(proofUrl), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      assertCaughtError(error);
      devError('Open payment proof error:', error);
      showToast.error(`Gagal membuka ${label}`);
    } finally {
      setOpeningProof(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      [
        'Bulan',
        'No',
        'Tanggal',
        'Request Qty',
        'Qty Dikirim',
        'Qty Diterima',
        'Jumlah Item',
        'Status',
        'Masalah',
        'Tagihan',
        'Nomor Invoice',
        'Bukti Bayar',
      ],
      ...dailyRows.map((row) => [
        MONTHS[selectedMonth],
        row.day,
        row.dateLabel,
        formatQuantity(row.requestedQty),
        formatQuantity(row.sentQty),
        formatQuantity(row.receivedQty),
        row.itemCount,
        getRowStatus(row),
        row.issueCount,
        row.invoiceAmount,
        row.invoiceNumbers.join(', '),
        row.paymentProofs.map((proof) => proof.fileName || proof.invoiceNumber).join(', '),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-pengiriman-${selectedYear}-${pad2(selectedMonth + 1)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!mounted || !user || !hasReportAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-4 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Laporan Pengiriman Barang</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Format rekap harian dan bulanan untuk operasional partnership.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchShipments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-sm font-semibold">
          <span>Bulan</span>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index}>{month}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          <span>Tahun</span>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          <span>Cakupan</span>
          <select
            value={partnerScope}
            onChange={(event) => {
              setPartnerScope(event.target.value as PartnerScope);
              setPartnerId('ALL');
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="PARTNERSHIP">Partnership</option>
            <option value="ALL">Semua Cabang</option>
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          <span>Partner</span>
          <select
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="ALL">Semua Partner</option>
            {partnerSummaries.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-semibold">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ShipmentStatusFilter)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <PageLoading text="Memuat laporan pengiriman" />
      ) : (
        <div className="space-y-8">
          <section className="overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-300 px-4 py-3 dark:border-neutral-700">
              <div>
                <h2 className="font-bold">NANO LIFE</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {MONTHS[selectedMonth]} {selectedYear}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                <Truck className="h-4 w-4" />
                {monthTotals.shipmentCount} pengiriman
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="bg-blue-100 text-neutral-950">
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Bulan</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">No</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Tanggal</th>
                    <th colSpan={3} className="border border-neutral-800 px-2 py-2">Pengiriman Barang</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Jumlah Item</th>
                    <th colSpan={2} className="border border-neutral-800 px-2 py-2">Status</th>
                    <th colSpan={3} className="border border-neutral-800 px-2 py-2">Invoice</th>
                  </tr>
                  <tr className="bg-blue-100 text-neutral-950">
                    <th className="border border-neutral-800 px-2 py-2">Request Qty</th>
                    <th className="border border-neutral-800 px-2 py-2">Qty Dikirim</th>
                    <th className="border border-neutral-800 px-2 py-2">Qty Diterima</th>
                    <th className="border border-neutral-800 px-2 py-2">Shipment</th>
                    <th className="border border-neutral-800 px-2 py-2">Masalah</th>
                    <th className="border border-neutral-800 px-2 py-2">Tagihan</th>
                    <th className="border border-neutral-800 px-2 py-2">Nomor Invoice</th>
                    <th className="border border-neutral-800 px-2 py-2">Bukti Bayar</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((row, index) => (
                    <tr key={row.dateKey} className={row.shipments.length ? 'bg-white dark:bg-neutral-950' : 'bg-neutral-50 dark:bg-neutral-900'}>
                      {index === 0 && (
                        <td
                          rowSpan={dailyRows.length}
                          className="border border-neutral-800 bg-white px-2 py-2 text-center text-3xl font-bold tracking-[0.35em] text-neutral-950 dark:bg-neutral-950 dark:text-white"
                          style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                        >
                          {MONTHS[selectedMonth].toUpperCase()}
                        </td>
                      )}
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.day}</td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.dateLabel}</td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.requestedQty ? formatQuantity(row.requestedQty) : ''}</td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.sentQty ? formatQuantity(row.sentQty) : ''}</td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.receivedQty ? formatQuantity(row.receivedQty) : ''}</td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.itemCount || ''}</td>
                      <td className={`border border-neutral-800 px-2 py-1 text-center font-semibold ${getRowStatusClass(row)}`}>
                        {getRowStatus(row)}
                      </td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">{row.issueCount || ''}</td>
                      <td className="border border-neutral-800 px-2 py-1 text-right font-semibold">
                        {row.invoiceAmount ? formatCurrency(row.invoiceAmount) : ''}
                      </td>
                      <td className="border border-neutral-800 px-2 py-1 text-center font-mono text-xs">
                        {row.invoiceNumbers.map((invoiceNumber) => (
                          <div key={invoiceNumber}>{invoiceNumber}</div>
                        ))}
                      </td>
                      <td className="border border-neutral-800 px-2 py-1 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {row.paymentProofs.map((proof) => (
                            <button
                              key={`${proof.invoiceNumber}-${proof.url}`}
                              type="button"
                              onClick={() => openPaymentProof(proof.url, proof.fileName || proof.invoiceNumber)}
                              disabled={openingProof === proof.url}
                              className="inline-flex max-w-[150px] items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-200 disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                              title={proof.fileName || proof.invoiceNumber}
                            >
                              {openingProof === proof.url ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <LinkIcon className="h-3 w-3" />
                              )}
                              <span className="truncate">{proof.fileName || 'Bukti bayar'}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100 font-bold text-neutral-950">
                    <td colSpan={3} className="border border-neutral-800 px-2 py-2 text-center">TOTAL</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{formatQuantity(monthTotals.requestedQty)}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{formatQuantity(monthTotals.sentQty)}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{formatQuantity(monthTotals.receivedQty)}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{monthTotals.itemCount}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{monthTotals.shipmentCount}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{monthTotals.issueCount}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-right">{formatCurrency(monthTotals.invoiceAmount)}</td>
                    <td className="border border-neutral-800 px-2 py-2" />
                    <td className="border border-neutral-800 px-2 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div className="border-b border-neutral-300 px-4 py-3 text-center dark:border-neutral-700">
              <h2 className="font-bold">ALL PARTNER</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-300 text-neutral-950">
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Bulan</th>
                    <th colSpan={3} className="border border-neutral-800 px-2 py-2">Pengiriman Barang</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Jumlah Item</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Shipment</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Masalah</th>
                    <th rowSpan={2} className="border border-neutral-800 px-2 py-2">Tagihan</th>
                  </tr>
                  <tr className="bg-neutral-300 text-neutral-950">
                    <th className="border border-neutral-800 px-2 py-2">Request Qty</th>
                    <th className="border border-neutral-800 px-2 py-2">Qty Dikirim</th>
                    <th className="border border-neutral-800 px-2 py-2">Qty Diterima</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map((row) => (
                    <tr key={row.month}>
                      <td className="border border-neutral-800 px-2 py-2 text-center font-semibold">{row.month}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-center">{row.requestedQty ? formatQuantity(row.requestedQty) : ''}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-center">{row.sentQty ? formatQuantity(row.sentQty) : ''}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-center">{row.receivedQty ? formatQuantity(row.receivedQty) : ''}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-center">{row.itemCount || ''}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-center">{row.shipmentCount || ''}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-center">{row.issueCount || ''}</td>
                      <td className="border border-neutral-800 px-2 py-2 text-right">{row.invoiceAmount ? formatCurrency(row.invoiceAmount) : ''}</td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-300 font-bold text-neutral-950">
                    <td className="border border-neutral-800 px-2 py-2 text-center">Total</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{formatQuantity(yearlyTotals.requestedQty)}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{formatQuantity(yearlyTotals.sentQty)}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{formatQuantity(yearlyTotals.receivedQty)}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{yearlyTotals.itemCount}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{yearlyTotals.shipmentCount}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-center">{yearlyTotals.issueCount}</td>
                    <td className="border border-neutral-800 px-2 py-2 text-right">{formatCurrency(yearlyTotals.invoiceAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div className="border-b border-neutral-300 px-4 py-3 text-center dark:border-neutral-700">
              <h2 className="font-bold">LIST PARTNERSHIP</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-orange-300 text-neutral-950">
                    <th className="border border-neutral-800 px-2 py-3">NO</th>
                    <th className="border border-neutral-800 px-2 py-3">NAMA</th>
                    <th className="border border-neutral-800 px-2 py-3">TEMPAT LAYANAN</th>
                    <th className="border border-neutral-800 px-2 py-3">LOKASI KOTA</th>
                    <th className="border border-neutral-800 px-2 py-3">SHIPMENT</th>
                    <th className="border border-neutral-800 px-2 py-3">TAGIHAN</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-neutral-800 px-2 py-6 text-center text-neutral-500">
                        Tidak ada data partner.
                      </td>
                    </tr>
                  ) : (
                    partnerSummaries.map((partner, index) => (
                      <tr key={partner.id} className={index % 2 === 0 ? 'bg-white dark:bg-neutral-950' : 'bg-orange-50 dark:bg-neutral-900'}>
                        <td className="border border-neutral-800 px-2 py-2 text-center">{index + 1}</td>
                        <td className="border border-neutral-800 px-2 py-2 text-center font-semibold">{partner.name}</td>
                        <td className="border border-neutral-800 px-2 py-2 text-center">{partner.type || '-'}</td>
                        <td className="border border-neutral-800 px-2 py-2 text-center">{partner.city || partner.address || '-'}</td>
                        <td className="border border-neutral-800 px-2 py-2 text-center">{partner.shipmentCount}</td>
                        <td className="border border-neutral-800 px-2 py-2 text-right">{formatCurrency(partner.invoiceAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-end">
            <a
              href="/inventory/shipments"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Pengiriman
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
