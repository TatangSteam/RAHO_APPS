'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  History,
  Package,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const workflow = [
  {
    number: '01',
    title: 'Siapkan kebutuhan',
    description: 'Admin Layanan melihat jadwal sesi dan menyiapkan kebutuhan material tim.',
  },
  {
    number: '02',
    title: 'Konfirmasi bersama',
    description: 'Nakes memeriksa item, jumlah, batch, dan kondisi barang sebelum digunakan.',
  },
  {
    number: '03',
    title: 'Gunakan di sesi',
    description: 'Pemakaian tetap dicatat dari langkah Material Usage pada sesi terapi.',
  },
  {
    number: '04',
    title: 'Rekonsiliasi',
    description: 'Tim memeriksa sisa fisik dan riwayat; koreksi stok tetap melalui approval.',
  },
];

const responsibilities = [
  {
    title: 'Admin Layanan',
    icon: ClipboardList,
    color: 'amber',
    items: [
      'Memastikan tim dan sesi yang dilayani sudah benar.',
      'Mengajukan kebutuhan atau tambahan stok.',
      'Memeriksa status permintaan dan pengiriman.',
      'Tidak mengubah saldo stok secara langsung.',
    ],
  },
  {
    title: 'Tenaga Kesehatan',
    icon: Stethoscope,
    color: 'emerald',
    items: [
      'Memeriksa material sebelum tindakan.',
      'Mencatat jumlah aktual yang digunakan pada sesi.',
      'Memberikan alasan jika penggunaan berbeda dari rekomendasi.',
      'Melaporkan barang rusak, kurang, atau kedaluwarsa.',
    ],
  },
];

const legacyLinks = [
  {
    href: '/sessions',
    title: 'Catat Pemakaian di Sesi',
    description: 'Buka sesi terapi dan isi langkah Material Usage.',
    icon: Stethoscope,
  },
  {
    href: '/inventory',
    title: 'Lihat Stok Cabang',
    description: 'Periksa stok tersedia tanpa mengubah flow lama.',
    icon: Boxes,
  },
  {
    href: '/inventory/material-usage-history',
    title: 'Riwayat Penggunaan',
    description: 'Telusuri material yang sudah dipakai pada terapi.',
    icon: History,
  },
  {
    href: '/inventory/homecare-bags',
    title: 'Tas Homecare',
    description: 'Gunakan flow tas dan penyerahan stok homecare yang sudah tersedia.',
    icon: Package,
  },
];

export default function TeamInventoryComingSoonPage() {
  const { user } = useAuthStore();
  const isNurse = user?.role === 'NURSE';

  return (
    <main className="min-h-screen bg-neutral-50 p-4 text-neutral-900 dark:bg-neutral-950 dark:text-white md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-neutral-900 dark:to-emerald-500/10 md:p-9">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
              <Sparkles size={14} />
              Coming Soon
            </span>
            <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-black">
                    <UsersRound size={25} />
                  </div>
                  <h1 className="text-2xl font-bold md:text-3xl">Inventori Tim Layanan</h1>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300 md:text-base">
                  Ruang kerja sederhana untuk Admin Layanan dan Tenaga Kesehatan dalam menyiapkan,
                  menggunakan, dan merekonsiliasi material setiap tim.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white/80 p-4 text-sm dark:border-emerald-500/20 dark:bg-neutral-900/80">
                <p className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck size={18} />
                  Flow lama tetap aktif
                </p>
                <p className="mt-2 max-w-xs text-neutral-600 dark:text-neutral-400">
                  Halaman ini belum mengubah stok. Gunakan menu operasional di bawah sampai fitur tim dirilis.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 md:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Rencana alur
              </p>
              <h2 className="mt-1 text-xl font-bold">Empat langkah yang mudah diikuti</h2>
            </div>
            <p className="text-sm text-neutral-500">
              Anda masuk sebagai {isNurse ? 'Tenaga Kesehatan' : 'Admin/Koordinator'}.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step) => (
              <article key={step.number} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400">{step.number}</span>
                <h3 className="mt-2 font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-5 text-neutral-600 dark:text-neutral-400">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {responsibilities.map(({ title, icon: Icon, color, items }) => (
            <article key={title} className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 md:p-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  color === 'amber'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                }`}>
                  <Icon size={21} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Petunjuk peran</p>
                  <h2 className="font-bold">{title}</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 md:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Gunakan sekarang
            </p>
            <h2 className="mt-1 text-xl font-bold">Jalur operasional yang tetap berjalan</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Pilih sesuai pekerjaan Anda. Semua tautan menggunakan flow inventory lama yang sudah tersedia.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {legacyLinks.map(({ href, title, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-w-0 items-center gap-4 rounded-2xl border border-neutral-200 p-4 transition hover:border-amber-400 hover:bg-amber-50 dark:border-neutral-800 dark:hover:border-amber-500/50 dark:hover:bg-amber-500/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 group-hover:bg-amber-100 group-hover:text-amber-700 dark:bg-neutral-800 dark:text-neutral-200">
                  <Icon size={21} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{description}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-neutral-400 group-hover:text-amber-600" />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">Aturan pencatatan yang benar</h2>
              <p className="mt-2 leading-6">
                Catat material aktual dari sesi terapi, jangan mengurangi stok secara manual. Jika jumlah berbeda,
                isi alasan deviasi. Untuk selisih fisik gunakan adjustment/opname melalui petugas berwenang agar
                audit, HPP, dan sinkronisasi logistik tetap konsisten.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
