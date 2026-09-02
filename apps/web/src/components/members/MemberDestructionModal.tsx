'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';
import type { MemberDetail } from '@/types/member';
import {
  destroyMemberApi,
  getMemberDestructionPreviewApi,
  type MemberDestructionPreview,
} from '@/lib/membersApi';
import { assertCaughtError } from '@/lib/caughtError';
import { devError } from '@/lib/logger';
import { showToast } from '@/lib/toast';

type Props = {
  open: boolean;
  memberId: string;
  member: MemberDetail;
  onClose: () => void;
  onDestroyed: () => void;
};

const countLabels: Record<keyof MemberDestructionPreview['counts'], string> = {
  sessions: 'Sesi terapi',
  packages: 'Paket',
  invoices: 'Invoice',
  diagnoses: 'Diagnosis',
  therapyPlans: 'Therapy plan',
  labResults: 'Hasil lab',
  documents: 'Dokumen',
  addOns: 'Add-on',
  nonTherapyPurchases: 'Pembelian non-terapi',
};

export default function MemberDestructionModal({ open, memberId, member, onClose, onDestroyed }: Props) {
  const [preview, setPreview] = useState<MemberDestructionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const [memberNoInput, setMemberNoInput] = useState('');
  const [phraseInput, setPhraseInput] = useState('');
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setMemberNoInput('');
    setPhraseInput('');
    setUnderstood(false);
    setLoading(true);
    void getMemberDestructionPreviewApi(memberId)
      .then(setPreview)
      .catch((error) => {
        assertCaughtError(error);
        devError('Member destruction preview error:', error);
        showToast.error(error.response?.data?.error?.message || 'Gagal memuat preview penghapusan');
      })
      .finally(() => setLoading(false));
  }, [memberId, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const exactMemberNo = preview?.member.memberNo || member.memberNo;
  const canDestroy = Boolean(
    preview?.allowed && understood && memberNoInput === exactMemberNo && phraseInput === 'DESTRUCTION MEMBER',
  );

  const handleDestroy = async () => {
    if (!canDestroy || destroying) return;
    try {
      setDestroying(true);
      const result = await destroyMemberApi(memberId, {
        confirmation: 'DESTRUCTION MEMBER',
        memberNo: memberNoInput,
        deleteFinancialAndInventory: true,
      });
      showToast.success(result.message);
      onDestroyed();
    } catch (error) {
      assertCaughtError(error);
      devError('Destruction Member error:', error);
      showToast.error(
        error.response?.data?.error?.message || error.response?.data?.message || 'Destruction Member gagal',
      );
    } finally {
      setDestroying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div aria-modal="true" role="dialog" aria-labelledby="member-destruction-title" className="w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-red-600 bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center justify-between bg-red-700 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <ShieldAlert size={28} />
            <div>
              <h2 id="member-destruction-title" className="text-xl font-black">Destruction Member</h2>
              <p className="text-xs text-red-100">Penghapusan permanen khusus Super Admin</p>
            </div>
          </div>
          <button type="button" aria-label="Tutup" disabled={destroying} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <p className="font-black">Data {member.profile?.fullName || member.memberNo} akan dihapus permanen.</p>
            <p className="mt-1">Sesi dan stok akan dikembalikan terlebih dahulu. Setelah itu seluruh data klinis, paket, invoice, pembayaran, jurnal, dan riwayat inventory terkait akan dihapus permanen.</p>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-neutral-500">
              <Loader2 className="animate-spin" size={20} /> Memeriksa seluruh relasi data...
            </div>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(preview.counts).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                    <p className="text-[11px] font-bold text-neutral-500">{countLabels[key as keyof typeof countLabels]}</p>
                    <p className="text-xl font-black text-neutral-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              {!preview.allowed && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-200"><AlertTriangle size={18} /> Destruction diblokir</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">
                    {preview.blockers.map((item) => <li key={item.code}>{item.message} ({item.count})</li>)}
                  </ul>
                </div>
              )}

              {preview.allowed && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    Ketik nomor member <span className="font-mono text-red-600">{exactMemberNo}</span>
                    <input value={memberNoInput} onChange={(event) => setMemberNoInput(event.target.value)} disabled={destroying} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono outline-none focus:border-red-500 dark:border-neutral-700 dark:bg-neutral-950" />
                  </label>
                  <label className="block text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    Ketik <span className="font-mono text-red-600">DESTRUCTION MEMBER</span>
                    <input value={phraseInput} onChange={(event) => setPhraseInput(event.target.value.toUpperCase())} disabled={destroying} className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono outline-none focus:border-red-500 dark:border-neutral-700 dark:bg-neutral-950" />
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} disabled={destroying} className="mt-0.5 h-4 w-4" />
                    Saya memahami data member, keuangan, jurnal, dan inventory akan dihapus permanen dan tidak dapat dipulihkan.
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950/50">
          <button type="button" disabled={destroying} onClick={onClose} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold dark:border-neutral-700">Batal</button>
          <button type="button" disabled={!canDestroy || destroying} onClick={handleDestroy} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40">
            {destroying ? <Loader2 className="animate-spin" size={17} /> : <Trash2 size={17} />}
            {destroying ? 'Menghancurkan data...' : 'Jalankan Destruction Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
