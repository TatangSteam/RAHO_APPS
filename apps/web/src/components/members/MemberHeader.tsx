'use client';

import AppImage from '@/components/ui/AppImage';
import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  Building2,
  CircleAlert,
  FileUp,
  KeyRound,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { MemberDetail } from '@/types/member';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { devError } from '@/lib/logger';

interface MemberHeaderProps {
  member: MemberDetail;
  onBack: () => void;
  onSendNotification: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onManageCredentials?: () => void;
  onUploadDocuments?: () => void;
  isSuperAdmin: boolean;
  canEdit?: boolean;
  canSendNotification?: boolean;
  canDelete?: boolean;
  isDeleting?: boolean;
  canUploadDocuments?: boolean;
  hasDocuments?: boolean;
}

type ActionTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const actionToneClasses: Record<ActionTone, string> = {
  neutral:
    'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800',
  primary:
    'border-neutral-950 bg-neutral-950 text-white hover:border-amber-500 hover:bg-amber-500 hover:text-black dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:border-amber-400 dark:hover:bg-amber-400',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  danger:
    'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300',
};

function HeaderAction({
  children,
  icon,
  onClick,
  tone = 'neutral',
  disabled = false,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  tone?: ActionTone;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionToneClasses[tone]}`}
    >
      {icon}
      {children}
    </button>
  );
}

export default function MemberHeader({
  member,
  onBack,
  onSendNotification,
  onEdit,
  onDelete,
  onManageCredentials,
  onUploadDocuments,
  isSuperAdmin,
  canEdit = false,
  canSendNotification = true,
  canDelete = false,
  isDeleting = false,
  canUploadDocuments = false,
  hasDocuments = false,
}: MemberHeaderProps) {
  const profilePhoto = member.documents?.find((document) => document.documentType === 'FOTO_PROFIL');
  const hasInformedConsent = member.documents?.some(
    (document) => document.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN',
  );
  const missingWarnings = [
    !member.profile?.phone?.trim() ? 'No HP belum terisi' : null,
    !hasInformedConsent ? 'Informed consent belum terisi' : null,
  ].filter(Boolean) as string[];
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfilePhoto = async () => {
      if (!profilePhoto?.fileUrl) {
        setProfilePhotoUrl(null);
        return;
      }

      try {
        const url = await createAuthenticatedObjectUrl(profilePhoto.fileUrl);
        if (!cancelled) setProfilePhotoUrl(url);
      } catch (error) {
      assertCaughtError(error);
        devError('Failed to load member profile photo:', error);
        if (!cancelled) setProfilePhotoUrl(null);
      }
    };

    loadProfilePhoto();
    return () => {
      cancelled = true;
    };
  }, [profilePhoto?.fileUrl]);

  useEffect(() => {
    return () => {
      if (profilePhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(profilePhotoUrl);
    };
  }, [profilePhotoUrl]);

  const isActive = member.user?.isActive && !member.isDeceased;
  const memberName = member.profile?.fullName || 'Nama tidak tersedia';

  return (
    <header className="mb-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-bold text-neutral-500 transition hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
      >
        <ArrowLeft size={17} />
        Kembali ke daftar member
      </button>

      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-2xl font-black text-white ring-4 ring-blue-50 dark:ring-blue-500/10 md:h-20 md:w-20 md:text-3xl">
              {profilePhotoUrl ? (
                <AppImage src={profilePhotoUrl} alt={memberName} className="h-full w-full object-cover" />
              ) : (
                memberName.charAt(0).toUpperCase()
              )}
              <span
                className={`absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-neutral-900 ${
                  isActive ? 'bg-emerald-500' : 'bg-neutral-400'
                }`}
                aria-label={isActive ? 'Member aktif' : 'Member tidak aktif'}
              />
            </div>

            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Profil member
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    member.isDeceased
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                      : isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  {member.isDeceased ? 'Meninggal' : isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight text-neutral-950 dark:text-white md:text-3xl">
                {memberName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-mono font-bold text-neutral-700 dark:text-neutral-200">
                  {member.memberNo || 'Nomor belum tersedia'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Building2 size={13} />
                  {member.registrationBranch?.name || 'Cabang tidak tersedia'}
                </span>
              </div>
              {missingWarnings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {missingWarnings.map((warning) => (
                    <span
                      key={warning}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      <CircleAlert size={12} />
                      {warning}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            {canSendNotification && (
              <HeaderAction onClick={onSendNotification} icon={<Bell size={15} />}>
                Notifikasi
              </HeaderAction>
            )}
            {canUploadDocuments && onUploadDocuments && (
              <HeaderAction onClick={onUploadDocuments} tone="success" icon={<FileUp size={15} />}>
                {hasDocuments ? 'Kelola Dokumen' : 'Upload Dokumen'}
              </HeaderAction>
            )}
            {isSuperAdmin && onManageCredentials && (
              <HeaderAction onClick={onManageCredentials} tone="warning" icon={<KeyRound size={15} />}>
                Kredensial
              </HeaderAction>
            )}
            {canEdit && (
              <HeaderAction onClick={onEdit} tone="primary" icon={<Pencil size={15} />}>
                Edit
              </HeaderAction>
            )}
            {canDelete && onDelete && (
              <HeaderAction
                onClick={onDelete}
                disabled={isDeleting}
                tone="danger"
                icon={isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Member'}
              </HeaderAction>
            )}
          </div>
        </div>

        <div className="border-t border-sky-100 bg-sky-50/70 px-5 py-3 text-xs leading-5 text-sky-900 dark:border-sky-500/10 dark:bg-sky-500/5 dark:text-sky-100 md:px-6">
          Periksa identitas dan kelengkapan profil sebelum membuka paket, sesi terapi, diagnosis, atau therapy plan.
        </div>
      </div>
    </header>
  );
}
