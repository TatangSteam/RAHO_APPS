'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Loader2, Trash2, ListChecks } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { rainApi, RainChatResponse, RainContext } from '@/lib/rainApi';
import { useAuthStore } from '@/stores/authStore';
import styles from './rain.module.css';

type Message = { id: number; role: 'user' | 'assistant'; text: string; response?: RainChatResponse };
const suggestions = ['Kinerja hari ini', 'Daftar task hari ini', 'Task belum selesai minggu ini', 'Task terlambat', 'Bandingkan minggu ini dengan minggu lalu'];
const statuses: Record<string, string> = { TODO: 'Belum dimulai', IN_PROGRESS: 'Dikerjakan', SUBMITTED: 'Menunggu review', NEEDS_REVISION: 'Perlu revisi', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };

export default function RainPage() {
  const userId = useAuthStore((state) => state.user?.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<RainContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const serial = useRef(0);
  const generation = useRef(0);
  const pending = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  useEffect(() => {
    generation.current += 1;
    pending.current = false;
    setMessages([]); setContext(null); setInput(''); setError(''); setBusy(false);
    return () => { generation.current += 1; };
  }, [userId]);
  useEffect(() => { history.current?.scrollTo({ top: history.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending.current || !userId) return;
    pending.current = true;
    const version = generation.current;
    setBusy(true); setError(''); setInput('');
    const userMessage: Message = { id: ++serial.current, role: 'user', text: message };
    setMessages((current) => [...current.slice(-59), userMessage]);
    try {
      const response = await rainApi.chat(message, context || undefined);
      if (generation.current !== version) return;
      const assistantMessage: Message = { id: ++serial.current, role: 'assistant', text: response.reply, response };
      setMessages((current) => [...current.slice(-59), assistantMessage]);
      setContext(response.context);
    } catch (requestError) {
      assertCaughtError(requestError);
      if (generation.current !== version) return;
      setError(requestError.response?.data?.error?.message || 'RAIN belum dapat memuat data. Coba lagi; tidak ada task yang diubah.');
      setInput(message);
    } finally {
      if (generation.current === version) { setBusy(false); pending.current = false; }
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void send(input); };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1><MessageSquare size={25} /> RAIN</h1><p>Asisten task personal dari data ERP</p></div>
      <Link href="/extra/collaboration/tasks"><ListChecks size={16} /> Buka Tim & Tugas</Link>
    </header>
    <p className={styles.notice}>Versi awal berbasis aturan, belum memakai model AI. Hanya membaca task yang ditugaskan kepada akun Anda pada tim aktif. Tidak membuat, mengubah, atau menghapus task.</p>
    <section className={styles.chat} aria-label="Chat RAIN">
      <div className={styles.toolbar}><span>Percakapan tidak disimpan setelah halaman ditutup.</span><button type="button" disabled={busy || messages.length === 0} onClick={() => { setMessages([]); setContext(null); setError(''); }} aria-label="Bersihkan percakapan"><Trash2 size={16} /> Bersihkan</button></div>
      <div ref={history} className={styles.history} role="log" aria-live="polite" aria-relevant="additions">
        {!messages.length && <div className={styles.welcome}><h2>Apa yang ingin Anda cek?</h2><p>Tanyakan jumlah task, progres, daftar pekerjaan, atau deadline yang terlewat. Periode mengikuti Asia/Jakarta dan status task saat ini.</p><small>Tanggal custom: “Kinerja 2026-09-01 sampai 2026-09-15”. Perbandingan: “Bandingkan 2026-09-01 sampai 2026-09-15 dengan 2026-08-01 sampai 2026-08-15”.</small></div>}
        {messages.map((message) => <article key={message.id} className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
          <strong>{message.role === 'user' ? 'Anda' : 'RAIN'}</strong><p>{message.text}</p>
          {message.response?.data?.tasks?.map((task) => <div className={styles.task} key={task.id}>
            <strong>{task.title}</strong><span>{task.parentTaskId ? 'Subtask' : 'Task'} · {statuses[task.status] || task.status} · {task.priority}</span>
            <span>Tenggat: {new Date(task.dueAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}{task.overdue ? ` · Terlambat${task.overdueDays !== undefined ? ` ${task.overdueDays} hari kalender` : ''}` : ''}</span>
          </div>)}
          {message.response && <small>ERP · {new Date(message.response.asOf).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</small>}
        </article>)}
        {busy && <p className={styles.loading} role="status"><Loader2 size={16} className={styles.spinner} /> Membaca data ERP…</p>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.suggestions} aria-label="Contoh pertanyaan">{suggestions.map((text) => <button type="button" key={text} disabled={busy} onClick={() => void send(text)}>{text}</button>)}{context && <button type="button" disabled={busy} onClick={() => void send('lanjut')}>Lanjut hasil berikutnya</button>}</div>
      <form onSubmit={submit} className={styles.composer}>
        <label className={styles.srOnly} htmlFor="rain-message">Pertanyaan untuk RAIN</label>
        <input id="rain-message" maxLength={1000} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Contoh: Gimana kinerja gue hari ini?" disabled={busy} autoComplete="off" />
        <button type="submit" disabled={busy || !input.trim()}><Send size={17} /> Kirim</button>
      </form>
    </section>
  </main>;
}
