'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Download,
  FileText,
  Mail,
  Printer,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

type ReportType = 'Member' | 'Session' | 'Payment' | 'Inventory';
type ViewMode = 'table' | 'chart';
type Panel = 'schedule' | 'email' | null;

const REPORT_TYPES: ReportType[] = ['Member', 'Session', 'Payment', 'Inventory'];
const BRANCHES = ['Semua Cabang', 'RAHO Premier Jakarta', 'RAHO Bandung', 'RAHO Surabaya'];
const STATUSES = ['Semua Status', 'Paid', 'Completed', 'Pending', 'Cancelled'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly'];

function downloadFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 text-left text-sm text-neutral-900 transition hover:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      >
        <span>{value}</span>
        <span className="text-neutral-400">v</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-full rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-amber-50 hover:text-amber-700 dark:text-neutral-200 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const canAccess = role === 'SUPER_ADMIN' || role === 'ADMIN_MANAGER' || role === 'ADMIN_CABANG';

  const [reportType, setReportType] = useState<ReportType>('Member');
  const [branch, setBranch] = useState('Semua Cabang');
  const [status, setStatus] = useState('Semua Status');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [member, setMember] = useState('');
  const [doctor, setDoctor] = useState('');
  const [generated, setGenerated] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [panel, setPanel] = useState<Panel>(null);
  const [frequency, setFrequency] = useState('Daily');
  const [toast, setToast] = useState('');

  const rows = useMemo(() => {
    const branchName = branch === 'Semua Cabang' ? 'RAHO Premier Jakarta' : branch;
    const statusText = status === 'Semua Status' ? 'Completed' : status;

    return [
      {
        name: reportType === 'Payment' ? 'INV-RAHO-260630-001' : `${reportType} Utama`,
        branch: branchName,
        status: statusText,
        total: reportType === 'Payment' ? 'Rp 27.000.000' : '128',
      },
      {
        name: reportType === 'Inventory' ? 'IFA 250' : `${reportType} Reguler`,
        branch: 'RAHO Bandung',
        status: reportType === 'Payment' ? 'Paid' : 'Completed',
        total: reportType === 'Payment' ? 'Rp 9.500.000' : '64',
      },
      {
        name: reportType === 'Session' ? 'Terapi O3' : `${reportType} Follow Up`,
        branch: 'RAHO Surabaya',
        status: 'Pending',
        total: reportType === 'Payment' ? 'Rp 4.250.000' : '32',
      },
    ];
  }, [branch, reportType, status]);

  const generateReport = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startsInFuture = Boolean(startDate) && new Date(`${startDate}T00:00:00`) > today;

    setEmpty(startsInFuture);
    setGenerated(true);
    setViewMode('table');
  };

  const resetFilters = () => {
    setBranch('Semua Cabang');
    setStatus('Semua Status');
    setStartDate('');
    setEndDate('');
    setMember('');
    setDoctor('');
    setEmpty(false);
  };

  const exportReport = (format: 'pdf' | 'xlsx' | 'csv') => {
    const filename = `laporan-${reportType.toLowerCase()}-${Date.now()}.${format}`;
    const content = rows.map((row) => `${row.name},${row.branch},${row.status},${row.total}`).join('\n');

    if (format === 'pdf') {
      downloadFile(filename, 'application/pdf', `Laporan ${reportType}\n${content}`);
      return;
    }

    if (format === 'xlsx') {
      downloadFile(
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        `Laporan ${reportType}\n${content}`,
      );
      return;
    }

    downloadFile(filename, 'text/csv;charset=utf-8', `Nama,Cabang,Status,Total\n${content}`);
  };

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
        <section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-8 dark:border-red-500/30 dark:bg-neutral-900">
          <h1 className="text-2xl font-bold">Akses laporan dibatasi</h1>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            Tidak memiliki izin untuk membuka laporan. Permission forbidden untuk role ini.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      {toast && (
        <div
          role="status"
          className="fixed right-6 top-6 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {toast}
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase text-amber-600 dark:text-amber-400">
              ERP Klinik
            </p>
            <h1 className="mt-1 text-3xl font-bold">Laporan</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Rekap operasional member, sesi terapi, pembayaran, dan inventori.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportReport('pdf')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              <FileText size={16} />
              PDF
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPanel(panel === 'email' ? null : panel)}
                className="hidden"
                aria-hidden="true"
              />
              <ExportMenu onExport={exportReport} />
            </div>
            <button
              type="button"
              onClick={() => setPanel('schedule')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              <CalendarClock size={16} />
              Jadwal
            </button>
            <button
              type="button"
              onClick={() => setPanel('email')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              <Mail size={16} />
              Email
            </button>
            <button
              type="button"
              onClick={() => setToast('Print laporan siap diproses')}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              <Printer size={16} />
              Print
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Dropdown label="Tipe Laporan" value={reportType} options={REPORT_TYPES} onChange={setReportType} />
            <Dropdown label="Cabang" value={branch} options={BRANCHES} onChange={setBranch} />
            <Dropdown label="Status" value={status} options={STATUSES} onChange={setStatus} />
            <div>
              <label htmlFor="member-filter" className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Member / Pasien
              </label>
              <input
                id="member-filter"
                value={member}
                onChange={(event) => setMember(event.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="Cari member"
              />
              {member && (
                <button type="button" className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {member}
                </button>
              )}
            </div>
            <div>
              <label htmlFor="start-date" className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Tanggal Mulai
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Tanggal Akhir
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label htmlFor="doctor-filter" className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Dokter
              </label>
              <input
                id="doctor-filter"
                value={doctor}
                onChange={(event) => setDoctor(event.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="Cari dokter"
              />
              {doctor && (
                <button type="button" className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {doctor}
                </button>
              )}
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={generateReport}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
              >
                <FileText size={16} />
                Generate Laporan
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="h-11 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateReport}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              Terapkan Filter
            </button>
            <button
              type="button"
              onClick={generateReport}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              <Table2 size={16} />
              Table
            </button>
            <button
              type="button"
              onClick={() => {
                setGenerated(true);
                setEmpty(false);
                setViewMode('chart');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              <BarChart3 size={16} />
              Chart
            </button>
          </div>
        </section>

        <section
          data-report-content
          className="report-content rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold">Laporan {reportType}</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {startDate || 'Awal'} sampai {endDate || 'hari ini'} - {branch}
              </p>
            </div>
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Total {reportType}: {empty ? '0' : rows.length}
            </div>
          </div>

          {!generated && (
            <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Pilih filter lalu generate laporan.
            </div>
          )}

          {generated && empty && (
            <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Tidak ada data laporan untuk filter ini.
            </div>
          )}

          {generated && !empty && viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  <tr>
                    <th className="py-3 pr-4">Nama</th>
                    <th className="py-3 pr-4">Cabang</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.name}-${row.branch}`} data-row className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-4 pr-4 font-semibold">{row.name}</td>
                      <td className="py-4 pr-4">{row.branch}</td>
                      <td className="py-4 pr-4">{row.status}</td>
                      <td className="py-4 pr-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {generated && !empty && viewMode === 'chart' && (
            <div data-chart className="flex min-h-[260px] flex-col justify-end rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <canvas
                width={720}
                height={220}
                className="h-[220px] w-full rounded-md bg-gradient-to-r from-emerald-100 via-amber-100 to-sky-100 dark:from-emerald-500/20 dark:via-amber-500/20 dark:to-sky-500/20"
                aria-label={`Chart laporan ${reportType}`}
              />
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Aktif: 128</span>
                <span>Selesai: 64</span>
                <span>Pending: 32</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {panel === 'schedule' && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Jadwal Laporan</h2>
              <button type="button" aria-label="Tutup" onClick={() => setPanel(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4">
              <Dropdown label="Frekuensi" value={frequency} options={FREQUENCIES} onChange={setFrequency} />
              <div>
                <label htmlFor="schedule-time" className="mb-2 block text-sm font-medium">
                  Waktu
                </label>
                <input id="schedule-time" type="time" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <div>
                <label htmlFor="schedule-recipients" className="mb-2 block text-sm font-medium">
                  Penerima
                </label>
                <input id="schedule-recipients" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="manager@example.com" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setToast('Berhasil menyimpan jadwal laporan');
                  setPanel(null);
                }}
                className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
              >
                Simpan Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {panel === 'email' && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Email Laporan</h2>
              <button type="button" aria-label="Tutup" onClick={() => setPanel(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4">
              <div>
                <label htmlFor="email-recipients" className="mb-2 block text-sm font-medium">
                  Penerima
                </label>
                <input id="email-recipients" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <div>
                <label htmlFor="email-subject" className="mb-2 block text-sm font-medium">
                  Subject
                </label>
                <input id="email-subject" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <div>
                <label htmlFor="email-message" className="mb-2 block text-sm font-medium">
                  Pesan
                </label>
                <textarea id="email-message" rows={4} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setToast('Berhasil terkirim');
                  setPanel(null);
                }}
                className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
              >
                Kirim Email
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ExportMenu({ onExport }: { onExport: (format: 'pdf' | 'xlsx' | 'csv') => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
      >
        <Download size={16} />
        Export
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExport('xlsx');
              setOpen(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            Excel
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExport('csv');
              setOpen(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            CSV
          </button>
        </div>
      )}
    </div>
  );
}
