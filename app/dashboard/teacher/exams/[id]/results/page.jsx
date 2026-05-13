'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

const PAGE_SIZE = 5;

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

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'SS';
}

function getAvatarClass(seed = '') {
  let total = 0;
  for (let i = 0; i < seed.length; i++) total += seed.charCodeAt(i);
  const classes = [styles.avatarBlue, styles.avatarIndigo, styles.avatarPurple, styles.avatarAmber];
  return classes[total % classes.length];
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDateTimeFull(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function stripHtml(value = '') {
  if (!value) return '';
  const html = String(value);
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function formatDuration(durationMs) {
  if (!Number.isFinite(Number(durationMs))) return '-';
  const totalSeconds = Math.max(0, Math.round(Number(durationMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} menit ${seconds} detik` : `${seconds} detik`;
}

function getEventLabel(type) {
  return {
    'explicit-violation': 'Pelanggaran eksplisit',
    'unexpected-exit-start': 'Keluar tak terduga',
    'unexpected-exit-return': 'Kembali ke ujian',
  }[type] || type || 'Event ujian';
}

function getReasonLabel(reason) {
  return {
    'visibility-hidden': 'Halaman ujian disembunyikan',
    'window-blur': 'Fokus browser hilang',
    'fullscreen-exit': 'Keluar dari fullscreen',
    'alt-tab': 'Alt+Tab',
    'windows-key': 'Tombol Windows',
    'system-menu-shortcut': 'Shortcut sistem',
    'blocked-browser-shortcut': 'Shortcut browser/devtools',
    'blocked-contextmenu': 'Klik kanan',
    'blocked-copy': 'Copy',
    'blocked-cut': 'Cut',
    'blocked-paste': 'Paste',
    'blocked-selectstart': 'Seleksi teks',
    'blocked-dragstart': 'Drag konten',
    'page-hidden-or-closed': 'Halaman ditutup/disembunyikan',
    'page-exit': 'Keluar halaman',
    'exam-page-resumed': 'Masuk kembali ke ujian',
    'file-picker-open-too-long': 'Pemilih file terbuka terlalu lama',
    'file-picker-open-too-long-without-file': 'Pemilih file terbuka lama tanpa memilih file',
    'file-picker-return-lost-focus': 'Fokus hilang setelah pemilih file',
  }[reason] || reason || '-';
}

function getStatusLabel(status) {
  if (status === 'in-progress') return 'SEDANG MENGERJAKAN';
  if (status === 'submitted') return 'SELESAI';
  if (status === 'locked') return 'TERKUNCI';
  return 'BELUM MULAI';
}

function getGradingLabel(sess) {
  if (sess.status !== 'submitted') return 'Belum Dikoreksi';
  if (sess.gradingStatus === 'fully-graded' || sess.gradingStatus === 'auto-graded') return 'Sudah Dikoreksi';
  return 'Belum Dikoreksi';
}

function buildPagination(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 3) return [1, 2, 3, '...', totalPages];
  if (currentPage >= totalPages - 2) return [1, '...', totalPages - 2, totalPages - 1, totalPages];
  return [1, '...', currentPage, '...', totalPages];
}

export default function ExamResultsPage() {
  const { id: examId } = useParams();
  const router = useRouter();
  const isMobile = useIsMobile(640);

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examMeta, setExamMeta] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ type: '', sessionId: null, studentName: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [isEndExamOpen, setIsEndExamOpen] = useState(false);
  const [endExamLoading, setEndExamLoading] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [violationDetail, setViolationDetail] = useState(null);

  const searchTerm = searchInput.trim().toLowerCase();

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/sessions`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal memuat monitor ujian.');
      } else {
        setSessions(data.sessions || []);
        setExamMeta({
          title: data.examTitle || '-',
          ...(data.examMeta || {}),
        });
        setTotalStudents(data.totalStudents || 0);
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    const t = setTimeout(() => fetchResults(), 0);
    return () => clearTimeout(t);
  }, [fetchResults]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchResults();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  const stats = useMemo(() => {
    const inProgress = sessions.filter((s) => s.status === 'in-progress').length;
    const submitted = sessions.filter((s) => s.status === 'submitted').length;
    const locked = sessions.filter((s) => s.status === 'locked').length;
    const totalParticipants = sessions.length;
    const base = totalStudents || totalParticipants || 1;
    const notStarted = Math.max(base - totalParticipants, 0);
    const pct = (val) => `${((val / base) * 100).toFixed(1)}%`;
    return {
      totalParticipants,
      inProgress,
      submitted,
      locked,
      notStarted,
      pctTotal: `${((totalParticipants / base) * 100).toFixed(1)}%`,
      pctInProgress: pct(inProgress),
      pctSubmitted: pct(submitted),
      pctLocked: pct(locked),
      pctNotStarted: pct(notStarted),
    };
  }, [sessions, totalStudents]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((sess) => {
      const studentName = (sess.studentInfo?.fullName || '').toLowerCase();
      const matchedSearch = !searchTerm || studentName.includes(searchTerm);
      const mappedStatus = ['in-progress', 'submitted', 'locked'].includes(sess.status) ? sess.status : 'not-started';
      const matchedStatus = !statusFilter || mappedStatus === statusFilter;
      return matchedSearch && matchedStatus;
    });
  }, [sessions, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pageItems = buildPagination(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const currentRows = filteredSessions.slice(start, start + PAGE_SIZE);

  const examStart = sessions.length ? sessions.reduce((min, s) => (!min || new Date(s.startedAt) < new Date(min) ? s.startedAt : min), null) : null;
  const examEnd = sessions.length ? sessions.reduce((max, s) => (!max || new Date(s.submittedAt || 0) > new Date(max || 0) ? s.submittedAt : max), null) : null;
  const isExamOpen = examMeta?.isExamOpen === true;
  const hasExamEverStarted = useMemo(
    () => sessions.some((sess) => sess.startedAt || sess.submittedAt || sess.status === 'in-progress' || sess.status === 'submitted' || sess.status === 'locked'),
    [sessions]
  );
  const openCloseBtnLabel = isExamOpen ? 'Akhiri Ujian' : hasExamEverStarted ? 'Buka Ujian Lagi' : 'Buka Ujian';

  const requestSessionAction = (sessionId, studentName, type) => {
    setConfirmConfig({ sessionId, studentName, type });
    setIsConfirmOpen(true);
  };

  const openViolationDetail = (session) => {
    setViolationDetail(session);
  };

  const handleConfirmAction = async () => {
    const { sessionId, type } = confirmConfig;
    if (!sessionId) return;
    setActionLoading(true);
    try {
      const method = type === 'unlock' ? 'PATCH' : 'DELETE';
      const res = await fetch(`/api/teacher/exams/${examId}/sessions/${sessionId}/unlock`, { method });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Gagal mengeksekusi aksi.');
      else await fetchResults();
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setActionLoading(false);
      setIsConfirmOpen(false);
    }
  };

  const handleEndExam = async () => {
    if (!examMeta) return;
    setEndExamLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExamOpen: !(examMeta.isExamOpen !== false) }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Gagal mengubah akses ujian.');
      else {
        setExamMeta((prev) => ({ ...(prev || {}), isExamOpen: data.isExamOpen }));
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setEndExamLoading(false);
      setIsEndExamOpen(false);
    }
  };

  const handleToggleResultsVisibility = async () => {
    if (!examMeta) return;
    setVisibilityLoading(true);
    try {
      const next = !examMeta.showResults;
      const res = await fetch(`/api/teacher/exams/${examId}/results-visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showResults: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengubah visibilitas nilai.');
      } else {
        setExamMeta((prev) => ({ ...(prev || {}), showResults: next }));
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const exportResults = () => {
    const rows = filteredSessions.map((sess, index) => {
      const total = sess.questionCount || 0;
      const answered = sess.answeredCount || 0;
      const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
      return {
        NO: index + 1,
        'NAMA SISWA': sess.studentInfo?.fullName || '-',
        NIS: sess.studentInfo?.studentId || '-',
        KELAS: sess.studentInfo?.classCode || '-',
        'WAKTU MULAI': formatDateTime(sess.startedAt),
        'WAKTU SUBMIT': formatDateTime(sess.submittedAt),
        'STATUS UJIAN': getStatusLabel(sess.status),
        PROGRES: `${answered} / ${total} (${progress}%)`,
        PELANGGARAN: `${sess.exitCount || 0} kali`,
        'STATUS KOREKSI': getGradingLabel(sess),
        NILAI: sess.calculatedScore ?? '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');
    XLSX.writeFile(workbook, `hasil-ujian-${examId}.xlsx`);
  };

  return (
    <>
      <PageHeader
        title="Monitor Ujian"
        subtitle="Pantau progres ujian siswa, lihat aktivitas perpindahan tab, dan berikan akses kembali jika siswa terkunci."
      >
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/teacher/exams')}>
          ← Kembali ke Bank Ujian
        </button>
      </PageHeader>

      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconBlue}`}>👥</div>
          <div>
            <p>Total Peserta</p>
            <strong>{stats.totalParticipants}</strong>
            <small>{stats.pctTotal} dari semua siswa</small>
          </div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconGreen}`}>✓</div>
          <div>
            <p>Sedang Mengerjakan</p>
            <strong>{stats.inProgress}</strong>
            <small>{stats.pctInProgress} peserta aktif</small>
          </div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconAmber}`}>◷</div>
          <div>
            <p>Selesai</p>
            <strong>{stats.submitted}</strong>
            <small>{stats.pctSubmitted} peserta selesai</small>
          </div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconRed}`}>🔒</div>
          <div>
            <p>Terkunci</p>
            <strong>{stats.locked}</strong>
            <small>{stats.pctLocked} peserta terkunci</small>
          </div>
        </article>
        <article className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.iconPurple}`}>!</div>
          <div>
            <p>Belum Mulai</p>
            <strong>{stats.notStarted}</strong>
            <small>{stats.pctNotStarted} peserta belum mulai</small>
          </div>
        </article>
      </section>

      <section className={styles.examBar}>
        <div className={styles.examLeft}>
          <div className={styles.examIcon}>🗎</div>
          <div>
            <div className={styles.examTitleRow}>
              <strong>{examMeta?.title || '-'}</strong>
              <span className={styles.activeBadge}>{examMeta?.isExamOpen !== false ? 'AKTIF' : 'DITUTUP'}</span>
            </div>
            <p>
              Kelas: {examMeta?.classCode || '-'} • Durasi: {examMeta?.duration || '-'} Menit • Mulai: {formatTime(examStart)} • Selesai:{' '}
              {formatTime(examMeta?.deadline || examEnd)}
            </p>
          </div>
        </div>
        <div className={styles.examRight}>
          <div className={styles.timeItem}>
            <span>Waktu Mulai</span>
            <strong>{formatDateTime(examStart || examMeta?.createdAt)}</strong>
          </div>
          <div className={styles.timeItem}>
            <span>Waktu Selesai</span>
            <strong>{formatDateTime(examMeta?.deadline || examEnd)}</strong>
          </div>
          <button className={`${styles.endBtn} ${isExamOpen ? styles.endBtnDanger : styles.endBtnSuccess}`} onClick={() => setIsEndExamOpen(true)}>
            {openCloseBtnLabel}
          </button>
          <button className={styles.exportBtn} onClick={handleToggleResultsVisibility} disabled={visibilityLoading}>
            {visibilityLoading
              ? 'Memproses...'
              : examMeta?.showResults
                ? 'Sembunyikan Nilai dari Siswa'
                : 'Tampilkan Nilai ke Siswa'}
          </button>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span>⌕</span>
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama siswa..."
          />
        </div>
        <div className={styles.toolbarRight}>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
            <option value="">Semua Status</option>
            <option value="in-progress">Sedang Mengerjakan</option>
            <option value="submitted">Selesai</option>
            <option value="locked">Terkunci</option>
            <option value="not-started">Belum Mulai</option>
          </select>
          <button className={styles.exportBtn} onClick={exportResults}>
            ⬇ Export Excel
          </button>
        </div>
      </section>

      <section className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingBox}>
            <div className="spinner"></div>
            Memuat monitor ujian...
          </div>
        ) : currentRows.length === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState title="Belum Ada Peserta" description="Belum ada siswa yang memulai ujian ini." />
          </div>
        ) : isMobile ? (
          /* ── Mobile card list ── */
          <div className={styles.mobileParticipantList}>
            {currentRows.map((sess) => {
              const total = sess.questionCount || 0;
              const answered = sess.answeredCount || 0;
              const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
              const gradingLabel = getGradingLabel(sess);
              const statusLabel = getStatusLabel(sess.status);
              const statusClass =
                sess.status === 'in-progress' ? styles.statusInProgress
                : sess.status === 'submitted'  ? styles.statusDone
                : sess.status === 'locked'     ? styles.statusLocked
                : styles.statusNotStarted;

              return (
                <div key={sess._id} className={styles.mobileParticipantCard}>
                  {/* Top: avatar + name + status badge */}
                  <div className={styles.mobileParticipantHead}>
                    <div className={styles.studentCell}>
                      <div className={`${styles.avatar} ${getAvatarClass(sess.studentInfo?.fullName || sess._id)}`}>
                        {getInitials(sess.studentInfo?.fullName)}
                      </div>
                      <div>
                        <div className={styles.studentName}>{sess.studentInfo?.fullName || 'Siswa Dihapus'}</div>
                        <div className={styles.studentId}>{sess.studentInfo?.studentId || '-'}</div>
                      </div>
                    </div>
                    <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
                  </div>

                  {/* Meta grid */}
                  <div className={styles.mobileParticipantMeta}>
                    <div>
                      <div className={styles.mobileMetaLabel}>Waktu Mulai</div>
                      <div className={styles.mobileMetaValue}>{formatTime(sess.startedAt)}</div>
                    </div>
                    <div>
                      <div className={styles.mobileMetaLabel}>Progres</div>
                      <div className={styles.mobileMetaValue}>{answered}/{total} ({progress}%)</div>
                      <div className={styles.progressBar} style={{ marginTop: '4px' }}>
                        <div style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className={styles.mobileMetaLabel}>Pelanggaran</div>
                      <div className={`${styles.mobileMetaValue} ${sess.exitCount > 1 ? styles.violationHigh : sess.exitCount === 1 ? styles.violationMed : ''}`}>
                        {sess.exitCount || 0} kali
                      </div>
                    </div>
                    <div>
                      <div className={styles.mobileMetaLabel}>Koreksi</div>
                      <div className={gradingLabel === 'Sudah Dikoreksi' ? styles.gradedDone : styles.gradedPending}>
                        {gradingLabel}
                      </div>
                    </div>
                    {(sess.calculatedScore !== null && sess.calculatedScore !== undefined) && (
                      <div>
                        <div className={styles.mobileMetaLabel}>Nilai</div>
                        <div className={styles.mobileMetaValue} style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                          {sess.calculatedScore} / 100
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.mobileParticipantActions}>
                    {sess.status === 'submitted' && (
                      <button className={styles.actionSecondary} onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}>
                        Lihat Hasil
                      </button>
                    )}
                    {sess.status === 'in-progress' && (
                      <button className={styles.actionPrimary} onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}>
                        Koreksi
                      </button>
                    )}
                    {sess.status !== 'not-started' && (
                      <button className={styles.actionSecondary} onClick={() => openViolationDetail(sess)}>
                        Detail Pelanggaran
                      </button>
                    )}
                    {(sess.status === 'locked' || (sess.status === 'in-progress' && (sess.exitCount || 0) > 0)) && (
                      <button className={styles.actionWarning} onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'unlock')}>
                        Buka Kunci
                      </button>
                    )}
                    {sess.status !== 'not-started' && (
                      <button className={styles.actionDanger} onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'reset')}>
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Desktop table ── */
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NAMA SISWA</th>
                <th>WAKTU MULAI</th>
                <th>STATUS UJIAN</th>
                <th>PROGRES</th>
                <th>PELANGGARAN</th>
                <th>STATUS KOREKSI</th>
                <th>NILAI</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map((sess) => {
                const total = sess.questionCount || 0;
                const answered = sess.answeredCount || 0;
                const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
                const gradingLabel = getGradingLabel(sess);
                const statusLabel = getStatusLabel(sess.status);
                const statusClass =
                  sess.status === 'in-progress'
                    ? styles.statusInProgress
                    : sess.status === 'submitted'
                      ? styles.statusDone
                      : sess.status === 'locked'
                        ? styles.statusLocked
                        : styles.statusNotStarted;
                return (
                  <tr key={sess._id}>
                    <td data-label="Nama Siswa">
                      <div className={styles.studentCell}>
                        <div className={`${styles.avatar} ${getAvatarClass(sess.studentInfo?.fullName || sess._id)}`}>{getInitials(sess.studentInfo?.fullName)}</div>
                        <div>
                          <div className={styles.studentName}>{sess.studentInfo?.fullName || 'Siswa Dihapus'}</div>
                          <div className={styles.studentId}>{sess.studentInfo?.studentId || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Waktu Mulai">{formatTime(sess.startedAt)}</td>
                    <td data-label="Status Ujian">
                      <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td data-label="Progres">
                      <div className={styles.progressText}>{answered} / {total} ({progress}%)</div>
                      <div className={styles.progressBar}>
                        <div style={{ width: `${progress}%` }} />
                      </div>
                    </td>
                    <td data-label="Pelanggaran">
                      <span className={`${styles.violationText} ${sess.exitCount > 1 ? styles.violationHigh : sess.exitCount === 1 ? styles.violationMed : ''}`}>
                        {sess.exitCount || 0} kali
                      </span>
                    </td>
                    <td data-label="Status Koreksi">
                      <span className={gradingLabel === 'Sudah Dikoreksi' ? styles.gradedDone : styles.gradedPending}>{gradingLabel}</span>
                    </td>
                    <td data-label="Nilai">
                      {(sess.calculatedScore !== null && sess.calculatedScore !== undefined)
                        ? `${sess.calculatedScore} / 100`
                        : '-'}
                    </td>
                    <td data-label="Aksi">
                      <div className={styles.actionRow}>
                        {sess.status === 'submitted' && (
                          <button className={styles.actionSecondary} onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}>
                            Lihat Hasil
                          </button>
                        )}
                        {sess.status === 'in-progress' && (
                          <button className={styles.actionPrimary} onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}>
                            Koreksi
                          </button>
                        )}
                        {sess.status !== 'not-started' && (
                          <button className={styles.actionSecondary} onClick={() => openViolationDetail(sess)}>
                            Detail Pelanggaran
                          </button>
                        )}
                        {(sess.status === 'locked' || (sess.status === 'in-progress' && (sess.exitCount || 0) > 0)) && (
                          <button className={styles.actionWarning} onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'unlock')}>
                            Buka Kunci
                          </button>
                        )}
                        {sess.status !== 'not-started' && (
                          <button className={styles.actionDanger} onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'reset')}>
                            Reset
                          </button>
                        )}
                        {!['in-progress', 'submitted', 'locked'].includes(sess.status) && <span className={styles.noAction}>-</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className={styles.pagination}>
          <p>
            Menampilkan {filteredSessions.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, filteredSessions.length)} dari {filteredSessions.length} siswa
          </p>
          <div className={styles.pageControls}>
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>‹</button>
            {pageItems.map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} className={styles.ellipsis}>...</span>
              ) : (
                <button key={`page-${item}`} className={item === currentPage ? styles.activePage : ''} onClick={() => setCurrentPage(item)}>
                  {item}
                </button>
              )
            )}
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>›</button>
          </div>
        </div>
      </section>

      <section className={styles.tipsCard}>
        <strong>💡 Tips</strong>
        <p>Pantau progres ujian secara real-time dan pastikan tidak ada kecurangan.</p>
      </section>

      <Modal
        isOpen={Boolean(violationDetail)}
        onClose={() => setViolationDetail(null)}
        title={`Detail Pelanggaran - ${violationDetail?.studentInfo?.fullName || 'Siswa'}`}
        maxWidth="780px"
      >
        {violationDetail && (
          <div className={styles.violationModal}>
            <div className={styles.violationSummary}>
              <div>
                <span>Pelanggaran Resmi</span>
                <strong>{violationDetail.exitCount || 0}</strong>
              </div>
              <div>
                <span>Audit Event</span>
                <strong>{Array.isArray(violationDetail.examEvents) ? violationDetail.examEvents.length : 0}</strong>
              </div>
              <div>
                <span>Keluar Tak Terduga</span>
                <strong>{violationDetail.unexpectedExitCount || 0}</strong>
              </div>
              <div>
                <span>Draft Terakhir</span>
                <strong>{formatTime(violationDetail.draftUpdatedAt)}</strong>
              </div>
            </div>

            {violationDetail.activeUnexpectedExit?.at && (
              <div className={styles.violationAlert}>
                Siswa tercatat keluar dari halaman ujian dan belum kembali.
              </div>
            )}

            {!Array.isArray(violationDetail.examEvents) || violationDetail.examEvents.length === 0 ? (
              <p className={styles.violationEmpty}>
                Belum ada detail riwayat pelanggaran. Jika angka pelanggaran sudah ada, kemungkinan berasal dari data lama sebelum audit event diaktifkan.
              </p>
            ) : (
              <div className={styles.violationTimeline}>
                {[...violationDetail.examEvents].reverse().map((event, idx) => (
                  <article
                    key={`${event.type || 'event'}-${event.at || idx}-${idx}`}
                    className={`${styles.violationEvent} ${event.countedAsViolation ? styles.violationEventCounted : ''}`}
                  >
                    <div className={styles.violationEventHead}>
                      <div>
                        <strong>{getEventLabel(event.type)}</strong>
                        <span>{formatDateTimeFull(event.at || event.returnedAt || event.exitAt)}</span>
                      </div>
                      <span className={event.countedAsViolation ? styles.violationCountedBadge : styles.violationAuditBadge}>
                        {event.countedAsViolation ? 'Dihitung Pelanggaran' : 'Audit'}
                      </span>
                    </div>
                    <div className={styles.violationEventGrid}>
                      <div>
                        <span>Kesalahan / Alasan</span>
                        <strong>{getReasonLabel(event.reason)}</strong>
                      </div>
                      {event.durationMs !== null && event.durationMs !== undefined && (
                        <div>
                          <span>Durasi keluar</span>
                          <strong>{formatDuration(event.durationMs)}</strong>
                        </div>
                      )}
                      {event.unexpectedExitCount !== null && event.unexpectedExitCount !== undefined && (
                        <div>
                          <span>Total keluar tak terduga</span>
                          <strong>{event.unexpectedExitCount}</strong>
                        </div>
                      )}
                      {event.exitCount !== null && event.exitCount !== undefined && (
                        <div>
                          <span>Exit count</span>
                          <strong>{event.exitCount}</strong>
                        </div>
                      )}
                      {event.violationRule && (
                        <div>
                          <span>Aturan</span>
                          <strong>{event.violationRule}</strong>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmConfig.type === 'unlock' ? 'Buka Akses Siswa' : 'Hapus & Reset Total'}
        message={
          confirmConfig.type === 'unlock'
            ? `Siswa ${confirmConfig.studentName} akan diizinkan melanjutkan ujian dan pelanggaran di-reset ke 0. Lanjutkan?`
            : `Sesi ujian ${confirmConfig.studentName} akan dihapus total dan siswa harus mulai dari awal. Lanjutkan?`
        }
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={isEndExamOpen}
        onClose={() => setIsEndExamOpen(false)}
        onConfirm={handleEndExam}
        title={isExamOpen ? 'Akhiri Ujian' : openCloseBtnLabel}
        message={
          isExamOpen
            ? 'Ujian tetap terpublikasi, tetapi siswa tidak dapat memulai atau melanjutkan ujian sampai Anda membukanya kembali. Lanjutkan?'
            : hasExamEverStarted
              ? 'Ujian akan dibuka kembali sehingga siswa dapat masuk lagi. Lanjutkan?'
              : 'Ujian akan dibuka untuk pertama kali sehingga siswa dapat mulai mengerjakan. Lanjutkan?'
        }
        confirmLabel={isExamOpen ? 'Akhiri' : 'Buka'}
        loading={endExamLoading}
      />
    </>
  );
}
