'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../attendance.module.css';

const STATUS_OPTIONS = ['hadir', 'sakit', 'izin', 'alpha'];

function StatusBadge({ status }) {
  if (!status) return <span className={styles.badgeAlpha}>Belum Absen</span>;
  const map = { hadir: styles.badgeHadir, sakit: styles.badgeSakit, izin: styles.badgeIzin, alpha: styles.badgeAlpha };
  const label = { hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpha: 'Alpha' };
  return <span className={map[status] || styles.badgeAlpha}>{label[status] || status}</span>;
}

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt) - new Date();
      setRemaining(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  return { remaining, display: `${minutes}:${seconds}` };
}

// ── Student Row ───────────────────────────────────────────────────────────────
function StudentRow({ student, sessionId, sessionClosed, onSaved }) {
  const current = student.attendance?.status || null;
  const [status, setStatus] = useState(current || 'alpha');
  const [note, setNote] = useState(student.attendance?.note || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/teacher/attendance/${sessionId}/students/${student.studentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, note }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isManual = student.attendance?.isManual;

  return (
    <tr>
      <td>
        <div className={styles.studentCell}>
          <div className={styles.avatarSmall}>{student.fullName?.charAt(0)?.toUpperCase() || '?'}</div>
          <div>
            <div className={styles.studentName}>{student.fullName}</div>
            <div className={styles.classCode}>{student.classCode}</div>
          </div>
        </div>
      </td>
      <td>
        {student.attendance?.checkedInAt
          ? <span className={styles.checkInTime}>
              {new Date(student.attendance.checkedInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          : <span style={{ color: 'var(--color-subtext)', fontSize: '0.8rem' }}>—</span>
        }
      </td>
      <td>
        <StatusBadge status={current} />
        {isManual && (
          <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--color-subtext)' }}>(manual)</span>
        )}
      </td>
      <td>
        <select
          className={styles.statusSelect}
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          className={styles.noteInput}
          type="text"
          placeholder="Catatan (opsional)"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </td>
      <td>
        <button
          className={styles.btnSave}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '...' : saved ? '✓ Tersimpan' : 'Simpan'}
        </button>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceSessionDetailPage() {
  const { sessionId } = useParams();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/attendance/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session);
      setStudents(data.students);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDetail();
    // Poll for real-time updates every 10s while session is open
    intervalRef.current = setInterval(fetchDetail, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchDetail]);

  const { remaining, display: timerDisplay } = useCountdown(session?.expiresAt);
  const isExpired = remaining === 0;
  const isClosed = session?.status === 'closed';

  // Stop polling when closed
  useEffect(() => {
    if (isClosed || isExpired) {
      clearInterval(intervalRef.current);
    }
  }, [isClosed, isExpired]);

  const handleCloseSession = async () => {
    if (!confirm('Tutup sesi sekarang? Siswa yang belum absen akan otomatis ditandai Alpha.')) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/teacher/attendance/${sessionId}`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchDetail();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  };

  const hadirCount = students.filter(s => s.attendance?.status === 'hadir').length;
  const alphaCount = students.filter(s => !s.attendance || s.attendance.status === 'alpha').length;

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonList}>
          <Skeleton h={40} w={300} radius={12} />
          <Skeleton h={68} radius={14} />
          <Skeleton h={200} radius={20} />
        </div>
      </div>
    );
  }

  if (error) return <div className={styles.page}><div className={styles.errorBanner}>{error}</div></div>;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href="/dashboard/teacher/attendance" className={styles.btnSecondary} style={{ padding: '7px 14px', fontSize: '0.8rem' }}>
          ← Kembali
        </Link>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext)' }}>
          / {session?.subjectName || 'Sesi Absensi'}
        </span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{session?.subjectName}</h1>
          <p className={styles.pageSubtitle}>
            {session?.date && new Date(session.date).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {' · '} Durasi {session?.durationMinutes} menit
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isClosed && !isExpired && (
            <button className={styles.btnDanger} onClick={handleCloseSession} disabled={closing}>
              {closing ? 'Menutup...' : 'Tutup Sesi Sekarang'}
            </button>
          )}
          {(isClosed || isExpired) && (
            <span className={styles.badgeClosed} style={{ fontSize: '0.875rem', padding: '8px 16px' }}>
              ✓ Sesi Selesai
            </span>
          )}
        </div>
      </div>

      {/* Timer */}
      {!isClosed && (
        <div className={`${styles.timerBox} ${isExpired ? styles.timerExpired : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span className={styles.timerLabel}>{isExpired ? 'Sesi berakhir' : 'Waktu tersisa:'}</span>
          <span className={`${styles.timerValue} ${isExpired ? styles.timerExpired : ''}`}>
            {isExpired ? '00:00' : timerDisplay}
          </span>
        </div>
      )}

      {/* Quick stats */}
      <div className={styles.recapStats} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className={`${styles.recapStatCard} ${styles.recapHadir}`}>
          <span className={styles.recapStatValue}>{hadirCount}</span>
          <span className={styles.recapStatLabel}>Hadir</span>
        </div>
        <div className={`${styles.recapStatCard} ${styles.recapAlpha}`}>
          <span className={styles.recapStatValue}>{alphaCount}</span>
          <span className={styles.recapStatLabel}>Belum / Alpha</span>
        </div>
        <div className={styles.recapStatCard} style={{ background: '#F3F4F6' }}>
          <span className={styles.recapStatValue} style={{ color: 'var(--color-text)' }}>{students.length}</span>
          <span className={styles.recapStatLabel} style={{ color: 'var(--color-subtext)' }}>Total Siswa</span>
        </div>
      </div>

      {/* Student table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Daftar Kehadiran Siswa</h2>
            <p className={styles.cardSubtitle}>Ubah status dan simpan koreksi manual per baris.</p>
          </div>
          <button className={styles.btnSecondary} onClick={fetchDetail} style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
            ↻ Refresh
          </button>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama Siswa</th>
                <th>Jam Check-in</th>
                <th>Status Saat Ini</th>
                <th>Ubah Status</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <StudentRow
                  key={student.studentId}
                  student={student}
                  sessionId={sessionId}
                  sessionClosed={isClosed || isExpired}
                  onSaved={fetchDetail}
                />
              ))}
            </tbody>
          </table>
          {students.length === 0 && (
            <div className={styles.emptyState}><p>Tidak ada siswa di kelas ini.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ h, w, radius }) {
  return <div className={styles.skeleton} style={{ height: h, width: w, borderRadius: radius, marginBottom: 10 }} />;
}
