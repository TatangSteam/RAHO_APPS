'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Stethoscope, Trash2, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import {
  usersApi,
  type DoctorHeadAssignment,
  type DoctorHeadAssignmentOptions,
} from '@/lib/usersApi';

interface Props {
  month: string;
  onChanged: () => void;
}

const emptyOptions: DoctorHeadAssignmentOptions = { doctors: [], branches: [] };

export function DoctorHeadAssignmentManager({ month, onChanged }: Props) {
  const [assignments, setAssignments] = useState<DoctorHeadAssignment[]>([]);
  const [options, setOptions] = useState(emptyOptions);
  const [doctorHeadUserId, setDoctorHeadUserId] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(`${month}-01`);
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setDoctorHeadUserId('');
    setSelectedBranchIds([]);
    setEffectiveFrom(`${month}-01`);
    setEffectiveUntil('');
    setNotes('');
    setEditingId(null);
  }, [month]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [assignmentRows, optionRows] = await Promise.all([
        usersApi.getDoctorHeadAssignments({ month }),
        usersApi.getDoctorHeadAssignmentOptions(),
      ]);
      setAssignments(assignmentRows);
      setOptions(optionRows);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat pengaturan Dokter Head.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!editingId) setEffectiveFrom(`${month}-01`); }, [editingId, month]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranchIds((current) => editingId
      ? [branchId]
      : current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!doctorHeadUserId || selectedBranchIds.length === 0) {
      showToast.error('Pilih Dokter Head dan minimal satu cabang.');
      return;
    }
    try {
      setSaving(true);
      const common = {
        doctorHeadUserId,
        effectiveFrom,
        ...(effectiveUntil ? { effectiveUntil } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      if (editingId) {
        await usersApi.updateDoctorHeadAssignment(editingId, { ...common, branchId: selectedBranchIds[0] });
        showToast.success('Assignment Dokter Head berhasil diperbarui.');
      } else {
        await usersApi.createDoctorHeadBranchAssignments({ ...common, branchIds: selectedBranchIds });
        showToast.success(`${selectedBranchIds.length} cabang berhasil ditetapkan.`);
      }
      resetForm();
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menyimpan assignment Dokter Head.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (assignment: DoctorHeadAssignment) => {
    setEditingId(assignment.id);
    setDoctorHeadUserId(assignment.doctorHeadUserId);
    setSelectedBranchIds([assignment.branchId]);
    setEffectiveFrom(assignment.effectiveFrom.slice(0, 10));
    setEffectiveUntil(assignment.effectiveUntil?.slice(0, 10) || '');
    setNotes(assignment.notes || '');
  };

  const remove = async (assignment: DoctorHeadAssignment) => {
    const doctorName = assignment.doctorHead.profile?.fullName || assignment.doctorHead.email;
    if (!window.confirm(`Hapus assignment ${doctorName} untuk ${assignment.branch.name}?`)) return;
    try {
      await usersApi.deactivateDoctorHeadAssignment(assignment.id);
      showToast.success('Assignment Dokter Head berhasil dihapus.');
      if (editingId === assignment.id) resetForm();
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghapus assignment Dokter Head.');
    }
  };

  return (
    <section className="rounded-2xl border border-cyan-200 bg-white p-5 dark:border-cyan-500/25 dark:bg-neutral-900">
      <div className="mb-5 flex items-start gap-3">
        <Stethoscope className="mt-0.5 h-5 w-5 text-cyan-500" />
        <div>
          <h2 className="font-bold text-neutral-900 dark:text-white">Pengaturan Dokter Head</h2>
          <p className="text-sm text-neutral-500">Pilih dokter terlebih dahulu, lalu tetapkan satu atau beberapa cabang.</p>
          <p className="text-xs text-cyan-600 dark:text-cyan-400">Hanya Super Admin yang dapat menambah, mengedit, dan menghapus assignment.</p>
        </div>
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          1. Dokter Head
          <select required value={doctorHeadUserId} onChange={(event) => setDoctorHeadUserId(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal normal-case dark:border-neutral-700 dark:bg-neutral-950">
            <option value="">Pilih dokter</option>
            {options.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName} ({doctor.staffCode || doctor.email})</option>)}
          </select>
        </label>

        <fieldset disabled={!doctorHeadUserId} className="rounded-xl border border-neutral-200 p-4 disabled:opacity-50 dark:border-neutral-700">
          <div className="mb-3 flex items-center justify-between gap-3">
            <legend className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-cyan-500" />2. Pilih cabang {editingId ? '(satu cabang)' : '(boleh lebih dari satu)'}</legend>
            {!editingId && <div className="flex gap-2 text-xs"><button type="button" onClick={() => setSelectedBranchIds(options.branches.map((branch) => branch.id))} className="text-cyan-600 hover:underline">Pilih semua</button><button type="button" onClick={() => setSelectedBranchIds([])} className="text-neutral-500 hover:underline">Kosongkan</button></div>}
          </div>
          <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {options.branches.map((branch) => <label key={branch.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${selectedBranchIds.includes(branch.id) ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300' : 'border-neutral-200 dark:border-neutral-700'}`}>
              <input type="checkbox" checked={selectedBranchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="accent-cyan-600" />
              <span><strong className="block">{branch.name}</strong><small className="text-neutral-500">{branch.branchCode} · {branch.type}</small></span>
            </label>)}
          </div>
        </fieldset>

        <div className="grid gap-3 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Berlaku mulai<input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950" /></label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Berlaku sampai (opsional)<input type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950" /></label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Catatan (opsional)<input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal normal-case dark:border-neutral-700 dark:bg-neutral-950" /></label>
        </div>

        <div className="flex justify-end gap-2">
          {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700"><X className="h-4 w-4" />Batal edit</button>}
          <button disabled={saving || loading || !doctorHeadUserId || selectedBranchIds.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? 'Simpan perubahan' : `Tetapkan ${selectedBranchIds.length || ''} cabang`}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <h3 className="mb-2 text-sm font-bold">Assignment pada periode ini</h3>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {loading ? <p className="py-4 text-sm text-neutral-500">Memuat assignment...</p> : assignments.map((assignment) => {
            const doctorName = assignment.doctorHead.profile?.fullName || assignment.doctorHead.email;
            return <div key={assignment.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><div className="flex flex-wrap items-center gap-2"><strong>{doctorName}</strong><span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">{assignment.branch.name}</span>{!assignment.isActive && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">Nonaktif</span>}</div><span className="text-neutral-500">{assignment.effectiveFrom.slice(0, 10)} s/d {assignment.effectiveUntil?.slice(0, 10) || 'seterusnya'}</span>{assignment.notes && <small className="block text-neutral-400">{assignment.notes}</small>}</div>{assignment.isActive && <div className="flex"><button type="button" onClick={() => edit(assignment)} aria-label={`Edit ${doctorName}`} className="rounded-lg p-2 text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-500/10"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void remove(assignment)} aria-label={`Hapus ${doctorName}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>}</div>;
          })}
          {!loading && assignments.length === 0 && <p className="py-4 text-sm text-neutral-500">Belum ada assignment Dokter Head pada periode ini.</p>}
        </div>
      </div>
    </section>
  );
}
