import { compareMyPerformance, envelope, getMyPerformance, getMyTasks, RainUser } from './ai.service';
import { ChatContext, PeriodInput } from './ai.schema';

const periodLabels: Record<string, string> = {
  today: 'hari ini', yesterday: 'kemarin', this_week: 'minggu ini', last_week: 'minggu lalu',
  this_month: 'bulan ini', last_month: 'bulan lalu', custom: 'periode pilihan', rolling_90_days: '90 hari terakhir',
};
const statusLabels: Record<string, string> = {
  TODO: 'belum dimulai', IN_PROGRESS: 'dikerjakan', SUBMITTED: 'menunggu review',
  NEEDS_REVISION: 'perlu revisi', COMPLETED: 'selesai', CANCELLED: 'dibatalkan',
};
const format = (value: number) => value.toLocaleString('id-ID', { maximumFractionDigits: 1 });
const help = 'Saya asisten task ERP berbasis aturan (belum memakai model AI). Coba: “Kinerja hari ini”, “Daftar task minggu ini”, “Task perlu revisi”, “Task terlambat”, atau “Bandingkan minggu ini dengan minggu lalu”. Untuk tanggal custom gunakan YYYY-MM-DD. Saya tidak mengubah task atau membaca data orang lain.';
type Plan = { intent: 'help' } | { intent: 'performance'; period: PeriodInput }
  | { intent: 'compare'; a: PeriodInput; b: PeriodInput }
  | { intent: 'tasks' | 'overdue'; input: ChatContext };

export function planChat(message: string, context?: ChatContext): Plan {
  const text = message.toLowerCase();
  // Do not pretend that a mutation or someone else's performance was executed.
  if (/\b(hapus|buatkan task|buat tugas|ubah|batalkan|selesaikan|tugaskan|assign|delete|update)\b/.test(text)) return { intent: 'help' };
  if (/^(lanjut|berikutnya|next)[.!?\s]*$/.test(text)) {
    return context ? { intent: context.intent, input: context } : { intent: 'help' };
  }
  if (/\b(besok|tahun|orang lain|tim lain)\b/.test(text)) return { intent: 'help' };
  const matches = [...text.matchAll(/hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu/g)];
  const types = matches.map((match) => Object.keys(periodLabels).find((key) => periodLabels[key] === match[0]) as PeriodInput['period']);
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
  const custom = (offset: number): PeriodInput => ({ period: 'custom', startDate: dates[offset], endDate: dates[offset + 1] });
  if (/banding|compare|dibanding/.test(text)) {
    if (dates.length === 4) return { intent: 'compare', a: custom(0), b: custom(2) };
    if (dates.length !== 0 || types.length !== 2) return { intent: 'help' };
    return { intent: 'compare', a: { period: types[0] }, b: { period: types[1] } };
  }
  if (dates.length !== 0 && dates.length !== 2 || types.length > 1) return { intent: 'help' };
  const period: PeriodInput = dates.length === 2 ? custom(0) : { period: types[0] };
  const isOverdue = /terlambat|overdue|lewat deadline|melewati deadline/.test(text);
  const isList = /apa saja|daftar|tampilkan|list|task mana/.test(text);
  if (isOverdue && !/berapa|kinerja|performa|performance|ringkasan/.test(text)) {
    return { intent: 'overdue', input: { intent: 'overdue', ...period, limit: 10, offset: 0 } };
  }
  if (isList || /task.*(revisi|belum selesai|menunggu review)/.test(text)) {
    const status = /belum selesai|terbuka|open/.test(text) ? 'OPEN'
      : /revisi/.test(text) ? 'NEEDS_REVISION' : /review/.test(text) ? 'SUBMITTED'
        : /dibatalkan|cancelled/.test(text) ? 'CANCELLED' : /belum dimulai/.test(text) ? 'TODO'
          : /dikerjakan|in_progress/.test(text) ? 'IN_PROGRESS' : /selesai|completed/.test(text) ? 'COMPLETED' : undefined;
    return { intent: 'tasks', input: { intent: 'tasks', ...period, period: period.period || 'today', status, limit: 10, offset: 0 } };
  }
  if (/kinerja|performa|performance|berapa.*(task|tugas)|ringkasan/.test(text)) {
    return { intent: 'performance', period: { ...period, period: period.period || 'today' } };
  }
  return { intent: 'help' };
}

export async function chat(user: RainUser, message: string, context?: ChatContext, asOf = new Date()) {
  const plan = planChat(message, context);
  if (plan.intent === 'help') return { ...envelope(user, asOf), mode: 'rules' as const, intent: 'help' as const, reply: help, context: null, data: null };
  if (plan.intent === 'performance') {
    const data = await getMyPerformance(user, plan.period, asOf);
    const p = data.performance;
    const rate = p.completionRate === null ? 'Tidak ada task yang wajib diselesaikan pada periode ini.'
      : `Completion rate ${format(p.completionRate)}%.`;
    const reply = `Untuk ${periodLabels[data.period.type]}, ada ${p.totalTasks} task jatuh tempo: ${p.completed} selesai, ${p.cancelled} dibatalkan, dan ${p.unfinished} belum selesai. ${rate} ${p.overdue} task melewati deadline dalam periode ini. Angka berdasarkan status saat ini.`;
    return { ...envelope(user, asOf), mode: 'rules' as const, intent: plan.intent, reply, context: null, data };
  }
  if (plan.intent === 'compare') {
    const data = await compareMyPerformance(user, plan.a, plan.b, asOf);
    const A = data.periodA.performance;
    const B = data.periodB.performance;
    const delta = data.comparison.completionRateDeltaPoints;
    const rate = delta === null ? 'Completion rate tidak dapat dibandingkan karena salah satu periode tidak memiliki eligible task.'
      : `Completion rate A ${format(A.completionRate!)}%, B ${format(B.completionRate!)}%; selisih A − B ${format(delta)} poin persentase.`;
    const reply = `A (${data.periodA.period.startDate}–${data.periodA.period.endDate}): ${A.completed} selesai, ${A.overdue} terlambat. B (${data.periodB.period.startDate}–${data.periodB.period.endDate}): ${B.completed} selesai, ${B.overdue} terlambat. ${rate}${data.comparison.warning ? ` ${data.comparison.warning}` : ''} Status task dibaca saat ini, bukan snapshot historis.`;
    return { ...envelope(user, asOf), mode: 'rules' as const, intent: plan.intent, reply, context: null, data };
  }
  const data = await getMyTasks(user, plan.input, plan.intent === 'overdue', asOf);
  const items = data.tasks.map((task) => `• ${task.title} — ${statusLabels[task.status]}${task.overdue ? ' (terlambat)' : ''}`);
  const scope = periodLabels[data.period.type];
  const reply = data.pagination.total === 0 ? `Tidak ada task ${plan.intent === 'overdue' ? 'terlambat' : 'sesuai filter'} untuk ${scope}.`
    : data.tasks.length === 0 ? 'Tidak ada hasil pada halaman ini. Tanyakan daftar task kembali untuk memulai dari halaman pertama.'
    : `Ada ${data.pagination.total} task ${plan.intent === 'overdue' ? 'terlambat' : 'sesuai filter'} untuk ${scope}. Menampilkan ${data.pagination.offset + 1}–${data.pagination.offset + data.tasks.length}.\n${items.join('\n')}${data.pagination.nextOffset !== null ? '\nKetik “lanjut” untuk hasil berikutnya.' : ''}`;
  return {
    ...envelope(user, asOf), mode: 'rules' as const, intent: plan.intent, reply, data,
    context: data.pagination.nextOffset === null ? null : { ...plan.input, offset: data.pagination.nextOffset },
  };
}
