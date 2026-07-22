'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { notificationApi, type SystemNotification } from '@/lib/notificationApi';

export function SystemNotifications() {
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const result = await notificationApi.list(); setItems(result.data); setUnread(result.meta.unread); setError(''); } catch { setError('Notifikasi transaksi belum dapat dimuat.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);
  const read = async (item: SystemNotification) => { if (item.status === 'UNREAD') await notificationApi.read(item.id); await load(); };
  return <section className="space-y-3">
    <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><Bell size={18} /> Notifikasi Transaksi</h2><p className="text-sm text-neutral-500">{unread} belum dibaca · approval dan hasil verifikasi pembayaran.</p></div>{unread > 0 && <button onClick={async () => { await notificationApi.readAll(); await load(); }} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><CheckCheck size={16} /> Tandai dibaca</button>}</div>
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && !items.length ? <div className="flex items-center gap-2 rounded-xl border p-6 text-sm text-neutral-500"><Loader2 className="animate-spin" size={18} /> Memuat notifikasi…</div> : items.length ? <div className="space-y-2">{items.map((item) => <article key={item.id} className={`rounded-xl border p-4 ${item.status === 'UNREAD' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' : 'bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}><div className="flex items-start justify-between gap-3"><div><strong>{item.title}</strong><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{item.body}</p><small className="mt-2 block text-neutral-500">{new Date(item.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</small></div>{item.deepLink ? <Link href={item.deepLink} onClick={() => void read(item)} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-medium">Buka</Link> : item.status === 'UNREAD' && <button onClick={() => void read(item)} className="shrink-0 text-xs text-blue-600">Dibaca</button>}</div></article>)}</div> : !error && <p className="rounded-xl border p-6 text-center text-sm text-neutral-500">Belum ada notifikasi transaksi.</p>}
  </section>;
}
