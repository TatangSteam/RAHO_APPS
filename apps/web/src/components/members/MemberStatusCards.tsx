import { Award, Camera, Package, Pencil, Rocket, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { MemberDetail } from '@/types/member';
import { PackageDisplay } from '@/types/package';
import { getMemberVoucherTotals } from './memberStatusPresentation';

interface MemberStatusCardsProps {
  member: MemberDetail;
  packages: PackageDisplay[];
  canEditVoucher?: boolean;
  onEditBasicVoucher?: () => void;
  onEditBoosterVoucher?: () => void;
}

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};

function StatusItem({
  label,
  value,
  helper,
  icon,
  tone,
  action,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  tone: keyof typeof toneClasses;
  action?: React.ReactNode;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-extrabold text-neutral-950 dark:text-white">{value}</p>
        <p className="mt-0.5 truncate text-[11px] text-neutral-500">{helper}</p>
      </div>
      {action}
    </article>
  );
}

export default function MemberStatusCards({
  member,
  packages,
  canEditVoucher = false,
  onEditBasicVoucher,
  onEditBoosterVoucher,
}: MemberStatusCardsProps) {
  const voucherTotals = getMemberVoucherTotals(packages);
  const isActive = member.isActive && !member.isDeceased;
  const rankTone =
    member.memberRank === 'A'
      ? 'blue'
      : member.memberRank === 'B'
        ? 'amber'
        : member.memberRank === 'C'
          ? 'rose'
          : 'neutral';
  const rankHelper =
    member.lastPurchaseDiscountPercent !== null &&
    member.lastPurchaseDiscountPercent !== undefined
      ? `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(member.lastPurchaseDiscountPercent)}% diskon terakhir`
      : 'Belum ada pembelian paket';

  return (
    <section className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6" aria-label="Ringkasan status member">
      <StatusItem
        label="Voucher BASIC"
        value={voucherTotals.basic}
        helper="Sisa aktif"
        icon={<Package size={19} />}
        tone="blue"
        action={canEditVoucher && onEditBasicVoucher ? (
          <button
            type="button"
            onClick={onEditBasicVoucher}
            aria-label="Edit voucher BASIC"
            title="Edit voucher BASIC"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-500/10"
          >
            <Pencil size={15} />
          </button>
        ) : undefined}
      />
      <StatusItem
        label="Voucher BOOSTER"
        value={voucherTotals.booster}
        helper="Sisa aktif"
        icon={<Rocket size={19} />}
        tone="purple"
        action={canEditVoucher && onEditBoosterVoucher ? (
          <button
            type="button"
            onClick={onEditBoosterVoucher}
            aria-label="Edit voucher BOOSTER"
            title="Edit voucher BOOSTER"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-200 text-purple-600 transition hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-500/10"
          >
            <Pencil size={15} />
          </button>
        ) : undefined}
      />
      <StatusItem
        label="Rank member"
        value={member.memberRank ? `Rank ${member.memberRank}` : '-'}
        helper={rankHelper}
        icon={<Award size={19} />}
        tone={rankTone}
      />
      <StatusItem
        label="Status akun"
        value={isActive ? 'Aktif' : 'Nonaktif'}
        helper={member.isDeceased ? 'Status meninggal' : 'Akses member'}
        icon={<UserRoundCheck size={19} />}
        tone={isActive ? 'emerald' : member.isDeceased ? 'red' : 'neutral'}
      />
      <StatusItem
        label="Status hidup"
        value={member.isDeceased ? 'Meninggal' : 'Aktif'}
        helper="Data layanan"
        icon={<ShieldCheck size={19} />}
        tone={member.isDeceased ? 'red' : 'emerald'}
      />
      <StatusItem
        label="Consent foto"
        value={member.isConsentToPhoto ? 'Disetujui' : 'Belum'}
        helper="Izin dokumentasi"
        icon={<Camera size={19} />}
        tone={member.isConsentToPhoto ? 'blue' : 'neutral'}
      />
    </section>
  );
}
