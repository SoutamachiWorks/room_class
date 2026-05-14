'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import styles from './student-exams.module.css';

// Hook to detect mobile viewport
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

const FILTER_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'available', label: 'Tersedia' },
  { key: 'ongoing', label: 'Sedang Dikerjakan' },
  { key: 'submitted', label: 'Sudah Dikerjakan' },
  { key: 'review', label: 'Menunggu Koreksi' },
  { key: 'locked', label: 'Terkunci' },
  { key: 'disqualified', label: 'Diskualifikasi' },
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
  const [currentYear, setCurrentYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [detailExam, setDetailExam] = useState(null); // modal detail ujian

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
        setCurrentYear(data.currentYear || null);
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

    if (baseStatus === 'disqualified') return 'disqualified';

    if (exam.isExamOpen !== true && baseStatus !== 'submitted' && baseStatus !== 'in-progress') {
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

  if (baseStatus === 'in-progress') return 'ongoing';
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

  const currentYearId = currentYear?.yearId || null;
  const isArchiveMode = Boolean(yearId && currentYearId && yearId !== currentYearId);

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
        if (data.locked || data.disqualified) router.push(`/dashboard/student/exams/lockout?reason=${data.disqualified ? 'disqualified' : 'locked'}`);
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
          Jawaban berhasil dikirim.
        </div>
      )}
      {notifBlocked && (
        <div className={styles.warningBanner}>
          [!] Izin notifikasi ditolak. Aktifkan notifikasi browser untuk mulai ujian.
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
              Menampilkan {filtered.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + rowsPerPage, filtered.length)} dari {filtered.length} ujian
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
              <button className={styles.pageBtn} disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>&lt;</button>
              <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>{currentPage}</button>
              <button className={styles.pageBtn} disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>&gt;</button>
            </div>
          </div>
        }
      >
        {/* Table - desktop */}
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
              {/* -- Desktop table -- */}
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
                    const isActionable = status === 'available' || status === 'ongoing';
                    const isWaitingReview = status === 'review';
                    const submittedAt = exam.session?.submittedAt;
                    const score = exam.session?.score;
                    const draftUpdatedAt = exam.session?.draftUpdatedAt;
                    const timeLeftMs = exam.deadline ? new Date(exam.deadline).getTime() - currentTime : 0;
                    const remainHour = Math.max(0, Math.floor(timeLeftMs / 3600000));
                    const remainMinute = Math.max(0, Math.floor((timeLeftMs % 3600000) / 60000));

                    return (
                      <tr
                        key={exam._id}
                        className={styles.clickableRow}
                        onClick={() => setDetailExam(exam)}
                      >
                        <td>
                          <div className={styles.dateCell}>
                            <div className={styles.datePrimary}>
                              <span className={styles.dateIcon}><IconCalendar /></span>
                              {formatIdDate(startAt)}
                            </div>
                            <div className={styles.dateSecondary}>
                              {formatTime(startAt) || '--:--'} - {formatTime(endAt) || '--:--'}
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
                            {status === 'ongoing' && (<><span className={`${styles.stateBadge} ${styles.stateAvailable}`}>Sedang Dikerjakan</span><span className={styles.stateSub}>{draftUpdatedAt ? `Draft: ${formatIdDateTime(draftUpdatedAt)}` : 'Sesi ujian masih aktif'}</span></>)}
                            {status === 'review' && (<><span className={`${styles.stateBadge} ${styles.stateReview}`}>Menunggu Koreksi</span><span className={styles.stateSub}>Dikumpulkan: {formatIdDateTime(submittedAt)}</span></>)}
                            {status === 'locked' && (<><span className={`${styles.stateBadge} ${styles.stateLocked}`}>Terkunci</span><span className={styles.stateSub}>Tersedia: {formatIdDateTime(exam.createdAt)}</span></>)}
                            {status === 'disqualified' && (<><span className={`${styles.stateBadge} ${styles.stateLocked}`}>Diskualifikasi</span><span className={styles.stateSub}>Hubungi guru</span></>)}
                          </div>
                        </td>
                        <td>
                          {isActionable && (
                            <button className={styles.startBtn} onClick={(e) => { e.stopPropagation(); setDetailExam(exam); }} disabled={startingId === exam._id}>
                              {status === 'ongoing' ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
                            </button>
                          )}
                          {status === 'submitted' && score !== undefined && score !== null && !isWaitingReview && (
                            <span className={styles.scoreTag}>{Math.round(Number(score))}</span>
                          )}
                          {(status === 'review' || status === 'locked' || status === 'disqualified' || status === 'submitted') && (
                            <>
                              {(status !== 'submitted' || score === undefined || score === null || isWaitingReview) && (
                                <span className={styles.noScore}>-</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className={styles.chevronCell}><IconChevronRight /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* -- Mobile card list -- */}
              <div className={styles.mobileList}>
                {pagedExams.map((exam) => {
                  const startAt = exam.startTime || exam.start_time || exam.createdAt;
                  const endAt = exam.endTime || exam.end_time || (exam.duration ? new Date(new Date(startAt).getTime() + exam.duration * 60000).toISOString() : null);
                  const status = exam.uiStatus;
                  const isActionable = status === 'available' || status === 'ongoing';
                  const isWaitingReview = status === 'review';
                  const submittedAt = exam.session?.submittedAt;
                  const score = exam.session?.score;
                  const draftUpdatedAt = exam.session?.draftUpdatedAt;
                  const timeLeftMs = exam.deadline ? new Date(exam.deadline).getTime() - currentTime : 0;
                  const remainHour = Math.max(0, Math.floor(timeLeftMs / 3600000));
                  const remainMinute = Math.max(0, Math.floor((timeLeftMs % 3600000) / 60000));

                  // status badge class
                  const badgeClass = {
                    submitted: styles.stateDone,
                    available: styles.stateAvailable,
                    ongoing: styles.stateAvailable,
                    review: styles.stateReview,
                    locked: styles.stateLocked,
                    disqualified: styles.stateLocked,
                  }[status];

                  const badgeLabel = {
                    submitted: 'Sudah Dikumpulkan',
                    available: 'Tersedia',
                    ongoing: 'Sedang Dikerjakan',
                    review: 'Menunggu Koreksi',
                    locked: 'Terkunci',
                    disqualified: 'Diskualifikasi',
                  }[status];

                  return (
                    <div
                      key={exam._id}
                      className={`${styles.mobileCard} ${styles.mobileCardClickable}`}
                      onClick={() => setDetailExam(exam)}
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
                            <span className={styles.mobileMetaTime}> · {formatTime(startAt) || '--:--'} - {formatTime(endAt) || '--:--'}</span>
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
                        {status === 'ongoing' && (draftUpdatedAt ? `Draft terakhir: ${formatIdDateTime(draftUpdatedAt)}` : 'Sesi ujian masih aktif')}
                        {status === 'review' && `Dikumpulkan: ${formatIdDateTime(submittedAt)}`}
                        {status === 'locked' && `Akan tersedia: ${formatIdDateTime(exam.createdAt)}`}
                        {status === 'disqualified' && 'Diskualifikasi oleh guru atau pengawas'}
                      </div>

                      {/* Action / Score */}
                      <div className={styles.mobileCardAction}>
                        {status === 'submitted' && score !== undefined && score !== null && !isWaitingReview && (
                          <div className={styles.detailScoreInline}>
                            <span>Nilai:</span>
                            <strong>{Math.round(Number(score))} / 100</strong>
                          </div>
                        )}
                        {isActionable && (
                          <button
                            className={`${styles.startBtn} ${styles.startBtnFull}`}
                            onClick={(e) => { e.stopPropagation(); setDetailExam(exam); }}
                            disabled={startingId === exam._id}
                          >
                            {status === 'ongoing' ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
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

      {/* -- Modal Detail Ujian -- */}
      {detailExam && (() => {
        const exam = detailExam;
        const status = exam.uiStatus;
        const startAt = exam.startTime || exam.start_time || exam.createdAt;
        const endAt = exam.endTime || exam.end_time || (exam.duration ? new Date(new Date(startAt).getTime() + exam.duration * 60000).toISOString() : null);
        const submittedAt = exam.session?.submittedAt;
        const score = exam.session?.score;
        const isWaitingReview = status === 'review';
        const isActionable = status === 'available' || status === 'ongoing';
        const draftUpdatedAt = exam.session?.draftUpdatedAt;
        const timeLeftMs = exam.deadline ? new Date(exam.deadline).getTime() - currentTime : 0;
        const remainHour = Math.max(0, Math.floor(timeLeftMs / 3600000));
        const remainMinute = Math.max(0, Math.floor((timeLeftMs % 3600000) / 60000));

        const badgeClass = { submitted: styles.stateDone, available: styles.stateAvailable, ongoing: styles.stateAvailable, review: styles.stateReview, locked: styles.stateLocked, disqualified: styles.stateLocked }[status];
        const badgeLabel = { submitted: 'Sudah Dikumpulkan', available: 'Tersedia', ongoing: 'Sedang Dikerjakan', review: 'Menunggu Koreksi', locked: 'Terkunci', disqualified: 'Diskualifikasi' }[status];

        return (
          <Modal isOpen onClose={() => setDetailExam(null)} title="Detail Ujian">
            <div className={styles.detailModal}>
              {/* Header info */}
              <div className={styles.detailHeader}>
                <div className={styles.detailTitleRow}>
                  <h3 className={styles.detailTitle}>{exam.title}</h3>
                  <span className={`${styles.stateBadge} ${badgeClass}`}>{badgeLabel}</span>
                </div>
                <div className={styles.detailSubject}>
                  {exam.subjectDetails?.subjectName || '-'}
                  <StatusBadge variant="student" size="sm" pill>{exam.subjectDetails?.classCode || '-'}</StatusBadge>
                </div>
              </div>

              {/* Info grid */}
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailItemLabel}>Tanggal</span>
                  <span className={styles.detailItemValue}>{formatIdDate(startAt)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailItemLabel}>Waktu</span>
                  <span className={styles.detailItemValue}>{formatTime(startAt) || '--:--'} - {formatTime(endAt) || '--:--'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailItemLabel}>Durasi</span>
                  <span className={styles.detailItemValue}>{exam.duration ? `${exam.duration} menit` : '-'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailItemLabel}>Jumlah Soal</span>
                  <span className={styles.detailItemValue}>{exam.randomCount || exam.totalQuestions} soal</span>
                </div>
                {exam.deadline && (
                  <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.detailItemLabel}>Deadline</span>
                    <span className={styles.detailItemValue} style={{ color: '#f97316' }}>{formatIdDateTime(exam.deadline)}</span>
                  </div>
                )}
                {status === 'available' && exam.deadline && (
                  <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.detailItemLabel}>Waktu Tersisa</span>
                    <span className={styles.detailItemValue} style={{ color: 'var(--accent-yellow, #f59e0b)', fontWeight: 700 }}>{remainHour} jam {remainMinute} menit</span>
                  </div>
                )}
                {status === 'ongoing' && (
                  <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.detailItemLabel}>Draft Terakhir</span>
                    <span className={styles.detailItemValue}>{draftUpdatedAt ? formatIdDateTime(draftUpdatedAt) : 'Sesi masih aktif'}</span>
                  </div>
                )}
                {submittedAt && (
                  <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                    <span className={styles.detailItemLabel}>Dikumpulkan</span>
                    <span className={styles.detailItemValue}>{formatIdDateTime(submittedAt)}</span>
                  </div>
                )}
              </div>

              {/* Nilai */}
              {(status === 'submitted' || status === 'review') && score !== undefined && score !== null && !isWaitingReview && (
                <div className={styles.detailScoreBox}>
                  <span className={styles.detailScoreLabel}>Nilai Anda</span>
                  <div className={styles.detailScoreValue}>{Math.round(Number(score))}<span className={styles.detailScoreSuffix}> / 100</span></div>
                </div>
              )}
              {/* Menunggu koreksi */}
              {status === 'review' && (
                <div className={styles.detailInfoBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Jawaban Anda sedang menunggu koreksi dari guru.
                </div>
              )}

              {/* Terkunci */}
              {status === 'locked' && (
                <div className={styles.detailInfoBox} style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'var(--color-failed-text, #ef4444)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Ujian ini terkunci. Hubungi guru jika ada masalah.
                </div>
              )}
              {status === 'disqualified' && (
                <div className={styles.detailInfoBox} style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'var(--color-failed-text, #ef4444)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                  Anda didiskualifikasi dari ujian ini. Hubungi guru untuk informasi lebih lanjut.
                </div>
              )}

              {/* Action buttons */}
              <div className={styles.detailActions}>
                {/* Mulai Ujian */}
                {isActionable && (
                  <button
                    className={`${styles.startBtn} ${styles.startBtnFull}`}
                    onClick={() => { setDetailExam(null); handleStartExam(exam); }}
                    disabled={startingId === exam._id}
                  >
                    {startingId === exam._id ? 'Membuka...' : status === 'ongoing' ? 'Lanjutkan Ujian' : '> Mulai Ujian'}
                  </button>
                )}

                {/* Lihat Nilai */}
                {(status === 'submitted') && score !== undefined && score !== null && !isWaitingReview && (
                  <div className={styles.detailScoreInline}>
                    <span>Nilai:</span>
                    <strong>{Math.round(Number(score))} / 100</strong>
                  </div>
                )}
                {/* Lihat Kunci Jawaban - hanya jika showExplanation aktif dan sudah submit */}
                {(status === 'submitted' || status === 'review') && exam.showExplanation && (
                  <button
                    className={styles.detailBtnSecondary}
                    onClick={() => { setDetailExam(null); router.push(`/dashboard/student/exams/${exam._id}/review`); }}
                  >
                    Lihat Evaluasi
                  </button>
                )}

                <button className={styles.detailBtnClose} onClick={() => setDetailExam(null)}>
                  Tutup
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
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



