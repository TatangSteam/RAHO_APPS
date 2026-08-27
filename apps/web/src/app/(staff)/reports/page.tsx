'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  FileText,
  Mail,
  Printer,
  RefreshCw,
  Table2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { branchesApi } from '@/lib/api/branchesApi';
import { doctorBranchApi } from '@/lib/api/doctorBranchApi';
import { sessionApi } from '@/lib/sessionApi';
import { getMembersApi } from '@/lib/membersApi';
import { invoiceApi } from '@/lib/invoiceApi';
import { logisticsReportApi } from '@/lib/logisticsReportApi';
import { devError } from '@/lib/logger';
import { ReportAccessDenied } from '@/components/reports/ReportAccessDenied';
import { ReportDropdown } from '@/components/reports/ReportDropdown';
import { ReportEmailDialog } from '@/components/reports/ReportEmailDialog';
import { ReportExportMenu } from '@/components/reports/ReportExportMenu';
import { ReportResults } from '@/components/reports/ReportResults';
import { ReportScheduleDialog } from '@/components/reports/ReportScheduleDialog';
import {
  REPORT_STATUSES,
  REPORT_TYPES,
  buildInventoryReportRows,
  buildMemberReportRows,
  buildPaymentReportRows,
  buildSessionReportRows,
  exportReportFile,
  isFutureStartDate,
  type ReportBranch,
  type ReportExportFormat,
  type ReportFrequency,
  type ReportPanel,
  type ReportRow,
  type ReportStatus,
  type ReportType,
  type ReportViewMode,
} from '@/lib/reportPresentation';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const canAccess = role === 'SUPER_ADMIN' || role === 'ADMIN_MANAGER' || role === 'ADMIN_CABANG';

  const [reportType, setReportType] = useState<ReportType>('Member');
  const [branch, setBranch] = useState<ReportBranch>('Semua Cabang');
  const [status, setStatus] = useState<ReportStatus>('Semua Status');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [member, setMember] = useState('');
  const [doctor, setDoctor] = useState('');
  const [staff, setStaff] = useState('');
  const [generated, setGenerated] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [viewMode, setViewMode] = useState<ReportViewMode>('table');
  const [panel, setPanel] = useState<ReportPanel>(null);
  const [frequency, setFrequency] = useState<ReportFrequency>('Daily');
  const [toast, setToast] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [branchIdsByName, setBranchIdsByName] = useState<Record<string, string>>({});
  const [branchCodesByName, setBranchCodesByName] = useState<Record<string, string>>({});
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    let active = true;

    const loadBranches = async () => {
      try {
        setBranchesLoading(true);
        const branchRecords = role === 'ADMIN_MANAGER'
          ? (await doctorBranchApi.getManagedBranches(false)).map((item) => ({ id: item.branchId, name: item.branchName, code: item.branchCode }))
          : ((await branchesApi.getAllBranches()).data?.data || [])
              .filter((item) => item.isActive)
              .map((item) => ({ id: item.id, name: item.name, code: item.branchCode }));

        if (active) {
          setBranches(Array.from(new Set(branchRecords.map((item) => item.name))));
          setBranchIdsByName(Object.fromEntries(branchRecords.map((item) => [item.name, item.id])));
          setBranchCodesByName(Object.fromEntries(branchRecords.map((item) => [item.name, item.code])));
        }
      } catch (error) {
        devError('Gagal memuat cabang laporan:', error);
        if (active) {
          setBranches([]);
          setToast('Gagal memuat daftar cabang. Silakan refresh.');
        }
      } finally {
        if (active) setBranchesLoading(false);
      }
    };

    void loadBranches();
    return () => {
      active = false;
    };
  }, [role]);

  const branchOptions = useMemo(() => ['Semua Cabang', ...branches], [branches]);

  const generateReport = async () => {
    if (isFutureStartDate(startDate)) {
      setRows([]);
      setEmpty(true);
      setGenerated(true);
      setViewMode('table');
      return;
    }

    try {
      setGenerating(true);
      setToast('');
      let nextRows;
      if (reportType === 'Session') {
        nextRows = buildSessionReportRows(await sessionApi.getAllSessions({
            limit: 1000,
            ...(branch !== 'Semua Cabang' ? { branchId: branchIdsByName[branch] } : {}),
            ...(startDate ? { dateFrom: startDate } : {}),
            ...(endDate ? { dateTo: endDate } : {}),
            status: 'all',
          }), { status, member, doctor, staff });
      } else if (reportType === 'Member') {
        const memberParams = {
          limit: 100,
          ...(member ? { search: member } : {}),
          ...(branch !== 'Semua Cabang' && branchCodesByName[branch]
            ? { branchCode: branchCodesByName[branch] }
            : {}),
        };
        const firstPage = await getMembersApi(memberParams);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) =>
            getMembersApi({ ...memberParams, page: index + 2 })),
        );
        const members = [firstPage, ...remainingPages].flatMap((page) => page.members);
        nextRows = buildMemberReportRows(
          branch === 'Semua Cabang' || branchCodesByName[branch]
            ? members
            : members.filter((item) => item.registrationBranch === branch),
          { status, member, startDate, endDate },
        );
      } else if (reportType === 'Payment') {
        const invoiceParams = {
          search: member || undefined,
          limit: 100,
          ...(branch !== 'Semua Cabang' ? { branchId: branchIdsByName[branch] } : {}),
          ...(startDate ? { dateFrom: startDate } : {}),
          ...(endDate ? { dateTo: endDate } : {}),
        };
        const firstPage = await invoiceApi.getInvoices(invoiceParams);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) =>
            invoiceApi.getInvoices({ ...invoiceParams, page: index + 2 })),
        );
        const invoices = [firstPage, ...remainingPages].flatMap((page) => page.data);
        nextRows = buildPaymentReportRows(
          invoices.filter((item) => branch === 'Semua Cabang' || item.branchId === branchIdsByName[branch]),
          { status, member, startDate, endDate },
        );
      } else {
        const inventoryParams = {
          ...(branch !== 'Semua Cabang' ? { branchId: branchIdsByName[branch] } : {}),
          limit: 100,
        };
        const firstPage = await logisticsReportApi.valuation(inventoryParams);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, firstPage.meta.totalPages - 1) }, (_, index) =>
            logisticsReportApi.valuation({ ...inventoryParams, page: index + 2 })),
        );
        nextRows = buildInventoryReportRows(
          [firstPage, ...remainingPages].flatMap((page) => page.data),
          { status, member },
        );
      }

      setRows(nextRows);
      setEmpty(nextRows.length === 0);
      setGenerated(true);
      setViewMode('table');
    } catch (error) {
      devError('Gagal generate laporan:', error);
      setRows([]);
      setEmpty(true);
      setGenerated(true);
      setToast('Gagal memuat data laporan. Silakan coba lagi.');
    } finally {
      setGenerating(false);
    }
  };

  const resetFilters = () => {
    setBranch('Semua Cabang');
    setStatus('Semua Status');
    setStartDate('');
    setEndDate('');
    setMember('');
    setDoctor('');
    setStaff('');
    setEmpty(false);
    setGenerated(false);
    setRows([]);
  };

  const exportReport = async (format: ReportExportFormat) => {
    try {
      await exportReportFile(reportType, rows, format);
    } catch (error) {
      devError('Gagal mengekspor laporan:', error);
      setToast('Gagal mengekspor laporan. Silakan coba lagi.');
    }
  };

  if (!canAccess) {
    return <ReportAccessDenied />;
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
            <ReportExportMenu onExport={exportReport} />
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
            <ReportDropdown label="Tipe Laporan" value={reportType} options={REPORT_TYPES} onChange={setReportType} />
            <ReportDropdown
              label={branchesLoading ? 'Cabang (memuat...)' : 'Cabang'}
              value={branch}
              options={branchOptions}
              onChange={setBranch}
            />
            <ReportDropdown label="Status" value={status} options={REPORT_STATUSES} onChange={setStatus} />
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
            <div>
              <label htmlFor="staff-filter" className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Staff
              </label>
              <input
                id="staff-filter"
                value={staff}
                onChange={(event) => setStaff(event.target.value)}
                disabled={reportType !== 'Session'}
                className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-amber-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:disabled:bg-neutral-800"
                placeholder={reportType === 'Session' ? 'Cari dokter, nakes, atau admin' : 'Khusus laporan sesi'}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void generateReport()}
                disabled={generating || branchesLoading}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
              >
                <FileText size={16} />
                {generating ? 'Memuat...' : 'Generate Laporan'}
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
              onClick={() => void generateReport()}
              disabled={generating || branchesLoading}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
            >
              Terapkan Filter
            </button>
            <button
              type="button"
              onClick={() => void generateReport()}
              disabled={generating || branchesLoading}
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

        <ReportResults
          reportType={reportType}
          branch={branch}
          startDate={startDate}
          endDate={endDate}
          generated={generated}
          empty={empty}
          viewMode={viewMode}
          rows={rows}
        />
      </div>

      {panel === 'schedule' && (
        <ReportScheduleDialog
          frequency={frequency}
          onFrequencyChange={setFrequency}
          onClose={() => setPanel(null)}
          onSave={() => {
            setToast('Berhasil menyimpan jadwal laporan');
            setPanel(null);
          }}
        />
      )}

      {panel === 'email' && (
        <ReportEmailDialog
          onClose={() => setPanel(null)}
          onSend={() => {
            setToast('Berhasil terkirim');
            setPanel(null);
          }}
        />
      )}
    </main>
  );
}
