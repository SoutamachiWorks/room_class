'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import styles from './proctor-dashboard.module.css';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function getStatusLabel(status: string) {
  if (status === 'published') return 'Publikasi';
  if (status === 'draft') return 'Draft';
  return status || '-';
}

export default function ProctorDashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isMobile = useIsMobile(640);

  useEffect(() => {
    fetch('/api/proctor/sessions')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat sesi ujian');
        return res.json();
      })
      .then((data) => setSessions(data.sessions || []))
      .catch((err) => setError(err.message || 'Terjadi kesalahan'))
      .finally(() => setLoading(false));
  }, []);

  const publishedCount = sessions.filter((item: any) => item.status === 'published').length;
  const draftCount = sessions.filter((item: any) => item.status === 'draft').length;

  return (
    <>
      <PageHeader
        title="Monitoring Ujian"
        subtitle="Daftar ujian yang ditugaskan untuk Anda sebagai pengawas."
      >
        <div className={styles.headerActions}>
          <Link href="/dashboard/teacher" className={styles.backBtn}>
            Kembali ke Dashboard Guru
          </Link>
        </div>
      </PageHeader>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p>Total Ujian Ditugaskan</p>
          <strong>{sessions.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Ujian Publikasi</p>
          <strong>{publishedCount}</strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Ujian Draft</p>
          <strong>{draftCount}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        {loading && <div className={styles.loadingBox}>Memuat daftar ujian pengawasan...</div>}
        {!loading && error && <p className={styles.errorText}>{error}</p>}
        {!loading && !error && sessions.length === 0 && (
          <EmptyState title="Belum Ada Ujian Ditugaskan" description="Pastikan admin sudah menetapkan Anda sebagai pengawas pada ujian tertentu." icon={undefined} action={undefined} />
        )}
        {!loading && !error && sessions.length > 0 && (
          isMobile ? (
            /* ── Mobile card list ── */
            <div className={styles.mobileList}>
              {sessions.map((session: any) => (
                <div key={session.id} className={styles.mobileCard}>
                  <div className={styles.mobileCardTop}>
                    <div className={styles.mobileCardTitle}>{session.title}</div>
                    <span className={`${styles.mobileStatusBadge} ${session.status === 'published' ? styles.mobileStatusPublished : styles.mobileStatusDraft}`}>
                      {getStatusLabel(session.status)}
                    </span>
                  </div>
                  <div className={styles.mobileCardMeta}>
                    <div>
                      <span className={styles.mobileMetaLabel}>Mata Pelajaran</span>
                      <span className={styles.mobileMetaValue}>{session.subjectName || '-'}</span>
                    </div>
                    <div>
                      <span className={styles.mobileMetaLabel}>Kelas</span>
                      <span className={styles.mobileMetaValue}>{session.classCode || '-'}</span>
                    </div>
                    <div>
                      <span className={styles.mobileMetaLabel}>Dibuat</span>
                      <span className={styles.mobileMetaValue}>
                        {session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                  </div>
                  <div className={styles.mobileCardActions}>
                    <Link className={`${styles.monitorBtn} ${styles.monitorBtnPrimary}`} href={`/dashboard/proctor/${session.id}/monitoring`}>
                      Buka Monitoring
                    </Link>
                    <Link className={styles.monitorBtn} href={`/dashboard/proctor/${session.id}/questions`}>
                      Lihat Soal
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Desktop table ── */
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Judul Ujian</th>
                    <th>Mata Pelajaran</th>
                    <th>Kelas</th>
                    <th>Status</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session: any) => (
                    <tr key={session.id}>
                      <td>{session.title}</td>
                      <td>{session.subjectName || '-'}</td>
                      <td>{session.classCode || '-'}</td>
                      <td>{getStatusLabel(session.status)}</td>
                      <td>{session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString('id-ID') : '-'}</td>
                      <td>
                        <div className={styles.actionRow}>
                          <Link className={styles.monitorBtn} href={`/dashboard/proctor/${session.id}/monitoring`}>
                            Buka Monitoring
                          </Link>
                          <Link className={styles.monitorBtn} href={`/dashboard/proctor/${session.id}/questions`}>
                            Lihat Soal
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </>
  );
}
