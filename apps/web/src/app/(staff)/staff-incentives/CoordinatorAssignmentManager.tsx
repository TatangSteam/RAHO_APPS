'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import {
  usersApi,
  type ChsCoordinatorAssignment,
  type ChsCoordinatorAssignmentInput,
  type ChsCoordinatorAssignmentOptions,
} from '@/lib/usersApi';

interface Props {
  month: string;
  onChanged: () => void;
}

const emptyOptions: ChsCoordinatorAssignmentOptions = { staff: [], teams: [], branches: [] };

export function CoordinatorAssignmentManager({ month, onChanged }: Props) {
  const [assignments, setAssignments] = useState<ChsCoordinatorAssignment[]>([]);
  const [options, setOptions] = useState<ChsCoordinatorAssignmentOptions>(emptyOptions);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<'TEAM' | 'BRANCH'>('BRANCH');
  const [coordinatorUserId, setCoordinatorUserId] = useState('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [homecareTeamId, setHomecareTeamId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(`${month}-01`);
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setScope('BRANCH');
    setCoordinatorUserId('');
    setSelectedBranchIds([]);
    setHomecareTeamId('');
    setEffectiveFrom(`${month}-01`);
    setEffectiveUntil('');
    setNotes('');
    setEditingAssignmentId(null);
  }, [month]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [assignmentRows, optionRows] = await Promise.all([
        usersApi.getChsCoordinatorAssignments({ month }),
        usersApi.getChsCoordinatorAssignmentOptions(),
      ]);
      setAssignments(assignmentRows);
      setOptions(optionRows);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat pengaturan Koordinator CHS.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { resetForm(); }, [resetForm]);
  useEffect(() => { void load(); }, [load]);

  const selectedBranchId = selectedBranchIds[0] || '';
  const availableTeams = useMemo(
    () => options.teams.filter((team) => team.branchId === selectedBranchId),
    [options.teams, selectedBranchId],
  );
  const assignmentGroups = useMemo(() => {
    const groups = new Map<string, ChsCoordinatorAssignment[]>();
    assignments.forEach((assignment) => {
      groups.set(assignment.coordinatorUserId, [
        ...(groups.get(assignment.coordinatorUserId) || []),
        assignment,
      ]);
    });
    return Array.from(groups.values());
  }, [assignments]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranchIds((current) => (
      current.includes(branchId)
        ? current.filter((id) => id !== branchId)
        : scope === 'TEAM' || editingAssignmentId ? [branchId] : [...current, branchId]
    ));
    setHomecareTeamId('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedBranchIds.length === 0) {
      showToast.error('Pilih minimal satu cabang.');
      return;
    }
    if (scope === 'TEAM' && !homecareTeamId) {
      showToast.error('Pilih Tim Homecare.');
      return;
    }

    try {
      setSaving(true);
      if (editingAssignmentId) {
        const payload: ChsCoordinatorAssignmentInput = {
          scope,
          coordinatorUserId,
          branchId: selectedBranchId,
          homecareTeamId: scope === 'TEAM' ? homecareTeamId : undefined,
          effectiveFrom,
          effectiveUntil: effectiveUntil || undefined,
          notes: notes.trim() || undefined,
        };
        await usersApi.updateChsCoordinatorAssignment(editingAssignmentId, payload);
        showToast.success('Assignment Koordinator CHS berhasil diperbarui.');
      } else if (scope === 'BRANCH') {
        await usersApi.createChsCoordinatorBranchAssignments({
          coordinatorUserId,
          branchIds: selectedBranchIds,
          effectiveFrom,
          effectiveUntil: effectiveUntil || undefined,
          notes: notes.trim() || undefined,
        });
        showToast.success(`${selectedBranchIds.length} cabang berhasil ditetapkan ke Koordinator CHS.`);
      } else {
        await usersApi.createChsCoordinatorAssignment({
          scope,
          coordinatorUserId,
          branchId: selectedBranchId,
          homecareTeamId,
          effectiveFrom,
          effectiveUntil: effectiveUntil || undefined,
          notes: notes.trim() || undefined,
        });
        showToast.success('Tim Homecare berhasil ditetapkan ke Koordinator CHS.');
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
    setCoordinatorUserId(assignment.coordinatorUserId);
    setScope(assignment.scope);
    setSelectedBranchIds([assignment.branchId]);
    setHomecareTeamId(assignment.homecareTeamId || '');
    setEffectiveFrom(assignment.effectiveFrom.slice(0, 10));
    setEffectiveUntil(assignment.effectiveUntil?.slice(0, 10) || '');
    setNotes(assignment.notes || '');
  };

  const remove = async (assignment: ChsCoordinatorAssignment) => {
    const coordinatorName = assignment.coordinator.profile?.fullName || assignment.coordinator.email;
    if (!window.confirm(
      `Hapus permanen ${assignment.branch.name} dari koordinasi ${coordinatorName}? Data ini tidak dapat dipulihkan.`,
    )) return;

    try {
      await usersApi.deleteChsCoordinatorAssignment(assignment.id);
      if (editingAssignmentId === assignment.id) resetForm();
      showToast.success('Assignment Koordinator CHS berhasil dihapus permanen.');
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghapus assignment.');
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-violet-500" />
        <div>
          <h2 className="font-bold text-neutral-900 dark:text-white">Pengaturan Koordinator CHS</h2>
          <p className="text-sm text-neutral-500">
            Pilih orang terlebih dahulu, kemudian tetapkan satu atau beberapa cabang yang dikoordinasikan.
          </p>
          <p className="text-xs text-neutral-500">Satu cabang dapat ditangani oleh lebih dari satu Koordinator CHS.</p>
          <p className="text-xs text-violet-500">Filter cabang pada laporan tidak membatasi panel pengaturan ini.</p>
        </div>
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            1. Koordinator CHS
            <select
              required
              value={coordinatorUserId}
              onChange={(event) => setCoordinatorUserId(event.target.value)}
              aria-label="Koordinator CHS"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal normal-case dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="">Pilih orang</option>
              {options.staff.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.fullName} ({staff.role})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Jenis koordinasi
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as 'TEAM' | 'BRANCH');
                setSelectedBranchIds([]);
                setHomecareTeamId('');
              }}
              aria-label="Jenis koordinasi"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal normal-case dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="BRANCH">Cabang (bisa pilih banyak)</option>
              <option value="TEAM">Tim Homecare (pilih satu tim)</option>
            </select>
          </label>
        </div>

        <fieldset disabled={!coordinatorUserId} className="rounded-xl border border-neutral-200 p-4 disabled:opacity-50 dark:border-neutral-700">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <legend className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              <Building2 className="h-4 w-4 text-violet-500" />
              2. Pilih cabang {scope === 'BRANCH' && !editingAssignmentId ? '(boleh lebih dari satu)' : '(satu cabang)'}
            </legend>
            {scope === 'BRANCH' && !editingAssignmentId && (
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setSelectedBranchIds(options.branches.map((branch) => branch.id))} className="text-violet-600 hover:underline">Pilih semua</button>
                <button type="button" onClick={() => setSelectedBranchIds([])} className="text-neutral-500 hover:underline">Kosongkan</button>
              </div>
            )}
          </div>
          <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {options.branches.map((branch) => (
              <label key={branch.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                selectedBranchIds.includes(branch.id)
                  ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-500/10 dark:text-violet-300'
                  : 'border-neutral-200 dark:border-neutral-700'
              }`}>
                <input
                  type="checkbox"
                  checked={selectedBranchIds.includes(branch.id)}
                  onChange={() => toggleBranch(branch.id)}
                  className="accent-violet-600"
                />
                <span><strong className="block">{branch.name}</strong><small className="text-neutral-500">{branch.branchCode}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        {scope === 'TEAM' && selectedBranchId && (
          <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            3. Tim Homecare
            <select
              required
              value={homecareTeamId}
              onChange={(event) => setHomecareTeamId(event.target.value)}
              aria-label="Tim Homecare"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal normal-case dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="">Pilih tim</option>
              {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.incentiveType === 'HO' ? 'Team HO' : 'Homecare'})</option>)}
            </select>
          </label>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Berlaku mulai
            <input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950" />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Berlaku sampai (opsional)
            <input type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-neutral-700 dark:bg-neutral-950" />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Catatan (opsional)
            <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Catatan assignment" className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-normal normal-case dark:border-neutral-700 dark:bg-neutral-950" />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          {editingAssignmentId && (
            <button type="button" onClick={resetForm} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold dark:border-neutral-700">
              <X className="h-4 w-4" /> Batal edit
            </button>
          )}
          <button disabled={saving || loading || !coordinatorUserId} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingAssignmentId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingAssignmentId
              ? 'Simpan perubahan'
              : scope === 'TEAM'
                ? 'Tetapkan tim'
                : selectedBranchIds.length > 0
                  ? `Tetapkan ${selectedBranchIds.length} cabang`
                  : 'Tetapkan cabang'}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <h3 className="mb-2 text-sm font-bold text-neutral-900 dark:text-white">Assignment pada periode ini</h3>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {loading ? <p className="py-4 text-sm text-neutral-500">Memuat assignment...</p> : assignmentGroups.flatMap((group) => group).map((assignment) => {
            const coordinatorName = assignment.coordinator.profile?.fullName || assignment.coordinator.email;
            return (
              <div key={assignment.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-neutral-900 dark:text-white">{coordinatorName}</strong>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">{assignment.branch.name}</span>
                    {!assignment.isActive && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">Nonaktif</span>}
                  </div>
                  <span className="text-neutral-500">
                    {assignment.scope === 'TEAM' ? assignment.homecareTeam?.name : 'Seluruh cabang'}
                    {' · '}{assignment.effectiveFrom.slice(0, 10)} s/d {assignment.effectiveUntil?.slice(0, 10) || 'seterusnya'}
                  </span>
                  {assignment.notes && <small className="block text-neutral-400">{assignment.notes}</small>}
                </div>
                <div className="flex items-center gap-1">
                  {assignment.isActive && <button type="button" onClick={() => edit(assignment)} title="Edit assignment" aria-label={`Edit assignment ${coordinatorName} ${assignment.branch.name}`} className="rounded-lg p-2 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10"><Pencil className="h-4 w-4" /></button>}
                  <button type="button" onClick={() => void remove(assignment)} title="Hapus permanen assignment" aria-label={`Hapus permanen assignment ${coordinatorName} ${assignment.branch.name}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
          {!loading && assignments.length === 0 && <p className="py-4 text-sm text-neutral-500">Belum ada assignment pada periode ini.</p>}
        </div>
      </div>
    </section>
  );
}
