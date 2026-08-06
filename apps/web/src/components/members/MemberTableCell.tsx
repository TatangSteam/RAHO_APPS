'use client';

import AppImage from '@/components/ui/AppImage';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Eye,
  Link2,
  Mail,
  Phone,
} from 'lucide-react';
import type { Member } from '@/types/member';
import MemberRankBadge from './MemberRankBadge';

interface MemberTableCellProps {
  columnId: string;
  member: Member;
  photoUrl?: string;
  onNavigate: () => void;
}

const countTone = {
  purple: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/25 dark:bg-purple-500/10 dark:text-purple-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300',
};

function CountBadge({ value, tone }: { value: number; tone: keyof typeof countTone }) {
  return (
    <span className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm font-bold ${countTone[tone]}`}>
      {Number.isFinite(value) ? value : 0}
    </span>
  );
}

export function MemberTableCell({ columnId, member, photoUrl, onNavigate }: MemberTableCellProps) {
  const memberInitial = (member.fullName || 'M').charAt(0).toUpperCase();
  const missingWarnings = [
    !member.phone?.trim() ? 'No HP kosong' : null,
    !member.hasInformedConsent ? 'Consent kosong' : null,
  ].filter(Boolean) as string[];

  switch (columnId) {
    case 'memberNo':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-neutral-800 dark:text-neutral-100">
            {member.memberNo || 'N/A'}
          </span>
          {member.isLintas && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-300">
              <Link2 size={11} />
              Lintas
            </span>
          )}
        </div>
      );

    case 'nameAndBranch':
      return (
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white ring-2 ring-neutral-100 dark:ring-neutral-800">
            <span>{memberInitial}</span>
            {photoUrl && (
              <AppImage
                src={photoUrl}
                alt={member.fullName || 'Member'}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-neutral-900 dark:text-white">
              {member.fullName || 'Nama tidak tersedia'}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <Building2 size={12} />
              <span className="truncate">{member.registrationBranch || 'Cabang tidak tersedia'}</span>
            </p>
            {missingWarnings.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {missingWarnings.map((warning) => (
                  <span
                    key={warning}
                    title={warning}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    <AlertTriangle size={10} />
                    {warning}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    case 'phone':
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-neutral-700 dark:text-neutral-300">
          <Phone size={14} className="text-neutral-400" />
          {member.phone || '-'}
        </span>
      );

    case 'rank':
      return (
        <div className="flex min-w-32 flex-col items-center gap-1">
          <MemberRankBadge
            rank={member.memberRank}
            discountPercent={member.lastPurchaseDiscountPercent}
          />
          <span className="text-[10px] text-neutral-500">Diskon pembelian terakhir</span>
        </div>
      );

    case 'registrationDate':
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-neutral-700 dark:text-neutral-300">
          <CalendarDays size={14} className="text-neutral-400" />
          {member.createdAt ? new Date(member.createdAt).toLocaleDateString('id-ID') : '-'}
        </span>
      );

    case 'email':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
          <Mail size={14} className="shrink-0 text-neutral-400" />
          <span className="max-w-52 truncate">{member.email || '-'}</span>
        </span>
      );

    case 'age':
      return (
        <span className="whitespace-nowrap text-sm text-neutral-700 dark:text-neutral-300">
          {member.age !== null && member.age !== undefined ? `${member.age} tahun` : '-'}
        </span>
      );

    case 'voucherCount':
      return <CountBadge value={member.voucherCount || 0} tone="purple" />;

    case 'basicPackage':
      return <CountBadge value={member.basicPackageCount || 0} tone="amber" />;

    case 'sessionCount':
      return <CountBadge value={member.sessionCount || 0} tone="blue" />;

    case 'lastInfusion':
      if (!member.lastInfusionDate) {
        return (
          <span className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
            Belum ada
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CalendarDays size={13} />
          {new Date(member.lastInfusionDate).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      );

    case 'diagnosis':
      if (!member.primaryDiagnosis) {
        return (
          <span className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
            Belum ada
          </span>
        );
      }
      return (
        <div className="max-w-52 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 dark:border-violet-500/25 dark:bg-violet-500/10">
          <p className="truncate text-xs font-bold text-violet-700 dark:text-violet-300">
            {member.primaryDiagnosis}
          </p>
          {member.primaryDiagnosisIcd && (
            <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{member.primaryDiagnosisIcd}</p>
          )}
        </div>
      );

    case 'status':
      if (member.isDeceased) {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Meninggal
          </span>
        );
      }
      if (member.isActive) {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Aktif
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-bold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
          Nonaktif
        </span>
      );

    case 'actions':
      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate();
          }}
          className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-neutral-900 px-3 text-xs font-bold text-white transition hover:bg-amber-500 hover:text-black dark:bg-white dark:text-neutral-950 dark:hover:bg-amber-400"
          title="Lihat detail member"
        >
          <Eye size={14} />
          Lihat Detail
        </button>
      );

    default:
      return <span>-</span>;
  }
}
