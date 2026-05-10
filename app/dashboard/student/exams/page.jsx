'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import styles from './student-exams.module.css';

// Hook to detect mobile viewport
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

const FILTER_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'available', label: 'Tersedia' },
  { key: 'submitted', label: 'Sudah Dikerjakan' },
  { key: 'review', label: 'Menunggu Koreksi' },
  { key: 'locked', label: 'Terkunci' },
];

const STATS_META = {
  all: { label: 'Total Ujian', sub: 'Semua ujian', color: 'var(--accent-blue)' },
  submitted: { label: 'Selesai', sub: 'Sudah dikerjakan', color: 'var(--accent-green)' },
  available: { label: 'Tersedia', sub: 'Siap dikerjakan', color: 'var(--accent-yellow)' },
  locked: { label: 'Terkunci', sub: 'Belum tersedia', color: 'var(--accent-red)' },
};

function formatIdDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatIdDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

// SVG Icons
const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconFlame = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c0 0-5 4.5-5 9a5 5 0 0 0 10 0c0-4.5-5-9-5-9zm0 14a3 3 0 0 1-3-3c0-2 1.5-4 3-5.5C13.5 9 15 11 15 13a3 3 0 0 1-3 3z"/>
  </svg>
);

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

function StudentExamsContent() {
  const [exams, setExams] = useState([]);
  const [enrolledYears, setEnrolledYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const isMobile = useIsMobile(640);

  const router = useRouter();
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');
  const isSubmitted = searchParams.get('submitted') === '1';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const url = yearId ? `/api/student/exams?yearId=${yearId}` : '/api/student/exams';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setExams(data.exams || []);
        setEnrolledYears(data.enrolledYears || []);
      }
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    const timer = setTimeout(() => fetchExams(), 0);
    return () => clearTimeout(timer);
  }, [fetchExams]);

  const getSessionStatus = useCallback((exam) => {
    const baseStatus = exam.session?.status || 'available';

    if (exam.isExamOpen === false && baseStatus !== 'submitted') {
      return 'locked';
    }

    if ((baseStatus === 'available' || baseStatus === 'in-progress') && exam.deadline) {
      if (new Date(exam.deadline).getTime() < currentTime) {
        return 'locked';
      }
    }

    if (baseStatus === 'submitted' && exam.session?.gradingStatus === 'pending-manual') {
      return 'review';
    }

    if (baseStatus === 'submitted') return 'submitted';
    if (baseStatus === 'locked') return 'locked';
    return 'available';
  }, [currentTime]);

  const enrichedExams = useMemo(() => exams.map((exam) => ({ ...exam, uiStatus: getSessionStatus(exam) })), [exams, getSessionStatus]);

  const stats = useMemo(() => {
    const total = enrichedExams.length;
    const submitted = enrichedExams.filter((e) => e.uiStatus === 'submitted' || e.uiStatus === 'review').length;
    const available = enrichedExams.filter((e) => e.uiStatus === 'available').length;
    const locked = enrichedExams.filter((e) => e.uiStatus === 'locked').length;
    return { total, submitted, available, locked };
  }, [enrichedExams]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return enrichedExams.filter((exam) => {
      const byTab = activeTab === 'all' ? true : exam.uiStatus === activeTab;
      const bySearch = keyword ? exam.title?.toLowerCase().includes(keyword) : true;
      return byTab && bySearch;
    });
  }, [activeTab, enrichedExams, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pagedExams = filtered.slice(startIndex, startIndex + rowsPerPage);

  const isArchiveMode = yearId && enrolledYears.length > 0 && yearId !== enrolledYears[enrolledYears.length - 1].yearId;

  const handleStartExam = async (exam) => {
    setStartingId(exam._id);
    setNotifBlocked(false);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = Notification.permission;
      if (perm === 'denied') {
        setNotifBlocked(true);
        setStartingId(null);
        return;
      }
      if (perm === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          setNotifBlocked(true);
          setStartingId(null);
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/student/exams/${exam._id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.locked) router.push('/dashboard/student/exams/lockout');
        else alert(data.error || 'Gagal memulai ujian.');
        setStartingId(null);
        return;
      }
      router.push(`/dashboard/student/exams/${exam._id}/take`);
    } catch {
      alert('Koneksi ke server gagal.');
      setStartingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={<>Ujian {isArchiveMode && <span className={styles.archiveTag}>(Mode Arsip)</span>}</>}
        subtitle="Daftar ujian yang dipublikasikan oleh guru untuk kelas Anda."
      />

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ '--icon-color': STATS_META.all.color }}>
            <IconDoc />
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>{STATS_META.all.label}</p>
            <p className={styles.statValue}>{stats.total}</p>
            <p className={styles.statSub}>{STATS_META.all.sub}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ '--icon-color': STATS_META.submitted.color }}>
            <IconCheck />
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>{STATS_META.submitted.label}</p>
            <p className={styles.statValue}>{stats.submitted}</p>
            <p className={styles.statSub}>{STATS_META.submitted.sub}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ '--icon-color': STATS_META.available.color }}>
            <IconClock />
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>{STATS_META.available.label}</p>
            <p className={styles.statValue}>{stats.available}</p>
            <p className={styles.statSub}>{STATS_META.available.sub}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ '--icon-color': STATS_META.locked.color }}>
            <IconLock />
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>{STATS_META.locked.label}</p>
            <p className={styles.statValue}>{stats.locked}</p>
            <p className={styles.statSub}>{STATS_META.locked.sub}</p>
          </div>
        </div>
      </div>

      {/* Success & Warning Banners */}
      {isSubmitted && (
        <div className={styles.successBanner}>
          Jawaban berhasil dikirim, nilai akan segera diumuman oleh guru.
        </div>
      )}
      {notifBlocked && (
        <div className={styles.warningBanner}>
          ⚠️ Izin notifikasi ditolak. Aktifkan notifikasi browser untuk mulai ujian.
        </div>
      )}

      <ContentCard
        header={
          <div className={styles.controlsBar}>
            <div className={styles.tabsWrap}>
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
                  onClick={() => { setActiveTab(tab.key); setPage(1); }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className={styles.actionsWrap}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon}><IconSearch /></span>
                <input
                  className={styles.searchInput}
                  placeholder="Cari judul ujian..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <button className={styles.filterBtn}>
                <IconFilter />
                Filter
              </button>
            </div>
          </div>
        }
        footer={
          <div className={styles.paginationInner}>
            <p className={styles.paginationInfo}>
              Menampilkan {filtered.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + rowsPerPage, filtered.length)} dari {filtered.length} ujian
            </p>
            <div className={styles.paginationRight}>
              <select
                className={styles.rowsSelect}
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
              >
                <option value={5}>5 / halaman</option>
                <option value={10}>10 / halaman</option>
                <option value={20}>20 / halaman</option>
                <option value={50}>50 / halaman</option>
              </select>
              <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
              <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>{currentPage}</button>
              <button className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
            </div>
          </div>
        }
      >
        {/* Table — desktop */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              <p>Memuat daftar ujian...</p>
            </div>
          ) : pagedExams.length === 0 ? (
            <EmptyState title="Tidak ada ujian" description="Data ujian tidak ditemukan untuk filter saat ini." />
          ) : (
            <>
              {/* ── Desktop table ── */}
              <table className={styles.table}>
                <colgroup>
                  {['148px', '220px', '140px', '90px', '190px', '130px', '40px'].map((width, i) => (
                    <col key={i} style={{ width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Judul Ujian</th>
                    <th>Mata Pelajaran</th>
                    <th>Jumlah Soal</th>
                    <th>Status</th>
                    <th>Nilai / Aksi</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedExams.map((exam) => {
                    const startAt = exam.startTime || exam.start_time || exam.createdAt;
                    const endAt = exam.endTime || exam.end_time || (exam.duration ? new Date(new Date(startAt).getTime() + exam.duration * 60000).toISOString() : null);
                    const status = exam.uiStatus;
                    const isActionable = status === 'available';
                    const isWaitingReview = status === 'review';
                    const submittedAt = exam.session?.submittedAt;
                    const timeLeftMs = exam.deadline ? new Date(exam.deadline).getTime() - currentTime : 0;
                    const remainHour = Math.max(0, Math.floor(timeLeftMs / 3600000));
                    const remainMinute = Math.max(0, Math.floor((timeLeftMs % 3600000) / 60000));

                    return (
                      <tr
                        key={exam._id}
                        className={isActionable ? styles.clickableRow : ''}
                        onClick={isActionable ? () => handleStartExam(exam) : undefined}
                      >
                        <td>
                          <div className={styles.dateCell}>
                            <div className={styles.datePrimary}>
                              <span className={styles.dateIcon}><IconCalendar /></span>
                              {formatIdDate(startAt)}
                            </div>
                            <div className={styles.dateSecondary}>
                              {formatTime(startAt) || '--:--'} – {formatTime(endAt) || '--:--'}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.examTitle}>{exam.title}</div>
                          {exam.deadline && (
                            <div className={styles.deadlineText}>
                              <IconFlame />
                              Deadline: {formatIdDateTime(exam.deadline)}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className={styles.subjectName}>{exam.subjectDetails?.subjectName || '-'}</div>
                          <StatusBadge variant="student" size="sm" pill>{exam.subjectDetails?.classCode || '-'}</StatusBadge>
                        </td>
                        <td className={styles.soalCell}>{exam.randomCount || exam.totalQuestions} soal</td>
                        <td>
                          <div className={styles.statusCell}>
                            {status === 'submitted' && (<><span className={`${styles.stateBadge} ${styles.stateDone}`}>Sudah Dikumpulkan</span><span className={styles.stateSub}>Dikumpulkan: {formatIdDateTime(submittedAt)}</span></>)}
                            {status === 'available' && (<><span className={`${styles.stateBadge} ${styles.stateAvailable}`}>Tersedia</span><span className={styles.stateSub}>{exam.deadline ? `Sisa: ${remainHour}j ${remainMinute}m` : 'Siap dikerjakan'}</span></>)}
                            {status === 'review' && (<><span className={`${styles.stateBadge} ${styles.stateReview}`}>Menunggu Koreksi</span><span className={styles.stateSub}>Dikumpulkan: {formatIdDateTime(submittedAt)}</span></>)}
                            {status === 'locked' && (<><span className={`${styles.stateBadge} ${styles.stateLocked}`}>Terkunci</span><span className={styles.stateSub}>Tersedia: {formatIdDateTime(exam.createdAt)}</span></>)}
                          </div>
                        </td>
                        <td>
                          {(status === 'submitted' && !isWaitingReview && exam.showResults && exam.session?.calculatedScore !== undefined) && (
                            <div className={styles.scoreDisplay}>
                              <span className={styles.scoreBadge}>{Math.round(Number(exam.session?.calculatedScore || 0))}</span>
                              <span className={styles.scoreSuffix}>/ 100</span>
                            </div>
                          )}
                          {status === 'available' && (
                            <button className={styles.startBtn} onClick={(e) => { e.stopPropagation(); handleStartExam(exam); }} disabled={startingId === exam._id}>
                              {startingId === exam._id ? 'Memulai...' : 'Mulai Ujian'}
                            </button>
                          )}
                          {(status === 'review' || status === 'locked' || (status === 'submitted' && (!exam.showResults || exam.session?.calculatedScore === undefined))) && (
                            <span className={styles.noScore}>—</span>
                          )}
                        </td>
                        <td className={styles.chevronCell}><IconChevronRight /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ── Mobile card list ── */}
              <div className={styles.mobileList}>
                {pagedExams.map((exam) => {
                  const startAt = exam.startTime || exam.start_time || exam.createdAt;
                  const endAt = exam.endTime || exam.end_time || (exam.duration ? new Date(new Date(startAt).getTime() + exam.duration * 60000).toISOString() : null);
                  const status = exam.uiStatus;
                  const isActionable = status === 'available';
                  const isWaitingReview = status === 'review';
                  const submittedAt = exam.session?.submittedAt;
                  const timeLeftMs = exam.deadline ? new Date(exam.deadline).getTime() - currentTime : 0;
                  const remainHour = Math.max(0, Math.floor(timeLeftMs / 3600000));
                  const remainMinute = Math.max(0, Math.floor((timeLeftMs % 3600000) / 60000));

                  // status badge class
                  const badgeClass = {
                    submitted: styles.stateDone,
                    available: styles.stateAvailable,
                    review: styles.stateReview,
                    locked: styles.stateLocked,
                  }[status];

                  const badgeLabel = {
                    submitted: 'Sudah Dikumpulkan',
                    available: 'Tersedia',
                    review: 'Menunggu Koreksi',
                    locked: 'Terkunci',
                  }[status];

                  return (
                    <div
                      key={exam._id}
                      className={`${styles.mobileCard} ${isActionable ? styles.mobileCardClickable : ''}`}
                      onClick={isActionable ? () => handleStartExam(exam) : undefined}
                    >
                      {/* Top row: badge + chevron */}
                      <div className={styles.mobileCardTop}>
                        <span className={`${styles.stateBadge} ${badgeClass}`}>{badgeLabel}</span>
                        <span className={styles.mobileChevron}><IconChevronRight /></span>
                      </div>

                      {/* Title */}
                      <div className={styles.mobileCardTitle}>{exam.title}</div>
                      {exam.deadline && (
                        <div className={styles.deadlineText}>
                          <IconFlame />
                          Deadline: {formatIdDateTime(exam.deadline)}
                        </div>
                      )}

                      {/* Meta row */}
                      <div className={styles.mobileCardMeta}>
                        {/* Date + time */}
                        <div className={styles.mobileMetaItem}>
                          <span className={styles.mobileMetaIcon}><IconCalendar /></span>
                          <span>
                            {formatIdDate(startAt)}
                            <span className={styles.mobileMetaTime}> · {formatTime(startAt) || '--:--'} – {formatTime(endAt) || '--:--'}</span>
                          </span>
                        </div>
                        {/* Subject + class */}
                        <div className={styles.mobileMetaItem}>
                          <span className={styles.mobileMetaLabel}>{exam.subjectDetails?.subjectName || '-'}</span>
                          <StatusBadge variant="student" size="sm" pill>{exam.subjectDetails?.classCode || '-'}</StatusBadge>
                        </div>
                        {/* Soal count */}
                        <div className={styles.mobileMetaItem}>
                          <span className={styles.mobileMetaLabel}>{exam.randomCount || exam.totalQuestions} soal</span>
                        </div>
                      </div>

                      {/* Status sub-text */}
                      <div className={styles.mobileCardSub}>
                        {status === 'submitted' && `Dikumpulkan: ${formatIdDateTime(submittedAt)}`}
                        {status === 'available' && (exam.deadline ? `Waktu tersisa: ${remainHour} jam ${remainMinute} menit` : 'Siap dikerjakan')}
                        {status === 'review' && `Dikumpulkan: ${formatIdDateTime(submittedAt)}`}
                        {status === 'locked' && `Akan tersedia: ${formatIdDateTime(exam.createdAt)}`}
                      </div>

                      {/* Action / Score */}
                      <div className={styles.mobileCardAction}>
                        {(status === 'submitted' && !isWaitingReview && exam.showResults && exam.session?.calculatedScore !== undefined) && (
                          <div className={styles.scoreDisplay}>
                            <span className={styles.scoreBadge}>{Math.round(Number(exam.session?.calculatedScore || 0))}</span>
                            <span className={styles.scoreSuffix}>/ 100</span>
                          </div>
                        )}
                        {status === 'available' && (
                          <button
                            className={`${styles.startBtn} ${styles.startBtnFull}`}
                            onClick={(e) => { e.stopPropagation(); handleStartExam(exam); }}
                            disabled={startingId === exam._id}
                          >
                            {startingId === exam._id ? 'Memulai...' : 'Mulai Ujian'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </ContentCard>
    </>
  );
}

function StudentExamsPage() {
  return (
    <Suspense fallback={<div className="spinner" style={{ margin: '40px auto' }}></div>}>
      <StudentExamsContent />
    </Suspense>
  );
}

export default StudentExamsPage;
