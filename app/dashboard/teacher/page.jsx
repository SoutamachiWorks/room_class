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
  const [schedules, setSchedules] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. Fetch dashboard stats
    fetch('/api/teacher/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    // 2. Fetch today's schedule
    const today = new Date().getDay();
    const dayOfWeek = today === 0 ? 1 : today; // Jika minggu, anggap senin (fallback opsional, tapi biarkan saja)
    
    // Kita harus fetch api schedules untuk teacher. API sudah mendukung ?teacherId=...
    // Tapi kita bisa gunakan fitur API saat ini atau modifikasi.
    // Tunggu, API schedules kita mengambil payload.role == 'student' secara spesifik, 
    // jika teacher, dia perlu memberikan teacherId. Mari panggil auth/me dulu, 
    // atau biarkan API schedules yang mendeteksi otomatis jika role == 'teacher'.
    
    // Untuk efisiensi, panggil API auth/me lalu schedules
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        setAuthUser(d.user || null);
        if (d.user?.role === 'teacher') {
          // fetch schedule
          return fetch(`/api/schedules?teacherId=${d.user.username}&dayOfWeek=${dayOfWeek}`); // Di DB teacherId biasanya sama dengan username (G-100X)
        }
        throw new Error('Not a teacher');
      })
      .then(r => r.json())
      .then(d => setSchedules(d.schedules || []))
      .catch(e => console.error('Schedule fetch error', e))
      .finally(() => setSchedulesLoading(false));

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
        <div className={styles.headerActions}>
          {authUser?.isProctor && (
            <Link href="/dashboard/proctor" className={styles.btnSecondary}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4l3 3" />
              </svg>
              Monitoring Ujian
            </Link>
          )}
          <Link href="/dashboard/teacher/assignments" className={styles.btnPrimary}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Buat Tugas
          </Link>
        </div>
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

      <div className={styles.twoColumnGrid}>
        {/* ── Today's Schedule Widget ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Jadwal Mengajar Hari Ini</h2>
              <p className={styles.cardSubtitle}>Mata pelajaran yang harus Anda asuh hari ini.</p>
            </div>
          </div>

          {schedulesLoading ? (
            <div className={styles.skeletonList}>
              <Skeleton h={52} radius={10} />
              <Skeleton h={52} radius={10} />
            </div>
          ) : schedules.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-subtext)', marginBottom: 12 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <p>Tidak ada jadwal mengajar hari ini. Selamat beristirahat! ☕</p>
            </div>
          ) : (
            <div className={styles.scheduleList}>
              {schedules.map((sch) => {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const [sh, sm] = sch.startTime.split(':').map(Number);
                const [eh, em] = sch.endTime.split(':').map(Number);
                const startMins = sh * 60 + sm;
                const endMins = eh * 60 + em;
                const isActive = currentMinutes >= startMins && currentMinutes <= endMins;

                return (
                  <div key={sch._id} className={`${styles.scheduleItem} ${isActive ? styles.scheduleItemActive : ''}`}>
                    <div className={styles.scheduleTime}>
                      <span className={styles.scheduleStartTime}>{sch.startTime}</span>
                      <span className={styles.scheduleEndTime}>{sch.endTime}</span>
                    </div>
                    <div className={styles.scheduleDetails}>
                      <h4 className={styles.scheduleSubject}>{sch.subjectDetails?.subjectName || 'Mata Pelajaran'}</h4>
                      <span className={styles.scheduleClassBadge}>{sch.classCode}</span>
                    </div>
                    {isActive && (
                      <div className={styles.scheduleStatus}>
                        <span className={styles.badgeActive}>Sedang Berlangsung</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Ungraded Submissions Table ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Perlu Dikoreksi</h2>
              <p className={styles.cardSubtitle}>Jawaban siswa yang belum dinilai</p>
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

      </div> {/* Tutup twoColumnGrid */}

    </div>
  );
}
