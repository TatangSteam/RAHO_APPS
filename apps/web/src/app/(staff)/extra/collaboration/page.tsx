'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { showToast } from '@/lib/toast';
import {
  collaborationApi,
  type CollaborationBootstrap,
  type CollaborationTask,
  type TaskPriority,
  type TaskStatus,
  type Team,
} from '@/lib/collaborationApi';
import { useAuthStore } from '@/stores/authStore';
import styles from './page.module.css';

const EMPTY_DATA: CollaborationBootstrap = {
  teams: [], selectedTeamId: null, tasks: [], users: [], activities: [],
  stats: { total: 0, todo: 0, inProgress: 0, submitted: 0, completed: 0, overdue: 0 },
};

const STATUS_META: Record<TaskStatus, { label: string; tone: string }> = {
  TODO: { label: 'Belum dimulai', tone: 'slate' },
  IN_PROGRESS: { label: 'Dikerjakan', tone: 'blue' },
  SUBMITTED: { label: 'Menunggu review', tone: 'amber' },
  NEEDS_REVISION: { label: 'Perlu revisi', tone: 'rose' },
  COMPLETED: { label: 'Selesai', tone: 'green' },
  CANCELLED: { label: 'Dibatalkan', tone: 'slate' },
};

const PRIORITY_META: Record<TaskPriority, { label: string; tone: string }> = {
  LOW: { label: 'Rendah', tone: 'slate' },
  MEDIUM: { label: 'Sedang', tone: 'blue' },
  HIGH: { label: 'Tinggi', tone: 'amber' },
  URGENT: { label: 'Mendesak', tone: 'rose' },
};

function getView(pathname: string): 'dashboard' | 'tasks' | 'teams' {
  if (pathname.endsWith('/tasks')) return 'tasks';
  if (pathname.endsWith('/teams')) return 'teams';
  return 'dashboard';
}

function getError(error: unknown) {
  assertCaughtError(error);
  return error.response?.data?.error?.message || error.message || 'Proses gagal. Silakan coba lagi.';
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Tanpa tenggat';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function isOverdue(task: CollaborationTask) {
  return Boolean(task.dueAt && !['COMPLETED', 'CANCELLED'].includes(task.status) && new Date(task.dueAt).getTime() < Date.now());
}

export default function CollaborationPage() {
  const pathname = usePathname();
  const view = getView(pathname);
  const { user } = useAuthStore();
  const [data, setData] = useState<CollaborationBootstrap>(EMPTY_DATA);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<'team' | 'member' | 'task' | 'subtask' | 'detail' | null>(null);
  const [selectedTask, setSelectedTask] = useState<CollaborationTask | null>(null);
  const [comment, setComment] = useState('');
  const [teamForm, setTeamForm] = useState({ name: '', description: '', taskVisibilityPolicy: 'ALL_TEAM_MEMBERS' as Team['taskVisibilityPolicy'] });
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'STAFF' as 'LEADER' | 'STAFF' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM' as TaskPriority, dueAt: '', assigneeIds: [] as string[], isRequired: true });

  const selectedTeam = useMemo(
    () => data.teams.find((team) => team.id === selectedTeamId) || data.teams[0] || null,
    [data.teams, selectedTeamId],
  );
  const canManage = selectedTeam?.myRole === 'OWNER' || selectedTeam?.myRole === 'LEADER';
  const isOwner = selectedTeam?.myRole === 'OWNER';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await collaborationApi.bootstrap({
        teamId: selectedTeamId || undefined,
        status,
        search: search || undefined,
      });
      setData(result);
      setSelectedTeamId((current) => (
        result.teams.some((team) => team.id === current)
          ? current
          : result.selectedTeamId || ''
      ));
    } catch (error) {
      showToast.error(getError(error));
    } finally {
      setLoading(false);
    }
  }, [search, selectedTeamId, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const resetTaskForm = () => setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueAt: '', assigneeIds: [], isRequired: true });

  const submitTeam = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setBusy(true);
      const team = await collaborationApi.createTeam(teamForm);
      showToast.success('Tim berhasil dibuat. Anda menjadi Owner tim.');
      setModal(null);
      setTeamForm({ name: '', description: '', taskVisibilityPolicy: 'ALL_TEAM_MEMBERS' });
      setSelectedTeamId(team.id);
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const submitMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTeam) return;
    try {
      setBusy(true);
      await collaborationApi.addMember(selectedTeam.id, memberForm);
      showToast.success('Anggota berhasil ditambahkan.');
      setModal(null);
      setMemberForm({ userId: '', role: 'STAFF' });
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const submitTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTeam) return;
    try {
      setBusy(true);
      const payload = { ...taskForm, dueAt: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null };
      if (modal === 'subtask' && selectedTask) {
        await collaborationApi.createSubtask(selectedTask.id, payload);
        showToast.success('Subtask berhasil ditambahkan.');
      } else {
        await collaborationApi.createTask({ ...payload, teamId: selectedTeam.id });
        showToast.success('Tugas berhasil dibuat.');
      }
      setModal(null);
      resetTaskForm();
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const openDetail = async (task: CollaborationTask) => {
    try {
      setBusy(true);
      setSelectedTask(await collaborationApi.getTask(task.id));
      setModal('detail');
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const changeStatus = async (task: CollaborationTask, nextStatus: TaskStatus) => {
    let reason: string | undefined;
    if (nextStatus === 'CANCELLED' || nextStatus === 'NEEDS_REVISION') {
      reason = window.prompt(nextStatus === 'CANCELLED' ? 'Alasan pembatalan:' : 'Catatan revisi:') || undefined;
      if (!reason) return;
    }
    try {
      setBusy(true);
      const updated = await collaborationApi.updateTaskStatus(task.id, { status: nextStatus, version: task.version, reason });
      showToast.success(`Status diubah menjadi ${STATUS_META[nextStatus].label}.`);
      if (modal === 'detail') setSelectedTask(updated);
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTask || !comment.trim()) return;
    try {
      setBusy(true);
      await collaborationApi.createComment(selectedTask.id, comment.trim());
      setComment('');
      setSelectedTask(await collaborationApi.getTask(selectedTask.id));
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const setLeader = async (membershipId: string) => {
    if (!selectedTeam) return;
    try {
      setBusy(true);
      await collaborationApi.setPrimaryLeader(selectedTeam.id, membershipId);
      showToast.success('Primary Leader berhasil diperbarui.');
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const updateMemberRole = async (membershipId: string, role: 'LEADER' | 'STAFF') => {
    if (!selectedTeam) return;
    try {
      setBusy(true);
      await collaborationApi.updateMember(selectedTeam.id, membershipId, { role });
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const deleteTeam = async () => {
    if (!selectedTeam || selectedTeam.myRole !== 'OWNER') return;
    const confirmed = window.confirm(
      `Hapus tim "${selectedTeam.name}"? Tim akan diarsipkan dan tidak lagi muncul pada daftar aktif. Tugas serta histori tetap tersimpan.`,
    );
    if (!confirmed) return;
    try {
      setBusy(true);
      await collaborationApi.deleteTeam(selectedTeam.id);
      showToast.success('Tim berhasil dihapus dari daftar aktif.');
      setSelectedTeamId('');
      await load();
    } catch (error) { showToast.error(getError(error)); } finally { setBusy(false); }
  };

  const unassignedUsers = data.users.filter((candidate) => !selectedTeam?.memberships.some((member) => member.userId === candidate.id));

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}><Sparkles size={14} /> Collaboration workspace</span>
          <h1>{view === 'dashboard' ? 'Monitoring Tim' : view === 'tasks' ? 'Tugas & Subtask' : 'Kelola Tim'}</h1>
          <p>Susun pekerjaan, pantau progres, dan jaga komunikasi tim dalam satu ruang yang rapi.</p>
        </div>
        <div className={styles.heroActions}>
          <button className="btn btn-secondary" onClick={() => setModal('team')}><Users size={17} /> Buat Tim</button>
          {canManage && <button className="btn btn-primary" onClick={() => { resetTaskForm(); setModal('task'); }}><Plus size={17} /> Tugas Baru</button>}
        </div>
      </section>

      <section className={styles.toolbar}>
        <label className={styles.teamPicker}>
          <span>Tim aktif</span>
          <select value={selectedTeam?.id || ''} onChange={(event) => setSelectedTeamId(event.target.value)}>
            {data.teams.length === 0 && <option value="">Belum ada tim</option>}
            {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.myRole}</option>)}
          </select>
        </label>
        {view === 'tasks' && <>
          <label className={styles.search}><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari tugas..." /></label>
          <select className={styles.filter} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">Semua status</option>
            {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
        </>}
      </section>

      {loading && data.teams.length === 0 ? <Loading /> : data.teams.length === 0 ? (
        <EmptyState onCreate={() => setModal('team')} />
      ) : <>
        {view === 'dashboard' && (
          <DashboardView
            data={data}
            team={selectedTeam}
            busy={busy}
            onOpenTask={openDetail}
            onSetLeader={setLeader}
          />
        )}
        {view === 'tasks' && (
          <section className={styles.taskBoard}>
            <div className={styles.sectionHeading}><div><h2>Daftar pekerjaan</h2><p>{data.tasks.length} parent task pada tim ini</p></div></div>
            <div className={styles.taskList}>
              {data.tasks.length === 0 ? <div className={styles.inlineEmpty}>Tidak ada tugas yang cocok dengan filter.</div> : data.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  expanded={expandedTasks.has(task.id)}
                  onToggle={() => setExpandedTasks((current) => {
                    const next = new Set(current); if (next.has(task.id)) next.delete(task.id); else next.add(task.id); return next;
                  })}
                  onOpen={openDetail}
                  onAddSubtask={() => { setSelectedTask(task); resetTaskForm(); setModal('subtask'); }}
                  canManage={Boolean(canManage)}
                />
              ))}
            </div>
          </section>
        )}
        {view === 'teams' && selectedTeam && (
          <TeamsView team={selectedTeam} isOwner={Boolean(isOwner)} busy={busy} onAdd={() => setModal('member')} onDelete={deleteTeam} onSetLeader={setLeader} onRole={updateMemberRole} />
        )}
      </>}

      {modal === 'team' && <Modal title="Buat tim baru" subtitle="Anda otomatis menjadi Owner tim." onClose={() => setModal(null)}>
        <form className={styles.form} onSubmit={submitTeam}>
          <Field label="Nama tim"><input required minLength={3} value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} placeholder="Contoh: Operasional Jakarta" /></Field>
          <Field label="Deskripsi"><textarea rows={3} value={teamForm.description} onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })} placeholder="Tujuan dan ruang lingkup tim" /></Field>
          <Field label="Visibilitas tugas"><select value={teamForm.taskVisibilityPolicy} onChange={(event) => setTeamForm({ ...teamForm, taskVisibilityPolicy: event.target.value as Team['taskVisibilityPolicy'] })}><option value="ALL_TEAM_MEMBERS">Semua anggota tim</option><option value="ASSIGNEE_ONLY">Hanya assignee dan leader</option></select></Field>
          <FormActions busy={busy} submit="Buat Tim" onCancel={() => setModal(null)} />
        </form>
      </Modal>}

      {modal === 'member' && selectedTeam && <Modal title="Tambah anggota" subtitle={`Tambahkan akun aktif ke ${selectedTeam.name}.`} onClose={() => setModal(null)}>
        <form className={styles.form} onSubmit={submitMember}>
          <Field label="Akun"><select required value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })}><option value="">Pilih akun</option>{unassignedUsers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName} · {candidate.role}</option>)}</select></Field>
          <Field label="Role dalam tim"><select value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value as 'LEADER' | 'STAFF' })}><option value="STAFF">Staff</option><option value="LEADER">Leader</option></select></Field>
          <FormActions busy={busy} submit="Tambahkan" onCancel={() => setModal(null)} />
        </form>
      </Modal>}

      {(modal === 'task' || modal === 'subtask') && selectedTeam && <Modal title={modal === 'subtask' ? 'Tambah subtask' : 'Buat tugas baru'} subtitle={modal === 'subtask' ? `Anak tugas untuk #${selectedTask?.taskNo} ${selectedTask?.title}` : `Untuk tim ${selectedTeam.name}`} onClose={() => setModal(null)}>
        <form className={styles.form} onSubmit={submitTask}>
          <Field label="Judul"><input required minLength={3} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Apa yang harus diselesaikan?" /></Field>
          <Field label="Deskripsi"><textarea rows={4} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="Berikan konteks dan hasil yang diharapkan" /></Field>
          <div className={styles.formGrid}>
            <Field label="Prioritas"><select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as TaskPriority })}>{Object.entries(PRIORITY_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></Field>
            <Field label="Tenggat"><input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })} /></Field>
          </div>
          <Field label="Assignee"><div className={styles.assigneeGrid}>{selectedTeam.memberships.map((member) => <label key={member.id} className={taskForm.assigneeIds.includes(member.userId) ? styles.assigneeSelected : styles.assigneeOption}><input type="checkbox" checked={taskForm.assigneeIds.includes(member.userId)} onChange={() => setTaskForm((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(member.userId) ? current.assigneeIds.filter((id) => id !== member.userId) : [...current.assigneeIds, member.userId] }))} /><Avatar name={member.user.fullName} /><span>{member.user.fullName}<small>{member.role}</small></span></label>)}</div></Field>
          {modal === 'subtask' && <label className={styles.checkLine}><input type="checkbox" checked={taskForm.isRequired} onChange={(event) => setTaskForm({ ...taskForm, isRequired: event.target.checked })} /> Subtask wajib diselesaikan sebelum parent task</label>}
          <FormActions busy={busy} submit={modal === 'subtask' ? 'Tambah Subtask' : 'Buat Tugas'} onCancel={() => setModal(null)} />
        </form>
      </Modal>}

      {modal === 'detail' && selectedTask && <TaskDetail task={selectedTask} currentUserId={user?.userId || ''} canManage={Boolean(canManage)} busy={busy} onClose={() => setModal(null)} onStatus={changeStatus} comment={comment} setComment={setComment} onComment={submitComment} onOpenSubtask={openDetail} />}
    </div>
  );
}

function DashboardView({
  data,
  team,
  busy,
  onOpenTask,
  onSetLeader,
}: {
  data: CollaborationBootstrap;
  team: Team | null;
  busy: boolean;
  onOpenTask: (task: CollaborationTask) => void;
  onSetLeader: (membershipId: string) => void;
}) {
  const ownerMembership = team?.memberships.find((member) => member.role === 'OWNER');
  const ownerIsPrimaryLeader = Boolean(
    ownerMembership && team?.primaryLeaderMembershipId === ownerMembership.id,
  );
  const cards = [
    { label: 'Total pekerjaan', value: data.stats.total, icon: ListChecks, tone: 'violet' },
    { label: 'Sedang dikerjakan', value: data.stats.inProgress, icon: Activity, tone: 'blue' },
    { label: 'Menunggu review', value: data.stats.submitted, icon: Clock3, tone: 'amber' },
    { label: 'Selesai', value: data.stats.completed, icon: CheckCircle2, tone: 'green' },
    { label: 'Terlambat', value: data.stats.overdue, icon: AlertTriangle, tone: 'rose' },
  ];
  return <>
    <section className={styles.stats}>{cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className={styles.statCard} data-tone={tone}><span><Icon size={19} /></span><div><strong>{value}</strong><p>{label}</p></div></article>)}</section>
    <div className={styles.dashboardGrid}>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><h2>Fokus terbaru</h2><p>Pekerjaan yang perlu perhatian tim.</p></div><Target size={20} /></div>
        <div className={styles.compactTasks}>{data.tasks.slice(0, 6).map((task) => <button key={task.id} onClick={() => onOpenTask(task)}><StatusDot status={task.status} /><span><strong>#{task.taskNo} {task.title}</strong><small>{task.assignees.map((person) => person.fullName).join(', ') || 'Belum ada assignee'}</small></span><ArrowRight size={16} /></button>)}{data.tasks.length === 0 && <div className={styles.inlineEmpty}>Belum ada tugas pada tim ini.</div>}</div>
      </section>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><h2>Aktivitas tim</h2><p>Perubahan terbaru yang tercatat.</p></div><Activity size={20} /></div>
        <div className={styles.timeline}>{data.activities.slice(0, 8).map((activity) => <div key={activity.id}><Avatar name={activity.actor.fullName} /><span><strong>{activity.actor.fullName}</strong><p>{activity.action.replaceAll('_', ' ').toLowerCase()}{activity.task ? ` · #${activity.task.taskNo} ${activity.task.title}` : ''}</p><small>{formatDate(activity.createdAt)}</small></span></div>)}{data.activities.length === 0 && <div className={styles.inlineEmpty}>Aktivitas akan muncul di sini.</div>}</div>
      </section>
    </div>
    {team && (
      <section className={styles.teamStrip}>
        <div>
          <span className={styles.teamIcon}><Users size={22} /></span>
          <div>
            <strong>{team.name}</strong>
            <p>
              {team.memberships.length} anggota · Anda sebagai {team.myRole}
              {team.myRole === 'OWNER' && ownerIsPrimaryLeader ? ' sekaligus Primary Leader' : ''}
            </p>
          </div>
        </div>
        <div className={styles.leaderSummary}>
          <span>Primary Leader</span>
          <strong>{team.primaryLeader?.fullName || 'Belum ditentukan'}</strong>
          {team.myRole === 'OWNER' && ownerMembership && !ownerIsPrimaryLeader && (
            <button
              type="button"
              className={styles.ownerLeaderButton}
              disabled={busy}
              onClick={() => onSetLeader(ownerMembership.id)}
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              Jadikan Saya Primary Leader
            </button>
          )}
        </div>
      </section>
    )}
  </>;
}

function TaskRow({ task, expanded, onToggle, onOpen, onAddSubtask, canManage }: { task: CollaborationTask; expanded: boolean; onToggle: () => void; onOpen: (task: CollaborationTask) => void; onAddSubtask: () => void; canManage: boolean }) {
  return <article className={styles.taskCard}>
    <div className={styles.taskMain}>
      <button className={styles.expandButton} onClick={onToggle} aria-label={expanded ? 'Tutup subtask' : 'Buka subtask'}>{task.subtasks.length > 0 ? expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} /> : <Circle size={12} />}</button>
      <button className={styles.taskContent} onClick={() => onOpen(task)}>
        <div className={styles.taskTitleLine}><span className={styles.taskNo}>#{task.taskNo}</span><h3>{task.title}</h3><Pill tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Pill></div>
        <div className={styles.taskMeta}><Pill tone={STATUS_META[task.status].tone}>{STATUS_META[task.status].label}</Pill><span className={isOverdue(task) ? styles.overdue : ''}><Clock3 size={14} /> {formatDate(task.dueAt)}</span><span><MessageSquare size={14} /> {task.comments?.length || 0}</span></div>
        {task.subtasks.length > 0 && <div className={styles.progress}><span style={{ width: `${task.progress.percent}%` }} /><small>{task.progress.completed}/{task.progress.total} subtask wajib</small></div>}
      </button>
      <div className={styles.taskPeople}>{task.assignees.slice(0, 3).map((person) => <Avatar key={person.id} name={person.fullName} title={person.fullName} />)}{canManage && <button className={styles.miniAdd} onClick={onAddSubtask} title="Tambah subtask"><Plus size={16} /></button>}</div>
    </div>
    {expanded && task.subtasks.length > 0 && <div className={styles.subtasks}>{task.subtasks.map((subtask) => <button key={subtask.id} onClick={() => onOpen(subtask)}><StatusDot status={subtask.status} /><span><strong>#{subtask.taskNo} {subtask.title}</strong><small>{subtask.assignees.map((person) => person.fullName).join(', ') || 'Belum ada assignee'} · {formatDate(subtask.dueAt)}</small></span><Pill tone={STATUS_META[subtask.status].tone}>{STATUS_META[subtask.status].label}</Pill></button>)}</div>}
  </article>;
}

function TeamsView({ team, isOwner, busy, onAdd, onDelete, onSetLeader, onRole }: { team: Team; isOwner: boolean; busy: boolean; onAdd: () => void; onDelete: () => void; onSetLeader: (id: string) => void; onRole: (id: string, role: 'LEADER' | 'STAFF') => void }) {
  return <div className={styles.teamsGrid}>
    <section className={styles.panel}>
      <div className={styles.sectionHeading}><div><h2>{team.name}</h2><p>{team.description || 'Belum ada deskripsi tim.'}</p></div>{isOwner && <div className={styles.teamActions}><button className={styles.deleteTeamButton} disabled={busy} onClick={onDelete}><Trash2 size={16} /> Hapus Tim</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={onAdd}><UserPlus size={16} /> Tambah Anggota</button></div>}</div>
      <div className={styles.memberList}>{team.memberships.map((member) => <div key={member.id} className={styles.memberRow}><Avatar name={member.user.fullName} /><div><strong>{member.user.fullName}</strong><p>{member.user.role} · {member.user.staffCode || member.user.email}</p></div><span className={styles.roleBadge}>{member.role}</span>{team.primaryLeaderMembershipId === member.id && <span className={styles.leaderBadge}>Primary Leader</span>}{isOwner && member.role !== 'OWNER' && <select value={member.role} onChange={(event) => onRole(member.id, event.target.value as 'LEADER' | 'STAFF')}><option value="STAFF">Staff</option><option value="LEADER">Leader</option></select>}{isOwner && (member.role === 'LEADER' || member.role === 'OWNER') && team.primaryLeaderMembershipId !== member.id && <button className={styles.textButton} onClick={() => onSetLeader(member.id)}>Jadikan Primary Leader</button>}</div>)}</div>
    </section>
    <aside className={styles.panel}><div className={styles.sectionHeading}><div><h2>Aturan tim</h2><p>Konfigurasi akses saat ini.</p></div><Settings2 size={20} /></div><div className={styles.infoList}><div><span>Role Anda</span><strong>{team.myRole}</strong></div><div><span>Visibilitas tugas</span><strong>{team.taskVisibilityPolicy === 'ALL_TEAM_MEMBERS' ? 'Semua anggota' : 'Assignee saja'}</strong></div><div><span>Primary Leader</span><strong>{team.primaryLeader?.fullName || 'Belum ditentukan'}</strong></div></div></aside>
  </div>;
}

function TaskDetail({ task, currentUserId, canManage, busy, onClose, onStatus, comment, setComment, onComment, onOpenSubtask }: { task: CollaborationTask; currentUserId: string; canManage: boolean; busy: boolean; onClose: () => void; onStatus: (task: CollaborationTask, status: TaskStatus) => void; comment: string; setComment: (value: string) => void; onComment: (event: FormEvent) => void; onOpenSubtask: (task: CollaborationTask) => void }) {
  const assigned = task.assignees.some((person) => person.id === currentUserId);
  return <div className={styles.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className={styles.drawer}>
    <header><div><span className={styles.taskNo}>#{task.taskNo}</span><h2>{task.title}</h2></div><button onClick={onClose}><X size={20} /></button></header>
    <div className={styles.drawerBody}>
      <div className={styles.detailPills}><Pill tone={STATUS_META[task.status].tone}>{STATUS_META[task.status].label}</Pill><Pill tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Pill>{isOverdue(task) && <Pill tone="rose">Terlambat</Pill>}</div>
      <p className={styles.description}>{task.description || 'Tidak ada deskripsi.'}</p>
      <div className={styles.detailInfo}><div><span>Tenggat</span><strong>{formatDate(task.dueAt)}</strong></div><div><span>Assignee</span><strong>{task.assignees.map((person) => person.fullName).join(', ') || 'Belum ditentukan'}</strong></div><div><span>Dibuat oleh</span><strong>{task.createdBy.fullName}</strong></div></div>
      <div className={styles.statusActions}>
        {assigned && task.status === 'TODO' && <button onClick={() => onStatus(task, 'IN_PROGRESS')}>Mulai kerjakan</button>}
        {assigned && ['IN_PROGRESS', 'NEEDS_REVISION'].includes(task.status) && <button onClick={() => onStatus(task, 'SUBMITTED')}>Kirim untuk review</button>}
        {canManage && task.status === 'SUBMITTED' && <><button className={styles.secondaryAction} onClick={() => onStatus(task, 'NEEDS_REVISION')}>Minta revisi</button><button onClick={() => onStatus(task, 'COMPLETED')}>Setujui & selesai</button></>}
        {canManage && !['COMPLETED', 'CANCELLED'].includes(task.status) && <button className={styles.dangerAction} onClick={() => onStatus(task, 'CANCELLED')}>Batalkan</button>}
      </div>
      {task.subtasks?.length > 0 && <section className={styles.detailSection}><h3>Subtask <span>{task.progress.completed}/{task.progress.total}</span></h3><div className={styles.detailSubtasks}>{task.subtasks.map((subtask) => <button key={subtask.id} onClick={() => onOpenSubtask(subtask)}><StatusDot status={subtask.status} /><span>{subtask.title}</span><ChevronRight size={16} /></button>)}</div></section>}
      <section className={styles.detailSection}><h3>Diskusi <span>{task.comments?.length || 0}</span></h3><div className={styles.comments}>{task.comments?.map((entry) => <div key={entry.id}><Avatar name={entry.author.fullName} /><div><strong>{entry.author.fullName}</strong><small>{formatDate(entry.createdAt)}</small><p>{entry.content}</p></div></div>)}{!task.comments?.length && <div className={styles.inlineEmpty}>Belum ada komentar.</div>}</div><form className={styles.commentForm} onSubmit={onComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tulis komentar atau update..." /><button disabled={busy || !comment.trim()}><Send size={17} /></button></form></section>
    </div>
  </aside></div>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className={styles.modalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={styles.modal}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className={styles.field}><span>{label}</span>{children}</label>; }
function FormActions({ busy, submit, onCancel }: { busy: boolean; submit: string; onCancel: () => void }) { return <div className={styles.formActions}><button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button><button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{submit}</button></div>; }
function Pill({ tone, children }: { tone: string; children: React.ReactNode }) { return <span className={styles.pill} data-tone={tone}>{children}</span>; }
function StatusDot({ status }: { status: TaskStatus }) { return <span className={styles.statusDot} data-tone={STATUS_META[status].tone} />; }
function Avatar({ name, title }: { name: string; title?: string }) { return <span className={styles.avatar} title={title}>{initials(name)}</span>; }
function Loading() { return <div className={styles.loading}><Loader2 size={28} className="animate-spin" /><span>Menyiapkan workspace...</span></div>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <section className={styles.empty}><span><Users size={30} /></span><h2>Mulai dari tim pertama Anda</h2><p>Buat tim, tentukan Leader, lalu bagikan tugas dan subtask kepada anggota.</p><button className="btn btn-primary" onClick={onCreate}><Plus size={17} /> Buat Tim</button></section>; }
