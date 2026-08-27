'use client';

import { useEffect, useMemo, useState } from 'react';
import { BriefcaseMedical, CheckCircle2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';

type StaffOption = {
  id: string;
  email: string;
  role: string;
  staffCode: string | null;
  branchId: string | null;
  profile: { fullName: string; phone: string | null } | null;
};
type BranchOption = { id: string; branchCode: string; name: string };

export function EnrollEmployeeMemberModal({ isOpen, onClose, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [staffUserId, setStaffUserId] = useState('');
  const [registrationBranchId, setRegistrationBranchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedStaff = useMemo(() => staff.find((item) => item.id === staffUserId), [staff, staffUserId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    api.get('/members/employees/enrollment-options')
      .then(({ data }) => {
        if (cancelled) return;
        setStaff(data.data.staff || []);
        setBranches(data.data.branches || []);
      })
      .catch((error) => {
        assertCaughtError(error);
        showToast.error(error.response?.data?.error?.message || 'Gagal memuat daftar karyawan');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const chooseStaff = (id: string) => {
    setStaffUserId(id);
    setRegistrationBranchId(staff.find((item) => item.id === id)?.branchId || '');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffUserId || !registrationBranchId) return;
    try {
      setSubmitting(true);
      const { data } = await api.post('/members/employees/enroll', { staffUserId, registrationBranchId });
      showToast.success(data.data.message);
      onSuccess();
      onClose();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mendaftarkan karyawan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><BriefcaseMedical /></span>
            <div><h2 className="text-xl font-bold">Daftarkan Karyawan sebagai Member</h2><p className="text-sm text-neutral-500">Khusus akun staf RAHO yang sudah aktif.</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg border p-2"><X size={18} /></button>
        </div>

        <div className="my-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="font-bold">Yang otomatis berlaku:</p>
          <ul className="mt-2 space-y-1">
            <li>✓ Login dan role staf tidak berubah.</li>
            <li>✓ Sesi default Basic, gratis, tanpa voucher atau tagihan.</li>
            <li>✓ Namanya dapat dicari dari cabang mana pun.</li>
            <li>✓ Therapy Plan wajib dibuat sebelum sesi pertama dan dapat diedit tim layanan.</li>
          </ul>
        </div>

        <label className="block text-sm font-semibold">Karyawan</label>
        <select value={staffUserId} onChange={(event) => chooseStaff(event.target.value)} disabled={loading} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3">
          <option value="">{loading ? 'Memuat...' : 'Pilih karyawan'}</option>
          {staff.map((item) => <option key={item.id} value={item.id}>{item.profile?.fullName || item.email} · {item.role}</option>)}
        </select>
        {selectedStaff && <p className="mt-1 text-xs text-neutral-500">{selectedStaff.staffCode || 'Tanpa kode staf'} · {selectedStaff.email}</p>}

        <label className="mt-4 block text-sm font-semibold">Cabang pendaftaran</label>
        <select value={registrationBranchId} onChange={(event) => setRegistrationBranchId(event.target.value)} className="mt-2 w-full rounded-xl border bg-transparent px-3 py-3">
          <option value="">Pilih cabang</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchCode} · {branch.name}</option>)}
        </select>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2">Batal</button>
          <button type="submit" disabled={submitting || loading || !staffUserId || !registrationBranchId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"><CheckCircle2 size={17} />{submitting ? 'Menyimpan...' : 'Aktifkan Member Gratis'}</button>
        </div>
      </form>
    </div>
  );
}
