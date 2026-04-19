'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './teacher-dashboard.module.css';

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={styles.statCard} style={{ '--accent': accent }}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value ?? '—'}</span>
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 20, w = '100%', radius = 8 }) {
  return (
    <div
      className={styles.skeleton}
      style={{ height: h, width: w, borderRadius: radius }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/teacher/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;
  const ungraded = data?.ungradedSubmissions ?? [];

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Command Center</h1>
          <p className={styles.pageSubtitle}>Ringkasan aktivitas kelas Anda hari ini.</p>
        </div>
        <Link href="/dashboard/teacher/assignments" className={styles.btnPrimary}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Buat Tugas
        </Link>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ── Stat Cards ── */}
      <div className={styles.statsGrid}>
        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} className={styles.statCard}>
              <Skeleton h={44} w={44} radius={12} />
              <div className={styles.statBody}>
                <Skeleton h={14} w={80} />
                <Skeleton h={32} w={60} />
              </div>
            </div>
          ))
        ) : (
          <>
            <StatCard
              accent="#78A3FF"
              label="Total Siswa"
              value={stats?.totalStudents}
              sub="Dari semua kelas Anda"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
            <StatCard
              accent="#6EE7B7"
              label="Ujian Published"
              value={stats?.activeExams}
              sub="Ujian yang sedang aktif"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              }
            />
            <StatCard
              accent="#FCA5A5"
              label="Tugas Aktif"
              value={stats?.activeAssignments}
              sub={`Dari ${stats?.totalAssignments ?? 0} total tugas`}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* ── Ungraded Submissions Table ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Perlu Dikoreksi</h2>
            <p className={styles.cardSubtitle}>Jawaban siswa yang belum mendapat nilai</p>
          </div>
          {!loading && ungraded.length > 0 && (
            <span className={styles.badgeRed}>{ungraded.length} tugas</span>
          )}
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[0, 1, 2].map(i => <Skeleton key={i} h={52} radius={10} />)}
          </div>
        ) : ungraded.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-subtext)', marginBottom: 12 }}>
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <p>Semua jawaban sudah dikoreksi! 🎉</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Tugas</th>
                  <th>Mata Pelajaran</th>
                  <th>Dikumpulkan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ungraded.map(item => (
                  <tr key={item.submissionId}>
                    <td>
                      <div className={styles.studentCell}>
                        <div className={styles.avatarSmall}>
                          {item.studentName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className={styles.studentName}>{item.studentName}</div>
                          <div className={styles.classCode}>{item.classCode}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.assignmentTitle} title={item.assignmentTitle}>
                        {item.assignmentTitle.length > 45
                          ? item.assignmentTitle.substring(0, 45) + '…'
                          : item.assignmentTitle}
                      </span>
                    </td>
                    <td><span className={styles.subjectChip}>{item.subjectName}</span></td>
                    <td className={styles.dateCell}>
                      {item.submittedAt
                        ? new Date(item.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      {item.isLate
                        ? <span className={styles.badgeRed}>Terlambat</span>
                        : <span className={styles.badgeGreen}>Tepat Waktu</span>}
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/teacher/assignments/${item.assignmentId}`}
                        className={styles.btnGrade}
                      >
                        Koreksi →
                      </Link>
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
