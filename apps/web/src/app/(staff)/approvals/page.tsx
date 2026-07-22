'use client';

import { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { workflowApi, type ApprovalInstance } from '@/lib/workflowApi';
import { showToast } from '@/lib/toast';

export default function ApprovalInboxPage() {
  const [rows, setRows] = useState<ApprovalInstance[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { workflowApi.inbox().then((result) => setRows(result.data)).catch((error) => showToast.error(error.response?.data?.error?.message || 'Gagal memuat approval.')).finally(() => setLoading(false)); }, []);
  return <div className="mx-auto max-w-7xl space-y-5"><header><h1 className="flex items-center gap-2 text-2xl font-semibold"><ListChecks/> Approval Inbox</h1><p className="text-sm text-neutral-500">Antrian lintas modul berdasarkan rule, branch scope, nominal, dan tahap aktif.</p></header>{loading ? <p>Memuat…</p> : <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-3">Dokumen</th><th className="p-3">Modul</th><th className="p-3">Nominal</th><th className="p-3">Tahap aktif</th><th className="p-3">Audit</th></tr></thead><tbody>{rows.map((row) => { const step = row.rule.steps.find((item) => item.stepNo === row.currentStep); return <tr className="border-t" key={row.id}><td className="p-3"><b>{row.entityNumber || row.entityId}</b><small className="block text-neutral-500">{row.entityType}</small></td><td className="p-3">{row.module}<small className="block">{row.rule.name}</small></td><td className="p-3">Rp {row.amount}</td><td className="p-3">{row.currentStep}. {step?.name}<small className="block text-neutral-500">{step?.permissionCode}</small></td><td className="p-3">{row.auditLogs.length} event</td></tr>; })}</tbody></table>{rows.length === 0 && <p className="p-6 text-center text-neutral-500">Tidak ada approval yang menunggu.</p>}</div>}</div>;
}
