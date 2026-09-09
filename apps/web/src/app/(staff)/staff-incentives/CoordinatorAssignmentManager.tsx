'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Settings2, Trash2 } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import {
  usersApi,
  type ChsCoordinatorAssignment,
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

  const load = useCallback(async () => {
    if (!branchId || branchId === 'all') return;
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

  useEffect(() => { setEffectiveFrom(`${month}-01`); }, [month]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await usersApi.createChsCoordinatorAssignment({
        scope,
        coordinatorUserId,
        branchId,
        homecareTeamId: scope === 'TEAM' ? homecareTeamId : undefined,
        effectiveFrom,
        effectiveUntil: effectiveUntil || undefined,
      });
      showToast.success('Assignment Koordinator CHS berhasil ditambahkan.');
      setCoordinatorUserId('');
      setHomecareTeamId('');
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menambahkan Koordinator CHS.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (assignment: ChsCoordinatorAssignment) => {
    if (!window.confirm(`Nonaktifkan assignment ${assignment.coordinator.profile?.fullName || assignment.coordinator.email}?`)) return;
    try {
      await usersApi.deactivateChsCoordinatorAssignment(assignment.id);
      showToast.success('Assignment Koordinator CHS dinonaktifkan.');
      await load();
      onChanged();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menonaktifkan assignment.');
    }
  };

  if (!branchId || branchId === 'all') {
    return <div className="rounded-2xl border border-dashed border-violet-300 p-5 text-sm text-neutral-500">Pilih satu cabang untuk mengatur Koordinator CHS.</div>;
  }

  return <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <div className="mb-4 flex items-center gap-2"><Settings2 className="h-5 w-5 text-violet-500" /><div><h2 className="font-bold text-neutral-900 dark:text-white">Pengaturan Koordinator</h2><p className="text-sm text-neutral-500">Tetapkan satu koordinator untuk scope tim Homecare atau cabang pada periode tertentu.</p></div></div>
    <form onSubmit={(event) => void submit(event)} className="grid gap-3 lg:grid-cols-6">
      <select value={scope} onChange={(event) => setScope(event.target.value as 'TEAM' | 'BRANCH')} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"><option value="TEAM">Tim Homecare</option><option value="BRANCH">Cabang</option></select>
      <select required value={coordinatorUserId} onChange={(event) => setCoordinatorUserId(event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"><option value="">Pilih koordinator</option>{options.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName} ({staff.role})</option>)}</select>
      {scope === 'TEAM' ? <select required value={homecareTeamId} onChange={(event) => setHomecareTeamId(event.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"><option value="">Pilih tim</option>{options.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select> : <div className="flex items-center rounded-xl bg-neutral-100 px-3 text-sm text-neutral-500 dark:bg-neutral-800">Seluruh cabang</div>}
      <input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} aria-label="Berlaku mulai" title="Berlaku mulai" className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
      <input type="date" value={effectiveUntil} onChange={(event) => setEffectiveUntil(event.target.value)} aria-label="Berlaku sampai" title="Berlaku sampai (opsional)" className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
      <button disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Tambah</button>
    </form>
    <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
      {loading ? <p className="py-4 text-sm text-neutral-500">Memuat assignment...</p> : assignments.map((assignment) => <div key={assignment.id} className="flex items-center justify-between gap-4 py-3 text-sm"><div><strong className="text-neutral-900 dark:text-white">{assignment.coordinator.profile?.fullName || assignment.coordinator.email}</strong><span className="ml-2 text-neutral-500">{assignment.scope === 'TEAM' ? assignment.homecareTeam?.name : assignment.branch.name} · {assignment.effectiveFrom.slice(0, 10)} s/d {assignment.effectiveUntil?.slice(0, 10) || 'seterusnya'}</span></div>{assignment.isActive && <button type="button" onClick={() => void deactivate(assignment)} title="Nonaktifkan" className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>}</div>)}
      {!loading && assignments.length === 0 && <p className="py-4 text-sm text-neutral-500">Belum ada assignment pada periode ini.</p>}
    </div>
  </section>;
}
