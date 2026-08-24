'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Camera, HeartHandshake, ListChecks, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { reimbursementApi, type Reimbursement } from '@/lib/reimbursementApi';
import { socialProgramApi, type SocialProgram } from '@/lib/socialProgramApi';
import { showToast } from '@/lib/toast';
import { workflowApi, type ApprovalInstance } from '@/lib/workflowApi';

const rupiah = (value: string | number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
type Selection = { kind: 'reimbursement'; data: Reimbursement } | { kind: 'social'; data: SocialProgram };

export default function ApprovalInboxPage() {
  const [rows, setRows] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [failedActivations, setFailedActivations] = useState<SocialProgram[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, failed] = await Promise.all([
        workflowApi.inbox(),
        socialProgramApi.list({ status: 'ACTIVATION_FAILED' }).catch(() => []),
      ]);
      setRows(result.data);
      setFailedActivations(failed);
    }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Gagal memuat approval.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (row: ApprovalInstance) => {
    try {
      if (row.entityType === 'Reimbursement') setSelected({ kind: 'reimbursement', data: await reimbursementApi.detail(row.entityId) });
      else if (row.entityType === 'SocialProgramRequest') setSelected({ kind: 'social', data: await socialProgramApi.detail(row.entityId) });
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Detail approval gagal dimuat.');
    }
  };

  const decide = async (decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION') => {
    if (!selected || (selected.kind === 'social' && decision === 'RETURN_FOR_REVISION')) return;
    let note: string | undefined;
    if (decision !== 'APPROVE') {
      note = window.prompt(decision === 'REJECT' ? 'Alasan penolakan' : 'Perbaikan yang harus dilakukan') || undefined;
      if (!note) return;
    }
    try {
      let activationFailed = false;
      if (selected.kind === 'reimbursement') await reimbursementApi.decide(selected.data.id, decision, note);
      else {
        const result = await socialProgramApi.decide(selected.data.id, decision as 'APPROVE' | 'REJECT', note);
        if (result.request.status === 'ACTIVATION_FAILED') {
          activationFailed = true;
          showToast.error(`Approval tersimpan, tetapi paket gagal dibuat: ${result.request.activationError || 'coba aktivasi ulang.'}`);
        }
      }
      if (!activationFailed) showToast.success(decision === 'APPROVE' ? 'Keputusan approval tersimpan.' : 'Pengajuan ditolak.');
      setSelected(null);
      await load();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Keputusan gagal disimpan.');
    }
  };

  const retryActivation = async (id: string) => {
    try {
      const result = await socialProgramApi.retryActivation(id);
      if (result.request.status === 'ACTIVE') showToast.success('Paket Program Sosial berhasil dibuat.');
      else showToast.error(result.request.activationError || 'Aktivasi paket belum berhasil.');
      await load();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Aktivasi ulang gagal.');
    }
  };

  const evidence = async (attachmentId: string) => {
    if (!selected || selected.kind !== 'reimbursement') return;
    try { const result = await reimbursementApi.attachment(selected.data.id, attachmentId); window.open(result.url, '_blank', 'noopener,noreferrer'); }
    catch (error) { assertCaughtError(error); showToast.error(error.response?.data?.error?.message || 'Bukti tidak dapat dibuka.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <header><h1 className="flex items-center gap-2 text-2xl font-semibold"><ListChecks /> Approval Inbox</h1><p className="text-sm text-neutral-500">Antrian lintas modul berdasarkan cabang, nominal, dan tahap aktif.</p></header>
    {failedActivations.length > 0 && <section className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"><h2 className="font-semibold text-red-700 dark:text-red-300">Program Sosial gagal membuat paket</h2><p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">Approval sudah selesai. Finance dapat mencoba aktivasi ulang tanpa membuat paket ganda.</p><div className="space-y-2">{failedActivations.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3 text-sm dark:bg-neutral-900"><div><b>{item.requestNumber} · {item.member.user.profile?.fullName || item.member.memberNo}</b><small className="block text-red-600">{item.activationError || 'Aktivasi gagal'}</small></div><button type="button" onClick={() => void retryActivation(item.id)} className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">Coba aktivasi</button></div>)}</div></section>}
    {loading ? <p>Memuat…</p> : <div className="overflow-x-auto rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900"><table className="w-full min-w-[900px] text-sm"><thead><tr className="text-left text-xs uppercase text-neutral-500"><th className="p-3">Dokumen</th><th className="p-3">Pengaju/Cabang</th><th className="p-3">Modul</th><th className="p-3 text-right">Nominal</th><th className="p-3">Tahap aktif</th><th className="p-3">Audit</th><th className="p-3">Aksi</th></tr></thead><tbody>{rows.map((row) => {
      const step = row.rule.steps.find((item) => item.stepNo === row.currentStep);
      const reviewable = row.entityType === 'Reimbursement' || row.entityType === 'SocialProgramRequest';
      return <tr className="border-t dark:border-neutral-800" key={row.id}><td className="p-3"><b>{row.entityNumber || row.entityId}</b><small className="block text-neutral-500">{row.entityType === 'SocialProgramRequest' ? 'Program Sosial' : row.entityType}</small></td><td className="p-3">{row.maker?.profile?.fullName || row.maker?.email || row.makerUserId}<small className="block text-neutral-500">{row.branch ? `${row.branch.branchCode} — ${row.branch.name}` : row.branchId}</small></td><td className="p-3">{row.module}<small className="block text-neutral-500">{row.rule.name}</small></td><td className="p-3 text-right font-semibold">{rupiah(row.amount)}</td><td className="p-3">{row.currentStep}. {step?.name}<small className="block text-neutral-500">{step?.permissionCode}</small></td><td className="p-3">{row.auditLogs.length} event</td><td className="p-3">{reviewable ? <button type="button" onClick={() => void open(row)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black">Review</button> : <span className="text-xs text-neutral-500">Buka dari modul asal</span>}</td></tr>;
    })}</tbody></table>{rows.length === 0 && <p className="p-6 text-center text-neutral-500">Tidak ada approval yang menunggu.</p>}</div>}
    {selected?.kind === 'reimbursement' && <ReimbursementModal selected={selected.data} onClose={() => setSelected(null)} onEvidence={evidence} onDecide={decide} />}
    {selected?.kind === 'social' && <SocialModal selected={selected.data} onClose={() => setSelected(null)} onDecide={decide} />}
  </div>;
}

function ReimbursementModal({ selected, onClose, onEvidence, onDecide }: { selected: Reimbursement; onClose: () => void; onEvidence: (id: string) => Promise<void>; onDecide: (decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION') => Promise<void> }) {
  return <Modal title={selected.reimbursementNumber} subtitle={`${selected.branch.branchCode} · ${selected.claimant.profile?.fullName || selected.claimant.email}`} onClose={onClose}>
    <div className="grid gap-3 sm:grid-cols-2"><Info label="Jumlah" value={rupiah(selected.amount)} /><Info label="Tanggal" value={new Date(selected.expenseDate).toLocaleDateString('id-ID')} /><Info label="Kategori" value={selected.category} /><Info label="Metode penerimaan" value={selected.paymentMethod === 'BANK_TRANSFER' ? 'Transfer bank' : 'Tunai'} /><div className="sm:col-span-2"><Info label="Keterangan" value={selected.description} /></div></div>
    <section className="mt-5"><h3 className="mb-2 font-semibold">Foto bukti ({selected.attachments.length})</h3><div className="flex flex-wrap gap-2">{selected.attachments.map((item, index) => <button key={item.id} type="button" onClick={() => void onEvidence(item.id)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Camera size={16} /> Buka foto {index + 1}</button>)}</div></section>
    <DecisionButtons allowRevision onDecide={onDecide} />
  </Modal>;
}

function SocialModal({ selected, onClose, onDecide }: { selected: SocialProgram; onClose: () => void; onDecide: (decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION') => Promise<void> }) {
  const memberName = selected.member.user.profile?.fullName || selected.member.memberNo;
  return <Modal title={selected.requestNumber} subtitle={`${selected.branch.branchCode} · ${memberName}`} onClose={onClose}>
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30"><HeartHandshake className="text-rose-500" /><span><b>SRV-TNB-TRP-PS-001</b><small className="block">Terapi Nano Bubble 1X (Program Sosial)</small></span></div>
    <div className="grid gap-3 sm:grid-cols-2"><Info label="Basic sosial" value={`${selected.basicSessions} sesi × ${rupiah(selected.basicSocialUnitPrice)}`} /><Info label="Dibayar member" value={rupiah(selected.totals.payableTotal)} /><Info label="Subsidi Basic" value={rupiah(selected.totals.basicSubsidy)} /><Info label="Booster gratis" value={selected.freeBooster ? `${selected.boosterType} · ${selected.freeBoosterSessions} sesi` : 'Tidak ada'} /><Info label="Subsidi Booster" value={rupiah(selected.totals.boosterSubsidy)} /><Info label="Total subsidi" value={rupiah(selected.totals.totalSubsidy)} /><div className="sm:col-span-2"><Info label="Alasan" value={selected.reason} /></div></div>
    <section className="mt-4 rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800"><b>{selected.approvalInstance?.rule.name}</b><p className="text-neutral-500">Tahap {selected.approvalInstance?.currentStep}: {selected.approvalInstance?.rule.steps.find((item) => item.stepNo === selected.approvalInstance?.currentStep)?.name}</p></section>
    <DecisionButtons onDecide={onDecide} />
  </Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-neutral-500">{subtitle}</p></div><button type="button" aria-label="Tutup" onClick={onClose} className="rounded-lg border p-2"><X size={18} /></button></div>{children}</div></div>; }
function DecisionButtons({ allowRevision = false, onDecide }: { allowRevision?: boolean; onDecide: (decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_REVISION') => Promise<void> }) { return <div className="mt-5 flex flex-wrap justify-end gap-2">{allowRevision && <button type="button" onClick={() => void onDecide('RETURN_FOR_REVISION')} className="rounded-lg border border-amber-500 px-4 py-2 text-sm">Minta perbaikan</button>}<button type="button" onClick={() => void onDecide('REJECT')} className="rounded-lg border border-red-500 px-4 py-2 text-sm text-red-600">Tolak</button><button type="button" onClick={() => void onDecide('APPROVE')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Setujui</button></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><small className="block text-neutral-500">{label}</small><span>{value}</span></div>; }
