'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Modal, type ModalClassNames } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  sessionApi,
  type UnfinishedSessionReminderItem,
  type UnfinishedSessionReminderResponse,
} from '@/lib/sessionApi';
import { devError } from '@/lib/logger';
import { useAuthStore } from '@/stores/authStore';

const REMINDER_ROLES = new Set(['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE']);
const REMINDER_SESSION_KEY_PREFIX = 'raho:unfinished-session-reminder:shown';

const modalClassNames: ModalClassNames = {
  modalOverlay: 'fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm',
  modalContent: 'flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950',
  modalHeader: 'flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:px-6',
  modalBody: 'min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6',
  modalFooter: 'flex flex-col-reverse gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:justify-end sm:px-6',
  closeButton: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white',
};

const formatTreatmentDate = (value: string) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export function UnfinishedSessionReminderModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken } = useAuthStore();
  const [data, setData] = useState<UnfinishedSessionReminderResponse>({ total: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const enabled = Boolean(
    user?.userId &&
    accessToken &&
    user.role &&
    REMINDER_ROLES.has(user.role),
  );

  const isFillingTreatmentSession = Boolean(pathname?.startsWith('/sessions/'));

  const loadReminders = useCallback(async () => {
    if (!enabled || !user?.userId) return;

    try {
      setLoading(true);
      const reminderSessionKey = `${REMINDER_SESSION_KEY_PREFIX}:${user.userId}`;
      if (sessionStorage.getItem(reminderSessionKey) === 'true') return;

      // Mark before requesting so route changes or component remounts cannot
      // open a second popup while staff is working through a treatment session.
      sessionStorage.setItem(reminderSessionKey, 'true');
      const response = await sessionApi.getUnfinishedSessionReminders();
      setData(response);

      if (response.total === 0) {
        setOpen(false);
        return;
      }

      setOpen(true);
    } catch (error) {
      devError('Gagal memuat pengingat sesi belum selesai:', error);
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.userId]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      setData({ total: 0, items: [] });
      return;
    }

    if (isFillingTreatmentSession) {
      if (user?.userId) {
        sessionStorage.setItem(`${REMINDER_SESSION_KEY_PREFIX}:${user.userId}`, 'true');
      }
      setOpen(false);
      return;
    }

    void loadReminders();
  }, [enabled, isFillingTreatmentSession, loadReminders, user?.userId]);

  const dismiss = () => {
    setOpen(false);
  };

  const openSession = (item: UnfinishedSessionReminderItem) => {
    dismiss();
    router.push(`/sessions/${item.sessionId}`);
  };

  const isDoctor = user?.role === 'DOCTOR';
  const title = isDoctor ? 'Evaluasi dokter menunggu' : 'Sesi terapi belum selesai';
  const subtitle = isDoctor
    ? 'Tahap sebelum evaluasi sudah lengkap. Silakan isi evaluasi pada sesi yang ditugaskan kepada Anda.'
    : 'Lanjutkan bagian operasional yang masih kosong pada sesi berikut.';

  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={dismiss}
      classNames={modalClassNames}
      headerIcon={(
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {isDoctor ? <Stethoscope className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
      )}
      titleContainerClassName="flex min-w-0 items-start gap-3"
      titleClassName="text-lg font-bold text-neutral-950 dark:text-white"
      subtitleClassName="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400"
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={dismiss}>
            Ingatkan nanti
          </Button>
          <Button
            type="button"
            onClick={() => {
              dismiss();
              router.push('/sessions?status=incomplete&assignedToMe=true');
            }}
          >
            Lihat daftar sesi
          </Button>
        </>
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <ClipboardCheck className="h-4 w-4" />
          <span>{data.total} sesi perlu ditindaklanjuti</span>
        </div>
        {loading && <span className="text-xs text-neutral-500">Memperbarui...</span>}
      </div>

      <div className="space-y-3">
        {data.items.map((item) => (
          <button
            key={item.sessionId}
            type="button"
            onClick={() => openSession(item)}
            className="group w-full rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-amber-400 hover:bg-amber-50/60 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-amber-500/50 dark:hover:bg-amber-500/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-950 dark:text-white">
                  {item.member.fullName}
                </p>
                <p className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {item.member.memberNo} · {item.sessionCode}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-amber-600" />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {item.branch.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                {formatTreatmentDate(item.treatmentDate)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.missingSteps.map((step) => (
                <span
                  key={step.key}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300"
                >
                  <UserRound className="h-3 w-3" />
                  {step.label}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
