import { Award } from 'lucide-react';
import type { MemberRank } from '@/types/member';

interface MemberRankBadgeProps {
  rank?: MemberRank | null;
  discountPercent?: number | null;
  showDiscount?: boolean;
}

const rankClasses: Record<MemberRank, string> = {
  A: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  B: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  C: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300',
};

function formatDiscount(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function MemberRankBadge({
  rank,
  discountPercent,
  showDiscount = true,
}: MemberRankBadgeProps) {
  if (!rank) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-bold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
        title="Rank tersedia setelah pembelian paket pertama"
      >
        <Award size={12} />
        Belum ada rank
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${rankClasses[rank]}`}
      title="Rank berdasarkan diskon pembelian terakhir: A 0–20%, B 21–50%, C 51–100%"
    >
      <Award size={12} />
      Rank {rank}
      {showDiscount && discountPercent !== null && discountPercent !== undefined
        ? ` · ${formatDiscount(discountPercent)}%`
        : ''}
    </span>
  );
}
