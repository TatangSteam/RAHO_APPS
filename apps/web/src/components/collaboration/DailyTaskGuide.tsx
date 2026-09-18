'use client';

import { useId, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TeamRole } from '@/lib/collaborationApi';
import { taskGuideTopics } from './taskGuideContent';
import styles from './DailyTaskGuide.module.css';

export default function DailyTaskGuide({ teamRole }: { teamRole?: TeamRole }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const panelId = useId();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const topic = taskGuideTopics[index];

  const choose = (nextIndex: number) => {
    setIndex(nextIndex);
    headingRef.current?.focus();
  };
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <section className={styles.guide} aria-label="Bantuan penggunaan Daily Task">
    <div className={styles.banner}>
      <div><BookOpen size={22} aria-hidden="true" /><div>
        <h2>Baru memakai Tim &amp; Tugas?</h2>
        <p>Baca langkah dari awal, arti setiap angka, dan contoh pekerjaan sehari-hari.</p>
      </div></div>
      <button ref={triggerRef} type="button" className="btn btn-secondary" aria-expanded={open} aria-controls={panelId} onClick={() => open ? close() : setOpen(true)}>
        <BookOpen size={17} aria-hidden="true" />{open ? 'Tutup panduan' : 'Panduan Daily Task'}
      </button>
    </div>
    {open && <div id={panelId} className={styles.panel}>
      <div className={styles.intro}>
        <div><h2>Panduan Daily Task untuk pemula</h2><p>Mulai dari bagian 1. Pilih topik di bawah jika Anda hanya ingin mencari satu jawaban. Panduan ini hanya untuk dibaca dan tidak mengubah data.</p></div>
        <button type="button" className={styles.close} aria-label="Tutup panduan penggunaan" onClick={close}><X size={22} aria-hidden="true" /></button>
      </div>
      <p className={styles.roleHint}>
        {teamRole === 'STAFF'
          ? 'Anda sebagai Staff di tim aktif: setelah membaca pengenalan, gunakan bagian 3 untuk mengerjakan tugas.'
          : teamRole === 'OWNER' || teamRole === 'LEADER'
            ? `Anda sebagai ${teamRole === 'OWNER' ? 'Owner' : 'Leader'} di tim aktif: bagian 5 membantu membagikan tugas dan bagian 6 membantu memeriksa hasil.`
            : 'Belum memilih tim? Baca bagian 1 dahulu. Jika Anda pelaksana, minta Owner menambahkan akun Anda ke tim.'}
      </p>
      <nav className={styles.topics} aria-label="Topik panduan Daily Task">
        {taskGuideTopics.map((item, itemIndex) => <button key={item.id} type="button" aria-pressed={index === itemIndex} aria-controls={headingId} onClick={() => choose(itemIndex)}>
          <span aria-hidden="true">{itemIndex + 1}</span>{item.label}
        </button>)}
      </nav>
      <article className={styles.article} aria-labelledby={headingId}>
        <p className={styles.progress}>Bagian {index + 1} dari {taskGuideTopics.length}</p>
        <h3 id={headingId} ref={headingRef} tabIndex={-1}>{topic.title}</h3>
        <p>{topic.introduction}</p>
        <h4>Ikuti langkah ini</h4>
        <ol>{topic.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        {topic.reference && <section className={styles.reference} aria-label={topic.reference.heading}>
          <h4>{topic.reference.heading}</h4>
          <dl>{topic.reference.rows.map((row) => <div key={row.name}><dt>{row.name}</dt><dd>{row.explanation}</dd></div>)}</dl>
        </section>}
        {topic.example && <section className={styles.example}><h4>Contoh supaya lebih mudah dipahami</h4><p>{topic.example}</p></section>}
        <section className={styles.reminder}><h4>Yang perlu diingat</h4><p>{topic.reminder}</p></section>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => choose(index - 1)}><ChevronLeft size={17} aria-hidden="true" />Bagian sebelumnya</button>
          {index < taskGuideTopics.length - 1
            ? <button type="button" className="btn btn-primary" onClick={() => choose(index + 1)}>Bagian berikutnya<ChevronRight size={17} aria-hidden="true" /></button>
            : <button type="button" className="btn btn-primary" onClick={close}>Selesai membaca</button>}
        </div>
      </article>
    </div>}
  </section>;
}
