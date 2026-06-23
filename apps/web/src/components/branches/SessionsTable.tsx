'use client';

import { Calendar, User, Stethoscope, Eye, FileText, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  sessionCode: string;
  date: string;
  status: string;
  member: {
    id: string;
    fullName: string;
    memberNo: string;
  };
  doctor: {
    fullName: string;
  };
  nurse: {
    fullName: string;
  };
  package: {
    name: string;
  };
}

interface SessionsTableProps {
  data: Session[];
  loading: boolean;
  returnTo?: string;
}

export default function SessionsTable({ data, loading, returnTo }: SessionsTableProps) {
  const router = useRouter();

  const openSession = (sessionId: string) => {
    const returnQuery = returnTo
      ? `?returnTo=${encodeURIComponent(returnTo)}`
      : '';
    router.push(`/sessions/${sessionId}${returnQuery}`);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; bg: string; text: string }> = {
      SCHEDULED: { label: 'Terjadwal', bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
      COMPLETED: { label: 'Selesai', bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
      CANCELLED: { label: 'Dibatalkan', bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
    };

    const s = statusMap[status] || { label: status, bg: 'bg-neutral-100', text: 'text-neutral-600' };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-neutral-300 dark:border-neutral-700 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-500 dark:text-neutral-400">Memuat data sesi...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700 rounded-xl">
        <FileText size={48} className="text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum ada sesi terapi</h3>
        <p className="text-neutral-500 dark:text-neutral-400">
          Sesi terapi di cabang ini belum ada atau sedang dimuat
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-xl">
      <table className="w-full">
        <thead className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Kode Sesi
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Tanggal
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Member
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Dokter
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Perawat
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-4 text-center text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
          {data.map((session) => (
            <tr 
              key={session.id}
              className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td className="px-6 py-4">
                <span className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {session.sessionCode}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <Calendar size={16} className="text-neutral-400" />
                  {new Date(session.date).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </td>
              <td className="px-6 py-4">
                <div>
                  <div className="font-medium text-sm text-neutral-900 dark:text-white">
                    {session.member.fullName}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {session.member.memberNo}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <Stethoscope size={16} className="text-blue-500" />
                  {session.doctor.fullName}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <User size={16} className="text-emerald-500" />
                  {session.nurse.fullName}
                </div>
              </td>
              <td className="px-6 py-4">
                {getStatusBadge(session.status)}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => openSession(session.id)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                    title={session.status === 'COMPLETED' ? 'Lihat detail sesi' : 'Lihat dan edit sesi'}
                  >
                    {session.status === 'COMPLETED' ? <Eye size={17} /> : <Pencil size={17} />}
                    <span>{session.status === 'COMPLETED' ? 'Detail' : 'Detail & Edit'}</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
