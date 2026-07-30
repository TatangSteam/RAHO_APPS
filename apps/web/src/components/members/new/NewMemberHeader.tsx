'use client';

import { ArrowLeft, CheckCircle2, UserPlus } from 'lucide-react';

interface NewMemberHeaderProps {
  onBack: () => void;
}

const steps = [
  'Lengkapi identitas utama',
  'Buat akses akun member',
  'Periksa lalu daftarkan',
];

export default function NewMemberHeader({ onBack }: NewMemberHeaderProps) {
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

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-4 p-5 md:p-7">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-blue-500/15">
            <UserPlus size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Pendaftaran</p>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-950 dark:text-white md:text-3xl">
              Daftarkan Member Baru
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Isi data yang diperlukan untuk pelayanan. Kolom wajib ditandai dengan tanda bintang dan draft disimpan otomatis.
            </p>
          </div>
        </div>

        <div className="grid gap-2 border-t border-sky-100 bg-sky-50/70 p-3 dark:border-sky-500/10 dark:bg-sky-500/5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2 rounded-xl bg-white/75 px-3 py-2.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-950/25 dark:text-neutral-200">
              <CheckCircle2 size={15} className="shrink-0 text-sky-600 dark:text-sky-400" />
              <span>{index + 1}. {step}</span>
            </div>
          ))}
        </div>
      </section>
    </header>
  );
}
