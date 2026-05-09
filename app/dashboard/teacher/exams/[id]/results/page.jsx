'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

const PAGE_SIZE = 5;

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

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examMeta, setExamMeta] = useState(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ type: '', sessionId: null, studentName: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [isEndExamOpen, setIsEndExamOpen] = useState(false);
  const [endExamLoading, setEndExamLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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
    fetchResults();
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pageItems = buildPagination(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const currentRows = filteredSessions.slice(start, start + PAGE_SIZE);

  const examStart = sessions.length ? sessions.reduce((min, s) => (!min || new Date(s.startedAt) < new Date(min) ? s.startedAt : min), null) : null;
  const examEnd = sessions.length ? sessions.reduce((max, s) => (!max || new Date(s.submittedAt || 0) > new Date(max || 0) ? s.submittedAt : max), null) : null;

  const requestSessionAction = (sessionId, studentName, type) => {
    setConfirmConfig({ sessionId, studentName, type });
    setIsConfirmOpen(true);
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
    setEndExamLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/publish`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Gagal mengakhiri ujian.');
      else await fetchResults();
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setEndExamLoading(false);
      setIsEndExamOpen(false);
    }
  };

  const exportCsv = () => {
    const header = ['Nama Siswa', 'NIS', 'Waktu Mulai', 'Status Ujian', 'Progres', 'Pelanggaran', 'Status Koreksi'];
    const rows = filteredSessions.map((sess) => {
      const total = sess.questionCount || 0;
      const answered = sess.answeredCount || 0;
      const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
      return [
        sess.studentInfo?.fullName || '-',
        sess.studentInfo?.studentId || '-',
        formatTime(sess.startedAt),
        getStatusLabel(sess.status),
        `${answered} / ${total} (${progress}%)`,
        `${sess.exitCount || 0} kali`,
        getGradingLabel(sess),
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((val) => `"${String(val).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitor-ujian-${examId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
              <span className={styles.activeBadge}>AKTIF</span>
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
          <button className={styles.endBtn} onClick={() => setIsEndExamOpen(true)}>
            Akhiri Ujian
          </button>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span>⌕</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama siswa..."
          />
        </div>
        <div className={styles.toolbarRight}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="in-progress">Sedang Mengerjakan</option>
            <option value="submitted">Selesai</option>
            <option value="locked">Terkunci</option>
            <option value="not-started">Belum Mulai</option>
          </select>
          <button className={styles.exportBtn} onClick={exportCsv}>
            ⬇ Export
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
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NAMA SISWA</th>
                <th>WAKTU MULAI</th>
                <th>STATUS UJIAN</th>
                <th>PROGRES</th>
                <th>PELANGGARAN</th>
                <th>STATUS KOREKSI</th>
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
                      <button
                        type="button"
                        className={`${styles.violationBtn} ${sess.exitCount > 1 ? styles.violationHigh : sess.exitCount === 1 ? styles.violationMed : ''}`}
                        onClick={() => alert(`Detail pelanggaran ${sess.studentInfo?.fullName || '-'}: ${sess.exitCount || 0} kali perpindahan tab.`)}
                      >
                        {sess.exitCount || 0} kali
                      </button>
                    </td>
                    <td data-label="Status Koreksi">
                      <span className={gradingLabel === 'Sudah Dikoreksi' ? styles.gradedDone : styles.gradedPending}>{gradingLabel}</span>
                    </td>
                    <td data-label="Aksi">
                      <div className={styles.actionRow}>
                        {sess.status === 'in-progress' && (
                          <button className={styles.actionPrimary} onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}>
                            Koreksi Layar
                          </button>
                        )}
                        {sess.status === 'submitted' && (
                          <button className={styles.actionSecondary} onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}>
                            Lihat Hasil
                          </button>
                        )}
                        {sess.status === 'locked' && (
                          <button className={styles.actionWarning} onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'unlock')}>
                            Buka Akses
                          </button>
                        )}
                        {!['in-progress', 'submitted', 'locked'].includes(sess.status) && <span className={styles.noAction}>-</span>}
                        <details className={styles.moreMenu}>
                          <summary>⋮</summary>
                          <div className={styles.moreMenuContent}>
                            {(sess.status === 'locked' || (sess.status === 'in-progress' && (sess.exitCount || 0) > 0)) && (
                              <button onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'unlock')}>Buka Akses</button>
                            )}
                            <button className={styles.dangerAction} onClick={() => requestSessionAction(sess._id, sess.studentInfo?.fullName, 'reset')}>
                              Reset Total
                            </button>
                          </div>
                        </details>
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
        title="Akhiri Ujian"
        message="Ujian akan diakhiri (ditarik dari publikasi) dan siswa tidak dapat memulai sesi baru. Lanjutkan?"
        loading={endExamLoading}
      />
    </>
  );
}
