'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './attendance.module.css';

const DURATION_OPTIONS = [5, 10, 15, 30];

function StatusBadge({ status }) {
  if (!status) return <span className={styles.badgeAlpha}>—</span>;
  const map = { hadir: styles.badgeHadir, sakit: styles.badgeSakit, izin: styles.badgeIzin, alpha: styles.badgeAlpha };
  const labelMap = { hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpha: 'Alpha' };
  return <span className={map[status] || styles.badgeAlpha}>{labelMap[status] || status}</span>;
}

function Skeleton({ h = 20, w = '100%', radius = 8 }) {
  return <div className={styles.skeleton} style={{ height: h, width: w, borderRadius: radius }} />;
}

// ── Recap Tab ─────────────────────────────────────────────────────────────────
function RecapTab({ subjectId }) {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    setLoading(true);
    fetch(`/api/teacher/attendance/recap?subjectId=${subjectId}`)
      .then(r => r.json())
      .then(d => setRecap(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subjectId]);

  if (!subjectId) return (
    <div className={styles.emptyState}><p>Pilih mata pelajaran terlebih dahulu.</p></div>
  );

  if (loading) return (
    <div className={styles.skeletonList}>{[0,1,2,3].map(i => <Skeleton key={i} h={48} radius={10} />)}</div>
  );

  if (!recap || recap.recap?.length === 0) return (
    <div className={styles.emptyState}><p>Belum ada data rekap. Tutup beberapa sesi terlebih dahulu.</p></div>
  );

  return (
    <div>
      <p style={{ color: 'var(--color-subtext)', fontSize: '0.85rem', marginBottom: 16 }}>
        Total {recap.totalSessions} pertemuan tercatat untuk <strong>{recap.subject?.subjectName}</strong>
      </p>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nama Siswa</th>
              <th style={{ textAlign: 'center' }}>Hadir</th>
              <th style={{ textAlign: 'center' }}>Sakit</th>
              <th style={{ textAlign: 'center' }}>Izin</th>
              <th style={{ textAlign: 'center' }}>Alpha</th>
              <th style={{ width: '200px' }}>Kehadiran</th>
            </tr>
          </thead>
          <tbody>
            {recap.recap.map(row => (
              <tr key={row.studentId}>
                <td>
                  <div className={styles.studentCell}>
                    <div className={styles.avatarSmall}>{row.fullName?.charAt(0)?.toUpperCase()}</div>
                    <div className={styles.studentName}>{row.fullName}</div>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={styles.badgeHadir}>{row.hadir}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={styles.badgeSakit}>{row.sakit}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={styles.badgeIzin}>{row.izin}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={styles.badgeAlpha}>{row.alpha}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={styles.progressBar} style={{ flex: 1 }}>
                      <div className={styles.progressFill} style={{ width: `${row.percentage}%` }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: row.percentage >= 75 ? 'var(--color-success-text)' : 'var(--color-failed-text)', minWidth: 36 }}>
                      {row.percentage}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherAttendancePage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [activeTab, setActiveTab] = useState('sessions');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [openingSession, setOpeningSession] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedSubject
        ? `/api/teacher/attendance?subjectId=${selectedSubject}`
        : '/api/teacher/attendance';
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSessions(data.sessions || []);
      if (data.subjects?.length > 0 && subjects.length === 0) {
        setSubjects(data.subjects);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleOpenSession = async () => {
    if (!selectedSubject) { setError('Pilih mata pelajaran terlebih dahulu.'); return; }
    setOpeningSession(true);
    setError(null);
    try {
      const res = await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: selectedSubject, durationMinutes: selectedDuration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowModal(false);
      setSuccess('Sesi absensi berhasil dibuka!');
      setTimeout(() => setSuccess(null), 3000);
      // Navigate to session detail
      router.push(`/dashboard/teacher/attendance/${data.sessionId}`);
    } catch (e) {
      setError(e.message);
      setShowModal(false);
    } finally {
      setOpeningSession(false);
    }
  };

  const hasOpenSession = sessions.some(s => s.status === 'open');

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Kelola Absensi</h1>
          <p className={styles.pageSubtitle}>Buka sesi, pantau kehadiran, dan lihat rekap siswa.</p>
        </div>
        <button
          className={styles.btnPrimary}
          onClick={() => { setError(null); setShowModal(true); }}
          disabled={hasOpenSession}
          title={hasOpenSession ? 'Sudah ada sesi yang sedang berjalan' : 'Buka sesi absensi baru'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Buka Sesi Absen
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {success && <div className={styles.successBanner}>{success}</div>}

      {/* Filter + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className={styles.subjectBar}>
          <select
            className={styles.select}
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
          >
            <option value="">Semua Mata Pelajaran</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id.toString()}>{s.subjectName} ({s.classCode})</option>
            ))}
          </select>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'sessions' ? styles.tabActive : ''}`} onClick={() => setActiveTab('sessions')}>
            Sesi Absensi
          </button>
          <button className={`${styles.tab} ${activeTab === 'recap' ? styles.tabActive : ''}`} onClick={() => setActiveTab('recap')}>
            Rekap Semester
          </button>
        </div>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Riwayat Sesi Absensi</h2>
              <p className={styles.cardSubtitle}>Klik sesi untuk melihat detail dan melakukan koreksi manual.</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.skeletonList}>
              {[0,1,2].map(i => <Skeleton key={i} h={68} radius={14} />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <p>Belum ada sesi absensi. Buka sesi untuk mulai mencatat kehadiran.</p>
            </div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map(session => (
                <div
                  key={session._id}
                  className={`${styles.sessionItem} ${session.status === 'open' ? styles.sessionItemOpen : ''}`}
                  onClick={() => router.push(`/dashboard/teacher/attendance/${session._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.sessionLeft}>
                    <div className={styles.sessionDate}>
                      {new Date(session.date).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    <div className={styles.sessionMeta}>
                      <span>{session.subjectName || 'Mata Pelajaran'}</span>
                      <span>·</span>
                      <span>{session.durationMinutes} menit</span>
                      <span>·</span>
                      <span>{new Date(session.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className={styles.sessionRight}>
                    <span className={styles.sessionCount}>
                      {session.hadirCount}/{session.totalCount} hadir
                    </span>
                    {session.status === 'open'
                      ? <span className={styles.badgeOpen}>Sedang Berlangsung</span>
                      : <span className={styles.badgeClosed}>Selesai</span>
                    }
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-subtext)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recap Tab */}
      {activeTab === 'recap' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Rekap Kehadiran Semester</h2>
              <p className={styles.cardSubtitle}>Persentase kehadiran tiap siswa berdasarkan sesi yang sudah selesai.</p>
            </div>
          </div>
          <RecapTab subjectId={selectedSubject} />
        </div>
      )}

      {/* Open Session Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Buka Sesi Absensi</h3>
            <p className={styles.modalSubtitle}>
              Pilih durasi sesi. Siswa dapat melakukan check-in selama waktu ini.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext)', marginBottom: 12 }}>Durasi:</p>
            <div className={styles.modalOptions}>
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  className={`${styles.durationOption} ${selectedDuration === d ? styles.durationOptionSelected : ''}`}
                  onClick={() => setSelectedDuration(d)}
                >
                  {d} menit
                </button>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>Batal</button>
              <button className={styles.btnPrimary} onClick={handleOpenSession} disabled={openingSession}>
                {openingSession ? 'Membuka...' : 'Mulai Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
