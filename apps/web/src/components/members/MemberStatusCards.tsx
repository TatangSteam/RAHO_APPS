import { Camera, Package, Rocket, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { MemberDetail } from '@/types/member';
import { PackageDisplay } from '@/types/package';
import { getMemberVoucherTotals } from './memberStatusPresentation';

interface MemberStatusCardsProps {
  member: MemberDetail;
  packages: PackageDisplay[];
}

const toneClasses = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
};

function StatusItem({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  tone: keyof typeof toneClasses;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-extrabold text-neutral-950 dark:text-white">{value}</p>
        <p className="mt-0.5 truncate text-[11px] text-neutral-500">{helper}</p>
      </div>
    </article>
  );
}

export default function MemberStatusCards({ member, packages }: MemberStatusCardsProps) {
  const voucherTotals = getMemberVoucherTotals(packages);
  const isActive = member.isActive && !member.isDeceased;

  return (
    <section className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-5" aria-label="Ringkasan status member">
      <StatusItem label="Voucher BASIC" value={voucherTotals.basic} helper="Sisa aktif" icon={<Package size={19} />} tone="blue" />
      <StatusItem label="Voucher BOOSTER" value={voucherTotals.booster} helper="Sisa aktif" icon={<Rocket size={19} />} tone="purple" />
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
