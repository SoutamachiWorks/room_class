'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './student-attendance.module.css';

function StatusBadge({ status }) {
  const map = { hadir: styles.badgeHadir, sakit: styles.badgeSakit, izin: styles.badgeIzin, alpha: styles.badgeAlpha };
  const label = { hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpha: 'Alpha' };
  return <span className={map[status] || styles.badgeAlpha}>{label[status] || status}</span>;
}

function Skeleton({ h = 20, w = '100%', radius = 8 }) {
  return <div className={styles.skeleton} style={{ height: h, width: w, borderRadius: radius }} />;
}

export default function StudentAttendancePage() {
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = yearId ? `/api/student/attendance?yearId=${yearId}` : '/api/student/attendance';
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [yearId]);

  const stats = data?.stats ?? { hadir: 0, sakit: 0, izin: 0, alpha: 0 };
  const history = data?.history ?? [];
  const total = stats.hadir + stats.sakit + stats.izin + stats.alpha;
  const pct = total > 0 ? Math.round((stats.hadir / total) * 100) : 0;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Riwayat Kehadiran</h1>
          <p className={styles.pageSubtitle}>Rekap kehadiran Anda di semua mata pelajaran.</p>
        </div>
        {!loading && total > 0 && (
          <div className={styles.totalPctRow}>
            <span className={styles.totalPctLabel}>Kehadiran total:</span>
            <span className={`${styles.totalPctValue} ${pct >= 75 ? styles.totalPctGood : styles.totalPctBad}`}>
              {pct}%
            </span>
          </div>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Stats */}
      <div className={styles.statsGrid}>
        {loading ? (
          [0,1,2,3].map(i => <Skeleton key={i} h={90} radius={20} />)
        ) : (
          <>
            <div className={`${styles.statCard} ${styles.cardHadir}`}>
              <span className={styles.statValue}>{stats.hadir}</span>
              <span className={styles.statLabel}>Hadir</span>
            </div>
            <div className={`${styles.statCard} ${styles.cardSakit}`}>
              <span className={styles.statValue}>{stats.sakit}</span>
              <span className={styles.statLabel}>Sakit</span>
            </div>
            <div className={`${styles.statCard} ${styles.cardIzin}`}>
              <span className={styles.statValue}>{stats.izin}</span>
              <span className={styles.statLabel}>Izin</span>
            </div>
            <div className={`${styles.statCard} ${styles.cardAlpha}`}>
              <span className={styles.statValue}>{stats.alpha}</span>
              <span className={styles.statLabel}>Alpha</span>
            </div>
          </>
        )}
      </div>

      {/* History Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Detail Riwayat Absensi</h2>
            <p className={styles.cardSubtitle}>50 catatan absensi terbaru Anda.</p>
          </div>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[0,1,2,3,4].map(i => <Skeleton key={i} h={52} radius={10} />)}
          </div>
        ) : history.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p>Belum ada riwayat absensi Anda.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Mata Pelajaran</th>
                  <th>Status</th>
                  <th>Jam Check-in</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {history.map(record => (
                  <tr key={record._id}>
                    <td className={styles.cellDate}>
                      {new Date(record.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={styles.subjectChip}>{record.subjectName || '—'}</span>
                    </td>
                    <td>
                      <div className={styles.statusRow}>
                        <StatusBadge status={record.status} />
                        {record.isManual && <span className={styles.manualBadge}>dikoreksi</span>}
                      </div>
                    </td>
                    <td className={styles.cellSecondary}>
                      {record.checkedInAt
                        ? new Date(record.checkedInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className={styles.cellSecondary}>
                      {record.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
