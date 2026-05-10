'use client';

import { useEffect, useState } from 'react';
import EmptyState from '@/components/EmptyState';
import styles from '../dashboard-analytics.module.css';
import mobileStyles from './QuestionBankTable.mobile.module.css';

type Row = {
  _id: string;
  title: string;
  teacherName: string;
  subjectName: string;
  classCode: string;
  totalQuestions: number;
  createdAt: string;
  status: 'Pending' | 'Approved' | 'NeedsRevision' | 'NotRequired';
  examCategory?: 'semester' | 'ulangan';
  requiresCurriculumApproval?: boolean;
  revisionNote?: string | null;
};

const statusClass = {
  Pending: styles.pending,
  Approved: styles.approved,
  NeedsRevision: styles.rejected,
  NotRequired: styles.notRequired,
};

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

export default function QuestionBankTable({
  data = [],
  loading,
  error,
  onApprove,
  onRevision,
  updatingId,
}: {
  data?: Row[];
  loading?: boolean;
  error?: string;
  onApprove: (id: string) => void;
  onRevision: (id: string) => void;
  updatingId?: string;
}) {
  const isMobile = useIsMobile(640);

  if (loading) return <div className={styles.skeleton} />;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data.length) return <EmptyState compact icon={null} action={null} title="Belum ada data untuk periode ini" description="Bank soal yang dibuat guru akan tampil di sini." />;

  if (isMobile) {
    return (
      <div className={mobileStyles.cardList}>
        {data.map((row) => (
          <div key={row._id} className={mobileStyles.card}>
            <div className={mobileStyles.cardName}>{row.teacherName}</div>
            <div className={mobileStyles.cardSub}>{row.title || 'Bank soal'}</div>
            <div className={mobileStyles.metaGrid}>
              <div className={mobileStyles.metaItem}>
                <span className={mobileStyles.metaLabel}>Mata Pelajaran</span>
                <span className={mobileStyles.metaValue}>{row.subjectName}</span>
              </div>
              <div className={mobileStyles.metaItem}>
                <span className={mobileStyles.metaLabel}>Kelas</span>
                <span className={mobileStyles.metaValue}>{row.classCode}</span>
              </div>
              <div className={mobileStyles.metaItem}>
                <span className={mobileStyles.metaLabel}>Kategori</span>
                <span className={mobileStyles.metaValue}>
                  {row.examCategory === 'semester' ? 'Ujian Semester' : 'Ulangan'}
                </span>
              </div>
              <div className={mobileStyles.metaItem}>
                <span className={mobileStyles.metaLabel}>Jumlah Soal</span>
                <span className={mobileStyles.metaValue}>{row.totalQuestions}</span>
              </div>
              <div className={mobileStyles.metaItem}>
                <span className={mobileStyles.metaLabel}>Tanggal Dibuat</span>
                <span className={mobileStyles.metaValue}>
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString('id-ID') : '-'}
                </span>
              </div>
              <div className={mobileStyles.metaItem}>
                <span className={mobileStyles.metaLabel}>Status</span>
                <span className={`${styles.badge} ${statusClass[row.status]}`}>{row.status}</span>
              </div>
            </div>
            {row.revisionNote && (
              <div className={mobileStyles.revisionNote}>Revisi: {row.revisionNote}</div>
            )}
            {row.requiresCurriculumApproval ? (
              <div className={mobileStyles.actions}>
                <button
                  className={`${styles.button} ${styles.buttonSuccess} ${mobileStyles.actionBtn}`}
                  disabled={updatingId === row._id}
                  onClick={() => onApprove(row._id)}
                >
                  Approve
                </button>
                <button
                  className={`${styles.button} ${styles.buttonDanger} ${mobileStyles.actionBtn}`}
                  disabled={updatingId === row._id}
                  onClick={() => onRevision(row._id)}
                >
                  Revisi
                </button>
              </div>
            ) : (
              <div className={mobileStyles.noApproval}>Tidak perlu approval</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Guru Pembuat</th>
            <th>Mata Pelajaran</th>
            <th>Kategori</th>
            <th>Jumlah Soal</th>
            <th>Tanggal Dibuat</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row._id}>
              <td>
                <div className={styles.primaryText}>{row.teacherName}</div>
                <div className={styles.muted}>{row.title || 'Bank soal'}</div>
              </td>
              <td>
                <div className={styles.primaryText}>{row.subjectName}</div>
                <div className={styles.muted}>{row.classCode}</div>
              </td>
              <td>{row.examCategory === 'semester' ? 'Ujian Semester' : 'Ulangan'}</td>
              <td>{row.totalQuestions}</td>
              <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('id-ID') : '-'}</td>
              <td>
                <span className={`${styles.badge} ${statusClass[row.status]}`}>{row.status}</span>
                {row.revisionNote && <div className={styles.muted}>Revisi: {row.revisionNote}</div>}
              </td>
              <td>
                {row.requiresCurriculumApproval ? (
                  <div className={styles.actions}>
                    <button
                      className={`${styles.button} ${styles.buttonSuccess}`}
                      disabled={updatingId === row._id}
                      onClick={() => onApprove(row._id)}
                    >
                      Approve
                    </button>
                    <button
                      className={`${styles.button} ${styles.buttonDanger}`}
                      disabled={updatingId === row._id}
                      onClick={() => onRevision(row._id)}
                    >
                      Revisi
                    </button>
                  </div>
                ) : (
                  <span className={styles.muted}>Tidak perlu approval</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
