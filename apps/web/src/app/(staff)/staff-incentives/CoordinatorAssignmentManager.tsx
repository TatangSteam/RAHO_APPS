'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import {
  usersApi,
  type ChsCoordinatorAssignment,
  type ChsCoordinatorAssignmentInput,
  type ChsCoordinatorAssignmentOptions,
} from '@/lib/usersApi';

interface Props {
  branchId: string;
  month: string;
  onChanged: () => void;
}

export function CoordinatorAssignmentManager({ branchId, month, onChanged }: Props) {
  const [assignments, setAssignments] = useState<ChsCoordinatorAssignment[]>([]);
  const [options, setOptions] = useState<ChsCoordinatorAssignmentOptions>({ staff: [], teams: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<'TEAM' | 'BRANCH'>('TEAM');
  const [coordinatorUserId, setCoordinatorUserId] = useState('');
  const [homecareTeamId, setHomecareTeamId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(`${month}-01`);
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setScope('TEAM');
    setCoordinatorUserId('');
    setHomecareTeamId('');
    setEffectiveFrom(`${month}-01`);
    setEffectiveUntil('');
    setNotes('');
    setEditingAssignmentId(null);
  }, [month]);

  const load = useCallback(async () => {
    if (!branchId || branchId === 'all') {
      setAssignments([]);
      setOptions({ staff: [], teams: [] });
      return;
    }
    try {
      setLoading(true);
      const [assignmentRows, optionRows] = await Promise.all([
        usersApi.getChsCoordinatorAssignments({ month, branchId }),
        usersApi.getChsCoordinatorAssignmentOptions(branchId),
      ]);
      setAssignments(assignmentRows);
      setOptions(optionRows);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat pengaturan Koordinator CHS.');
    } finally {
      setLoading(false);
    }
  }, [branchId, month]);

  useEffect(() => { resetForm(); }, [branchId, resetForm]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: ChsCoordinatorAssignmentInput = {
      scope,
      coordinatorUserId,
      branchId,
      homecareTeamId: scope === 'TEAM' ? homecareTeamId : undefined,
      effectiveFrom,
      effectiveUntil: effectiveUntil || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      setSaving(true);
      if (editingAssignmentId) {
        await usersApi.updateChsCoordinatorAssignment(editingAssignmentId, payload);
        showToast.success('Assignment Koordinator CHS berhasil diperbarui.');
      } else {
        await usersApi.createChsCoordinatorAssignment(payload);
        showToast.success('Assignment Koordinator CHS berhasil ditambahkan.');
      }
      resetForm();
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menyimpan Koordinator CHS.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (assignment: ChsCoordinatorAssignment) => {
    setEditingAssignmentId(assignment.id);
    setScope(assignment.scope);
    setCoordinatorUserId(assignment.coordinatorUserId);
    setHomecareTeamId(assignment.homecareTeamId || '');
    setEffectiveFrom(assignment.effectiveFrom.slice(0, 10));
    setEffectiveUntil(assignment.effectiveUntil?.slice(0, 10) || '');
    setNotes(assignment.notes || '');
  };

  const remove = async (assignment: ChsCoordinatorAssignment) => {
    const coordinatorName = assignment.coordinator.profile?.fullName || assignment.coordinator.email;
    if (!window.confirm(
      `Hapus assignment ${coordinatorName}? Assignment yang sudah berjalan akan diakhiri tanpa menghapus histori insentif.`,
    )) return;

    try {
      await usersApi.deactivateChsCoordinatorAssignment(assignment.id);
      if (editingAssignmentId === assignment.id) resetForm();
      showToast.success('Assignment Koordinator CHS berhasil dihapus atau diakhiri.');
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghapus assignment.');
    }
  };

  if (!branchId || branchId === 'all') {
    return (
      <div className="rounded-2xl border border-dashed border-violet-300 p-5 text-sm text-neutral-500">
        Pilih satu cabang pada filter di atas untuk menambah, mengedit, atau menghapus Koordinator CHS.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-violet-500" />
        <div>
          <h2 className="font-bold text-neutral-900 dark:text-white">Pengaturan Koordinator</h2>
          <p className="text-sm text-neutral-500">
            Tetapkan koordinator untuk cabang yang dipilih atau untuk tim Homecare di cabang tersebut.
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void submit(event)} className="grid gap-3 lg:grid-cols-6">
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as 'TEAM' | 'BRANCH')}
          aria-label="Scope assignment"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="TEAM">Tim Homecare</option>
          <option value="BRANCH">Cabang</option>
        </select>
        <select
          required
          value={coordinatorUserId}
          onChange={(event) => setCoordinatorUserId(event.target.value)}
          aria-label="Koordinator CHS"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">Pilih koordinator</option>
          {options.staff.map((staff) => (
            <option key={staff.id} value={staff.id}>{staff.fullName} ({staff.role})</option>
          ))}
        </select>
        {scope === 'TEAM' ? (
          <select
            required
            value={homecareTeamId}
            onChange={(event) => setHomecareTeamId(event.target.value)}
            aria-label="Tim Homecare"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="">Pilih tim</option>
            {options.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        ) : (
          <div className="flex items-center rounded-xl bg-neutral-100 px-3 text-sm text-neutral-500 dark:bg-neutral-800">
            Seluruh cabang terpilih
          </div>
        )}
        <input
          required
          type="date"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          aria-label="Berlaku mulai"
          title="Berlaku mulai"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <input
          type="date"
          value={effectiveUntil}
          onChange={(event) => setEffectiveUntil(event.target.value)}
          aria-label="Berlaku sampai"
          title="Berlaku sampai (opsional)"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingAssignmentId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingAssignmentId ? 'Simpan' : 'Tambah'}
        </button>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          placeholder="Catatan assignment (opsional)"
          aria-label="Catatan assignment"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950 lg:col-span-5"
        />
        {editingAssignmentId ? (
          <button
            type="button"
            onClick={resetForm}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" /> Batal edit
          </button>
        ) : <div />}
      </form>

      <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
        {loading ? (
          <p className="py-4 text-sm text-neutral-500">Memuat assignment...</p>
        ) : assignments.map((assignment) => {
          const coordinatorName = assignment.coordinator.profile?.fullName || assignment.coordinator.email;
          return (
            <div key={assignment.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-neutral-900 dark:text-white">{coordinatorName}</strong>
                  {!assignment.isActive && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500 dark:bg-neutral-800">
                      Nonaktif
                    </span>
                  )}
                </div>
                <span className="text-neutral-500">
                  {assignment.scope === 'TEAM' ? assignment.homecareTeam?.name : assignment.branch.name}
                  {' · '}{assignment.effectiveFrom.slice(0, 10)} s/d {assignment.effectiveUntil?.slice(0, 10) || 'seterusnya'}
                </span>
                {assignment.notes && <small className="block text-neutral-400">{assignment.notes}</small>}
              </div>
              {assignment.isActive && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => edit(assignment)}
                    title="Edit assignment"
                    aria-label={`Edit assignment ${coordinatorName}`}
                    className="rounded-lg p-2 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(assignment)}
                    title="Hapus assignment"
                    aria-label={`Hapus assignment ${coordinatorName}`}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && assignments.length === 0 && (
          <p className="py-4 text-sm text-neutral-500">Belum ada assignment pada periode ini.</p>
        )}
      </div>
    </section>
  );
}
