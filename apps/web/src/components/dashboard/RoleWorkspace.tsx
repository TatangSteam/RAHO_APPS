import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';

type Accent = 'amber' | 'cyan' | 'emerald';

const accentStyles: Record<Accent, {
  icon: string;
  eyebrow: string;
  primary: string;
  soft: string;
}> = {
  amber: {
    icon: 'from-amber-400 to-amber-600 shadow-amber-500/20',
    eyebrow: 'text-amber-700 dark:text-amber-300',
    primary: 'bg-amber-500 text-black hover:bg-amber-400',
    soft: 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10',
  },
  cyan: {
    icon: 'from-cyan-400 to-cyan-600 shadow-cyan-500/20',
    eyebrow: 'text-cyan-700 dark:text-cyan-300',
    primary: 'bg-cyan-600 text-white hover:bg-cyan-500',
    soft: 'border-cyan-200 bg-cyan-50 dark:border-cyan-500/20 dark:bg-cyan-500/10',
  },
  emerald: {
    icon: 'from-emerald-400 to-emerald-600 shadow-emerald-500/20',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500',
    soft: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10',
  },
};

export function RoleWorkspaceHeader({
  accent,
  icon,
  eyebrow,
  title,
  description,
  userName,
  primaryAction,
  secondaryAction,
  guide,
}: {
  accent: Accent;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  userName?: string | null;
  primaryAction: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
  guide: string[];
}) {
  const colors = accentStyles[accent];

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="p-5 md:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${colors.icon}`}>
                {icon}
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${colors.eyebrow}`}>{eyebrow}</p>
                <h1 className="mt-1 text-2xl font-bold text-neutral-950 dark:text-white md:text-3xl">{title}</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300 md:text-base">
              {userName ? `Halo, ${userName}. ` : ''}{description}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {secondaryAction && (
              <Link
                href={secondaryAction.href}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 px-4 text-sm font-bold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {secondaryAction.label}
              </Link>
            )}
            <Link
              href={primaryAction.href}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition ${colors.primary}`}
            >
              {primaryAction.label}
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </div>

      <div className={`border-t p-4 ${colors.soft}`}>
        <div className="grid gap-2 md:grid-cols-3">
          {guide.map((item, index) => (
            <div key={item} className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm text-neutral-700 dark:bg-neutral-950/30 dark:text-neutral-200">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-black text-white dark:bg-white dark:text-neutral-950">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DashboardSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 md:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-950 dark:text-white">{title}</h2>
          {description && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="inline-flex items-center gap-1 text-sm font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400">
            {action.label}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function SessionTaskCard({
  href,
  time,
  memberName,
  sessionCode,
  details,
  status,
  statusTone = 'neutral',
  actionLabel,
}: {
  href: string;
  time?: string;
  memberName: string;
  sessionCode?: string;
  details: string[];
  status: string;
  statusTone?: 'neutral' | 'active' | 'success' | 'warning';
  actionLabel: string;
}) {
  const statusClass = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  }[statusTone];

  return (
    <article className="rounded-2xl border border-neutral-200 p-4 transition hover:border-amber-300 hover:shadow-sm dark:border-neutral-800 dark:hover:border-amber-500/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {time && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-100 px-2.5 py-2 text-sm font-bold dark:bg-neutral-800">
              <Clock3 size={14} className="text-neutral-500" />
              {time}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-neutral-950 dark:text-white">{memberName}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass}`}>{status}</span>
            </div>
            {sessionCode && <p className="mt-1 text-xs font-semibold text-neutral-500">{sessionCode}</p>}
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              {details.filter(Boolean).map((detail) => <span key={detail}>• {detail}</span>)}
            </div>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white hover:bg-amber-500 hover:text-black dark:bg-white dark:text-neutral-950 dark:hover:bg-amber-400"
        >
          {actionLabel}
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}

export function EmptyTaskState({ message, action }: { message: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 px-4 py-9 text-center dark:border-neutral-700">
      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      <p className="mt-3 font-semibold text-neutral-800 dark:text-neutral-200">{message}</p>
      {action && (
        <Link href={action.href} className="mt-3 text-sm font-bold text-amber-600 dark:text-amber-400">
          {action.label}
        </Link>
      )}
    </div>
  );
}
