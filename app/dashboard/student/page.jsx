'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './student-dashboard.module.css';

// ── Utilities ─────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function DeadlineBadge({ deadline }) {
  if (!deadline) return <span className={styles.badgeGray}>Tanpa Batas</span>;
  const days = daysUntil(deadline);
  if (days < 0) return <span className={styles.badgeRed}>Lewat Deadline</span>;
  if (days === 0) return <span className={styles.badgeRed}>Hari Ini!</span>;
  if (days === 1) return <span className={styles.badgeOrange}>Besok</span>;
  return <span className={styles.badgeBlue}>{days} hari lagi</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 20, w = '100%', radius = 8 }) {
  return (
    <div className={styles.skeleton} style={{ height: h, width: w, borderRadius: radius }} />
  );
}

// ── Widget Card ───────────────────────────────────────────────────────────────
function Widget({ title, subtitle, children, action, actionHref }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{title}</h2>
          {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
        </div>
        {action && actionHref && (
          <Link href={actionHref} className={styles.cardAction}>{action}</Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Active Attendance Widget ───────────────────────────────────────────────────
function AttendanceWidget() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loadingSession, setLoadingSession] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/student/attendance');
      const data = await res.json();
      if (data.activeSession) {
        setSession(data.activeSession);
        setCheckedIn(data.activeSession.alreadyCheckedIn);
      } else {
        setSession(null);
      }
    } catch (_) {}
    finally { setLoadingSession(false); }
  }, []);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  // Countdown timer
  useEffect(() => {
    if (!session?.expiresAt) return;
    const tick = () => {
      const diff = new Date(session.expiresAt) - new Date();
      setTimeLeft(Math.max(0, diff));
      if (diff <= 0) setSession(null); // hide widget when expired
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.expiresAt]);

  const handleCheckIn = async () => {
    if (!session || checking || checkedIn) return;
    setChecking(true);
    try {
      const res = await fetch('/api/student/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCheckedIn(true);
      } else {
        alert(data.error || 'Gagal melakukan absensi.');
        if (data.alreadyCheckedIn) setCheckedIn(true);
      }
    } catch (_) {
      alert('Koneksi ke server gagal.');
    } finally {
      setChecking(false);
    }
  };

  if (loadingSession || !session) return null;

  const minutes = String(Math.floor(timeLeft / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0');

  return (
    <div className={styles.attendanceWidget}>
      <div className={styles.attendancePulse} />
      <div className={styles.attendanceContent}>
        <div className={styles.attendanceInfo}>
          <span className={styles.attendanceLive}>ABSENSI AKTIF</span>
          <h3 className={styles.attendanceSubject}>{session.subjectName}</h3>
          <p className={styles.attendanceTimer}>
            Waktu tersisa: <strong>{minutes}:{seconds}</strong>
          </p>
        </div>
        <div className={styles.attendanceAction}>
          {checkedIn ? (
            <div className={styles.checkedInBox}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Sudah Absen!</span>
            </div>
          ) : (
            <button
              className={styles.btnCheckIn}
              onClick={handleCheckIn}
              disabled={checking}
            >
              {checking ? 'Memproses...' : '✋ Klik untuk Hadir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function StudentDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedYearId = searchParams.get('yearId') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const url = selectedYearId ? `/api/student/dashboard?yearId=${selectedYearId}` : '/api/student/dashboard';
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        // If no year in URL but data has years, sync URL with last year (current)
        if (!selectedYearId && d.enrolledYears?.length > 0) {
          const currentYearId = d.enrolledYears[d.enrolledYears.length - 1].yearId;
          router.replace(`/dashboard/student?yearId=${currentYearId}`);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedYearId, router]);

  const years = data?.enrolledYears || [];
  const activeYear = years.find(y => y.yearId === selectedYearId) || (years.length > 0 ? years[years.length - 1] : null);
  const isArchiveMode = activeYear && years.length > 0 && selectedYearId !== years[years.length - 1].yearId;

  const pending = data?.pendingAssignments ?? [];
  const exams = data?.availableExams ?? [];
  const grades = data?.recentGrades ?? [];


  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard Saya</h1>
          <p className={styles.pageSubtitle}>Pantau tugas, ujian, dan nilai terbaru Anda.</p>
        </div>

        {/* ── Academic Year Switcher (Refinement: Only show if > 1) ── */}
        {!loading && years.length > 0 && (
          <div className={styles.headerSwitcher}>
            <span className={styles.yearLabel}>Tahun Ajaran:</span>
            {years.length > 1 ? (
              <select 
                className={styles.yearSelect}
                value={selectedYearId}
                onChange={(e) => router.push(`/dashboard/student?yearId=${e.target.value}`)}
              >
                {years.map(y => (
                  <option key={y.yearId} value={y.yearId}>{y.label}</option>
                ))}
              </select>
            ) : (
              <span className={styles.staticYear}>{years[0].label}</span>
            )}
          </div>
        )}
      </div>

      {isArchiveMode && (
        <div className={styles.archiveBanner}>
          <svg className={styles.archiveIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            Mode Arsip: Anda sedang melihat data kelas tahun ajaran sebelumnya.
          </div>
        </div>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ── Active Attendance Session Widget (Hidden in Archive Mode) ── */}
      {!isArchiveMode && <AttendanceWidget />}

      {/* ── Two Column Layout ── */}
      <div className={styles.grid}>

        {/* ── LEFT: To‑Do Assignments ── */}
        <Widget
          title="📋 To-Do List Tugas"
          subtitle="Tugas yang belum dikumpulkan, diurutkan dari deadline terdekat"
          action="Lihat semua"
          actionHref={`/dashboard/student/assignments${selectedYearId ? `?yearId=${selectedYearId}` : ''}`}
        >
          {loading ? (
            <div className={styles.skeletonList}>
              {[0, 1, 2, 3].map(i => <Skeleton key={i} h={70} radius={12} />)}
            </div>
          ) : pending.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <p>Tidak ada tugas yang perlu dikerjakan! 🎉</p>
            </div>
          ) : (
            <div className={styles.taskList}>
              {pending.map(task => {
                const days = daysUntil(task.deadline);
                const isUrgent = days !== null && days <= 1;
                return (
                  <Link
                    key={task._id}
                    href="/dashboard/student/assignments"
                    className={`${styles.taskItem} ${isUrgent ? styles.taskUrgent : ''}`}
                  >
                    <div className={styles.taskLeft}>
                      <div className={`${styles.taskDot} ${isUrgent ? styles.dotRed : styles.dotBlue}`} />
                      <div>
                        <div className={styles.taskTitle}>
                          {task.text?.length > 70 ? task.text.substring(0, 70) + '…' : task.text}
                        </div>
                        <div className={styles.taskMeta}>
                          <span className={styles.subjectTag}>{task.subjectName}</span>
                          {task.deadline && (
                            <span className={styles.deadlineText}>
                              Deadline: {formatDate(task.deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <DeadlineBadge deadline={task.deadline} />
                  </Link>
                );
              })}
            </div>
          )}
        </Widget>

        {/* ── RIGHT: Exams + Grades ── */}
        <div className={styles.rightCol}>

          {/* Available Exams */}
          <Widget
            title="🎯 Ujian Tersedia"
            subtitle="Ujian yang sudah dipublish oleh guru"
            action="Lihat semua"
            actionHref={`/dashboard/student/exams${selectedYearId ? `?yearId=${selectedYearId}` : ''}`}
          >
            {loading ? (
              <div className={styles.skeletonList}>
                {[0, 1].map(i => <Skeleton key={i} h={62} radius={12} />)}
              </div>
            ) : exams.length === 0 ? (
              <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>
                <p className={styles.emptyStateText}>Tidak ada ujian aktif saat ini.</p>
              </div>
            ) : (
              <div className={styles.examList}>
                {exams.slice(0, 4).map(exam => (
                  <Link key={exam._id} href="/dashboard/student/exams" className={styles.examItem}>
                    <div className={styles.examIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <div className={styles.examBody}>
                      <div className={styles.examTitle}>{exam.title}</div>
                      <div className={styles.examMeta}>
                        {exam.subjectName} · {exam.totalQuestions} soal
                      </div>
                    </div>
                    <span className={styles.badgeGreen}>Mulai →</span>
                  </Link>
                ))}
              </div>
            )}
          </Widget>

          {/* Recent Grades */}
          <Widget
            title="📊 Nilai Terbaru"
            subtitle="Tugas yang sudah dikoreksi guru"
            action="Lihat semua"
            actionHref={`/dashboard/student/assignments${selectedYearId ? `?yearId=${selectedYearId}` : ''}`}
          >
            {loading ? (
              <div className={styles.skeletonList}>
                {[0, 1, 2].map(i => <Skeleton key={i} h={56} radius={12} />)}
              </div>
            ) : grades.length === 0 ? (
              <div className={`${styles.emptyState} ${styles.emptyStateCompact}`}>
                <p className={styles.emptyStateText}>Belum ada nilai yang masuk.</p>
              </div>
            ) : (
              <div className={styles.gradeList}>
                {grades.map(g => {
                  const score = parseFloat(g.score);
                  const scoreClass = score >= 80 ? styles.scoreGreen : score >= 60 ? styles.scoreOrange : styles.scoreRed;
                  return (
                    <div key={g.submissionId} className={styles.gradeItem}>
                      <div className={styles.gradeBody}>
                        <div className={styles.gradeTitle}>
                          {g.assignmentTitle?.length > 50
                            ? g.assignmentTitle.substring(0, 50) + '…'
                            : g.assignmentTitle}
                        </div>
                        <div className={styles.gradeMeta}>
                          {g.subjectName} · {formatDate(g.gradedAt)}
                          {g.isLate && <span className={styles.lateBadge}>Terlambat</span>}
                        </div>
                        {isArchiveMode && (
                          <div className={styles.archiveNote}>File unggahan tugas telah dibersihkan dari server.</div>
                        )}
                      </div>
                      <div className={`${styles.scoreCircle} ${scoreClass}`}>
                        {score % 1 === 0 ? score : score.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Widget>

        </div>
      </div>
    </div>
  );
}
