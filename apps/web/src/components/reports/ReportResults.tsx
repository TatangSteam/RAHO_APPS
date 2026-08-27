import type { ReportRow, ReportType, ReportViewMode } from '@/lib/reportPresentation';

interface ReportResultsProps {
  reportType: ReportType;
  branch: string;
  startDate: string;
  endDate: string;
  generated: boolean;
  empty: boolean;
  viewMode: ReportViewMode;
  rows: ReportRow[];
}

export function ReportResults({
  reportType,
  branch,
  startDate,
  endDate,
  generated,
  empty,
  viewMode,
  rows,
}: ReportResultsProps) {
  const statusCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] || 0) + Number(row.total || 0);
    return counts;
  }, {});
  return (
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
            <span>Selesai: {statusCounts.Completed || 0}</span>
            <span>Pending: {statusCounts.Pending || 0}</span>
            <span>Dibatalkan: {statusCounts.Cancelled || 0}</span>
          </div>
        </div>
      )}
    </section>
  );
}
