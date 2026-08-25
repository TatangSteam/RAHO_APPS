'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { showToast } from '@/lib/toast';

type Report = Awaited<ReturnType<typeof sessionApi.getWorkflowBurden>>;

const duration = (seconds: number) => {
  if (!seconds) return '0 dtk';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} m ${remainder} dtk` : `${remainder} dtk`;
};

export default function SessionWorkflowAuditPage() {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionApi.getWorkflowBurden()
      .then(setReport)
      .catch(() => showToast.error('Gagal memuat audit beban pengisian sesi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Memuat audit workflow...</div>;
  if (!report) return <div className="p-8 text-center">Data audit belum tersedia.</div>;

  const targetRate = report.summary.samples
    ? Math.round((report.summary.underThreeMinutes / report.summary.samples) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Beban Pengisian Sesi</h1>
          <p className="mt-1 text-sm text-neutral-500">Waktu aktif, error validasi, retry completion, serta langkah paling berat dalam 30 hari terakhir.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => router.push('/sessions')}>Kembali ke Sesi</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Sampel pengguna/sesi" value={String(report.summary.samples)} />
        <Metric label="Sesi unik" value={String(report.summary.uniqueSessions)} />
        <Metric label="Rata-rata waktu aktif" value={duration(report.summary.averageActiveSeconds)} />
        <Metric label="Error validasi" value={String(report.summary.validationErrors)} />
        <Metric label="≤ 3 menit" value={`${targetRate}%`} />
      </section>

      {report.summary.samples < 10 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          Sampel belum cukup. Lakukan UAT minimal 5–10 sesi nyata per peran sebelum menyimpulkan beban pengisian.
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <AuditTable title="Menurut peran" headers={['Peran', 'Sampel', 'Rata-rata', 'Validasi', 'Retry']} rows={report.roles.map((row) => [row.role, row.samples, duration(row.averageActiveSeconds), row.validationErrors, row.completionRetries])} />
        <AuditTable title="Menurut langkah" headers={['Langkah', 'Sampel', 'Rata-rata']} rows={report.steps.map((row) => [`${row.step}. ${row.label}`, row.samples, duration(row.averageSeconds)])} />
      </section>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <strong>Cara membaca:</strong> prioritaskan langkah dengan waktu rata-rata tertinggi, error validasi berulang, atau retry completion. Target awal: input setelah tindakan selesai dalam 2–3 menit dan tanpa bantuan operator lain.
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><small className="text-neutral-500">{label}</small><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}

function AuditTable({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"><h2 className="p-4 text-lg font-semibold">{title}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-neutral-100 dark:bg-neutral-800"><tr>{headers.map((header) => <th key={header} className="p-3 text-left">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-t border-neutral-200 dark:border-neutral-800">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}</tr>) : <tr><td className="p-4 text-neutral-500" colSpan={headers.length}>Belum ada sampel</td></tr>}</tbody></table></div></div>;
}
