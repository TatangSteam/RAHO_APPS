'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, ListChecks, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { reimbursementApi, type Reimbursement } from '@/lib/reimbursementApi';
import { showToast } from '@/lib/toast';
import { workflowApi, type ApprovalInstance } from '@/lib/workflowApi';

const rupiah = (value: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));

export default function ApprovalInboxPage() {
  const [rows, setRows] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Reimbursement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await workflowApi.inbox(); setRows(result.data); }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Gagal memuat approval.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (row: ApprovalInstance) => {
    if (row.entityType !== 'Reimbursement') return;
    try { setSelected(await reimbursementApi.detail(row.entityId)); }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Detail reimburse gagal dimuat.'); }
  };

  const decide = async (decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION') => {
    if (!selected) return;
    let note: string | undefined;
    if (decision !== 'APPROVE') {
      note = window.prompt(decision === 'REJECT' ? 'Alasan penolakan' : 'Perbaikan yang harus dilakukan') || undefined;
      if (!note) return;
    }
    try {
      await reimbursementApi.decide(selected.id, decision, note);
      showToast.success(decision === 'APPROVE' ? 'Keputusan approval tersimpan.' : decision === 'REJECT' ? 'Reimburse ditolak.' : 'Reimburse dikembalikan untuk diperbaiki.');
      setSelected(null); await load();
    } catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Keputusan gagal disimpan.'); }
  };

  const evidence = async (attachmentId: string) => {
    if (!selected) return;
    try { const result = await reimbursementApi.attachment(selected.id, attachmentId); window.open(result.url, '_blank', 'noopener,noreferrer'); }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Bukti tidak dapat dibuka.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <header><h1 className="flex items-center gap-2 text-2xl font-semibold"><ListChecks /> Approval Inbox</h1><p className="text-sm text-neutral-500">Antrian lintas modul berdasarkan rule, branch scope, nominal, dan tahap aktif.</p></header>
    {loading ? <p>Memuat…</p> : <div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full min-w-[900px] text-sm"><thead><tr className="text-left text-xs uppercase text-neutral-500"><th className="p-3">Dokumen</th><th className="p-3">Pengaju/Cabang</th><th className="p-3">Modul</th><th className="p-3 text-right">Nominal</th><th className="p-3">Tahap aktif</th><th className="p-3">Audit</th><th className="p-3">Aksi</th></tr></thead><tbody>{rows.map((row) => {
      const step = row.rule.steps.find((item) => item.stepNo === row.currentStep);
      return <tr className="border-t dark:border-neutral-800" key={row.id}><td className="p-3"><b>{row.entityNumber || row.entityId}</b><small className="block text-neutral-500">{row.entityType}</small></td><td className="p-3">{row.maker?.profile?.fullName || row.maker?.email || row.makerUserId}<small className="block text-neutral-500">{row.branch ? `${row.branch.branchCode} — ${row.branch.name}` : row.branchId}</small></td><td className="p-3">{row.module}<small className="block text-neutral-500">{row.rule.name}</small></td><td className="p-3 text-right font-semibold">{rupiah(row.amount)}</td><td className="p-3">{row.currentStep}. {step?.name}<small className="block text-neutral-500">{step?.permissionCode}</small></td><td className="p-3">{row.auditLogs.length} event</td><td className="p-3">{row.entityType === 'Reimbursement' ? <button type="button" onClick={() => void open(row)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black">Review</button> : <span className="text-xs text-neutral-500">Buka dari modul asal</span>}</td></tr>;
    })}</tbody></table>{rows.length === 0 && <p className="p-6 text-center text-neutral-500">Tidak ada approval yang menunggu.</p>}</div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.reimbursementNumber}</h2><p className="text-sm text-neutral-500">{selected.branch.branchCode} · {selected.claimant.profile?.fullName || selected.claimant.email}</p></div><button type="button" aria-label="Tutup" onClick={() => setSelected(null)} className="rounded-lg border p-2"><X size={18} /></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Jumlah" value={rupiah(selected.amount)} /><Info label="Tanggal" value={new Date(selected.expenseDate).toLocaleDateString('id-ID')} /><Info label="Kategori" value={selected.category} /><Info label="Metode penerimaan" value={selected.paymentMethod === 'BANK_TRANSFER' ? 'Transfer bank' : 'Tunai'} /><div className="sm:col-span-2"><Info label="Keterangan" value={selected.description} /></div>{selected.paymentMethod === 'BANK_TRANSFER' && <><Info label="Bank tujuan" value={selected.recipientBankName || '-'} /><Info label="Rekening penerima" value={`${selected.recipientAccountNumber || '-'} · ${selected.recipientAccountHolder || '-'}`} /></>}</div>
      <section className="mt-5"><h3 className="mb-2 font-semibold">Foto bukti ({selected.attachments.length})</h3><div className="flex flex-wrap gap-2">{selected.attachments.map((item, index) => <button key={item.id} type="button" onClick={() => void evidence(item.id)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Camera size={16} /> Buka foto {index + 1}<small className="text-neutral-500">{Math.ceil(item.fileSize / 1024)} KB</small></button>)}</div></section>
      <section className="mt-5 rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800"><strong>{selected.approvalInstance?.rule.name}</strong><p className="text-neutral-500">Tahap {selected.approvalInstance?.currentStep}: {selected.approvalInstance?.rule.steps.find((item) => item.stepNo === selected.approvalInstance?.currentStep)?.name}</p></section>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void decide('RETURN_FOR_REVISION')} className="rounded-lg border border-amber-500 px-4 py-2 text-sm">Minta perbaikan</button><button type="button" onClick={() => void decide('REJECT')} className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-600">Tolak</button><button type="button" onClick={() => void decide('APPROVE')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Setujui</button></div>
    </div></div>}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><small className="block text-neutral-500">{label}</small><span>{value}</span></div>; }
