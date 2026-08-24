'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { socialProgramApi, type CreateSocialProgramData } from '@/lib/socialProgramApi';
import { showToast } from '@/lib/toast';

const BASIC_LIST = 2_000_000;
const BASIC_SOCIAL = 500_000;
const BOOSTER_LIST = 1_000_000;
const BOOSTERS = [
  ['NO', 'NO'], ['GT', 'GT'], ['MB', 'MB'], ['KCL', 'KCL'],
  ['H2S', 'H2S'], ['HK', 'H2S Konsentrat'], ['O3', 'O3'],
] as const;
const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export default function SocialProgramModal({
  show,
  memberId,
  branchId,
  memberName,
  onClose,
  onSubmitted,
}: {
  show: boolean;
  memberId: string;
  branchId: string;
  memberName: string;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({ basicSessions: 1, freeBooster: false, boosterType: 'NO' as CreateSocialProgramData['boosterType'], freeBoosterSessions: 1, reason: '' });
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (show) setForm({ basicSessions: 1, freeBooster: false, boosterType: 'NO', freeBoosterSessions: 1, reason: '' });
  }, [show]);
  const total = useMemo(() => ({
    payable: BASIC_SOCIAL * form.basicSessions,
    basicSubsidy: (BASIC_LIST - BASIC_SOCIAL) * form.basicSessions,
    boosterSubsidy: form.freeBooster ? BOOSTER_LIST * form.freeBoosterSessions : 0,
  }), [form.basicSessions, form.freeBooster, form.freeBoosterSessions]);
  if (!show) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.freeBoosterSessions > form.basicSessions) {
      showToast.error('Kuota Booster tidak boleh melebihi jumlah sesi Basic.');
      return;
    }
    try {
      setSubmitting(true);
      await socialProgramApi.create({
        memberId,
        branchId,
        basicSessions: form.basicSessions,
        freeBooster: form.freeBooster,
        boosterType: form.freeBooster ? form.boosterType : undefined,
        freeBoosterSessions: form.freeBooster ? form.freeBoosterSessions : 0,
        reason: form.reason,
      });
      showToast.success('Pengajuan sosial dikirim ke Admin Manager dan Finance.');
      onClose();
      await onSubmitted();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Pengajuan sosial gagal dibuat.');
    } finally { setSubmitting(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold"><HeartHandshake className="text-rose-500" /> Ajukan Program Sosial</h2><p className="text-sm text-neutral-500">{memberName} · SRV-TNB-TRP-PS-001</p></div><button type="button" aria-label="Tutup" onClick={onClose} className="rounded-lg border p-2"><X size={18} /></button></div>
      <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30"><b>Alur singkat:</b> Ajukan → Admin Manager setuju → Finance setuju → paket dan invoice otomatis dibuat. Data lama tidak berubah.</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-medium">Jumlah sesi Basic</span><input required type="number" min={1} max={100} value={form.basicSessions} onChange={(e) => setForm((v) => ({ ...v, basicSessions: Math.max(1, Number(e.target.value)) }))} className="w-full rounded-lg border bg-transparent px-3 py-2" /><small className="text-neutral-500">Harga sosial {rupiah(BASIC_SOCIAL)} per sesi</small></label>
        <div className="rounded-xl border p-3 text-sm"><small className="text-neutral-500">Harga Basic normal</small><p>{rupiah(BASIC_LIST)} × {form.basicSessions}</p><small className="text-neutral-500">Dibayar member</small><p className="font-bold text-emerald-600">{rupiah(total.payable)}</p></div>
      </div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4"><input type="checkbox" checked={form.freeBooster} onChange={(e) => setForm((v) => ({ ...v, freeBooster: e.target.checked }))} className="mt-1" /><span><b>Sertakan Booster gratis</b><small className="block text-neutral-500">Booster tetap dicatat dengan harga normal Rp1.000.000 dan diskon 100%, sehingga stok/HPP tetap terlacak.</small></span></label>
      {form.freeBooster && <div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm"><span className="mb-1 block font-medium">Jenis Booster</span><select value={form.boosterType} onChange={(e) => setForm((v) => ({ ...v, boosterType: e.target.value as CreateSocialProgramData['boosterType'] }))} className="w-full rounded-lg border bg-transparent px-3 py-2">{BOOSTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm"><span className="mb-1 block font-medium">Kuota Booster gratis</span><input type="number" min={1} max={form.basicSessions} value={form.freeBoosterSessions} onChange={(e) => setForm((v) => ({ ...v, freeBoosterSessions: Math.max(1, Number(e.target.value)) }))} className="w-full rounded-lg border bg-transparent px-3 py-2" /></label></div>}
      <label className="mt-5 block text-sm"><span className="mb-1 block font-medium">Alasan Program Sosial</span><textarea required minLength={8} maxLength={500} rows={3} value={form.reason} onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))} className="w-full rounded-lg border bg-transparent px-3 py-2" placeholder="Contoh: hasil asesmen sosial dan persetujuan program…" /></label>
      <div className="mt-5 grid gap-2 rounded-xl bg-neutral-100 p-4 text-sm dark:bg-neutral-800"><Line label="Subsidi Basic" value={rupiah(total.basicSubsidy)} /><Line label="Subsidi Booster" value={rupiah(total.boosterSubsidy)} /><Line label="Total subsidi untuk approval" value={rupiah(total.basicSubsidy + total.boosterSubsidy)} strong /><Line label="Total dibayar member" value={rupiah(total.payable)} strong /></div>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Batal</button><button disabled={submitting} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{submitting ? 'Mengirim…' : 'Ajukan Program Sosial'}</button></div>
    </form>
  </div>;
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between gap-3 ${strong ? 'font-bold' : ''}`}><span>{label}</span><span>{value}</span></div>; }
