'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import styles from './monitoring.module.css';

type ExamEvent = {
  type: string;
  reason: string | null;
  at: string | null;
  exitAt?: string | null;
  returnedAt?: string | null;
  durationMs: number | null;
  countedAsViolation: boolean;
  violationRule?: string | null;
  exitCount?: number | null;
  unexpectedExitCount?: number | null;
  disconnectAt?: string | null;
  reconnectAt?: string | null;
};

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

type StudentRow = {
  studentId: string;
  namaSiswa: string;
  nisn: string;
  status: 'online' | 'offline';
  violationCount: number;
  answeredCount: number;
  submittedAt: string | null;
  lastSeenAt?: string | null;
  auditEventCount?: number;
  unexpectedExitCount?: number;
  hasActiveUnexpectedExit?: boolean;
  lastExamEvent?: {
    type: string;
    reason: string | null;
    at: string | null;
    durationMs: number | null;
    countedAsViolation: boolean;
  } | null;
  examEvents?: ExamEvent[];
  disconnectAt?: string | null;
  reconnectAt?: string | null;
  disconnectReason?: string | null;
  manualLockedAt?: string | null;
  manualLockReason?: string | null;
  sessionStatus?: string;
};

type MonitorResponse = {
  examId: string;
  examTitle?: string;
  isExamOpen?: boolean;
  fetchedAt: string;
  summary: { total: number; online: number; violated: number; finished: number };
  students: StudentRow[];
};

export default function MonitoringClient({ examId, examTitle }: { examId: string; examTitle: string }) {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);
  const [target, setTarget] = useState<StudentRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<StudentRow | null>(null);
  const [actionType, setActionType] = useState<'warn' | 'disqualify' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const isMobile = useIsMobile(640);

  const fetchData = useCallback(async (isRefetch = false) => {
    try {
      if (isRefetch) setRefreshing(true);
      const res = await fetch(`/api/proctor/monitor/${examId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal mengambil data monitoring');
      setData(json);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil data monitoring');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [examId]);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void fetchData(false);
    }, 0);
    const id = setInterval(() => fetchData(true), 7000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(id);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const lastUpdated = data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString('id-ID') : '-';
  const finishedRate = data?.summary.total ? Math.round((data.summary.finished / data.summary.total) * 100) : 0;
  const onlineRate = data?.summary.total ? Math.round((data.summary.online / data.summary.total) * 100) : 0;

  const formatShortDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (durationMs?: number | null) => {
    if (!Number.isFinite(Number(durationMs))) return '-';
    const totalSeconds = Math.max(0, Math.round(Number(durationMs) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const eventLabel = (type: string) => ({
    'explicit-violation': 'Pelanggaran eksplisit',
    'unexpected-exit-start': 'Keluar tak terduga',
    'unexpected-exit-return': 'Kembali ke ujian',
    'disconnect-lock': 'Sesi Terkunci (Disconnect)',
    'disconnect-reconnect-success': 'Reconnect (Berhasil)',
  }[type] || type);

  const eventReasonLabel = (reason?: string | null) => ({
    'visibility-hidden': 'Halaman disembunyikan',
    'window-blur': 'Fokus browser hilang',
    'fullscreen-exit': 'Keluar fullscreen',
    'alt-tab': 'Alt+Tab',
    'windows-key': 'Tombol Windows',
    'system-menu-shortcut': 'Shortcut sistem',
    'blocked-browser-shortcut': 'Shortcut browser/devtools',
    'page-hidden-or-closed': 'Halaman ditutup/disembunyikan',
    'page-exit': 'Keluar halaman',
    'exam-page-resumed': 'Masuk kembali ke ujian',
    'offline-disconnect': 'Koneksi terputus (Offline)',
    'offline/disconnect': 'Koneksi terputus (Offline)',
  }[reason || ''] || reason || '-');

  const handleWarn = async () => {
    if (!target) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/proctor/monitor/${examId}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: target.studentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal mengirim teguran');
      setToast(`Teguran terkirim ke ${target.namaSiswa}`);
      setActionType(null);
      setTarget(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Gagal mengirim teguran');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisqualify = async () => {
    if (!target) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/proctor/monitor/${examId}/disqualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: target.studentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal mendiskualifikasi siswa');
      setToast(`${target.namaSiswa} berhasil didiskualifikasi`);
      setActionType(null);
      setTarget(null);
      fetchData(true);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Gagal mendiskualifikasi siswa');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleExamAccess = async () => {
    if (!data) return;
    setAccessLoading(true);
    try {
      const nextState = !(data.isExamOpen === true);
      const res = await fetch(`/api/proctor/monitor/${examId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExamOpen: nextState }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal mengubah akses ujian');

      setData((prev) => (prev ? { ...prev, isExamOpen: nextState } : prev));
      setToast(json?.message || (nextState ? 'Ujian dibuka.' : 'Ujian ditutup.'));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Gagal mengubah akses ujian');
    } finally {
      setAccessLoading(false);
    }
  };

  return (
    <section className={styles.wrapper}>
      <PageHeader
        title={`${data?.examTitle || examTitle} - Proctor Monitoring`}
        subtitle={
          <>
            Last updated: {lastUpdated} <span className={styles.liveDot} /> Live{refreshing ? ' - menyegarkan data...' : ''}
          </>
        }
      >
        <div className={styles.headerActions}>
          <button
            className={`${styles.backBtn} ${data?.isExamOpen === true ? styles.endExamBtn : styles.openExamBtn}`}
            onClick={handleToggleExamAccess}
            disabled={accessLoading}
          >
            {accessLoading
              ? 'Memproses...'
              : data?.isExamOpen === true
                ? 'Tutup Akses Ujian'
                : 'Mulai / Buka Ujian'}
          </button>
          <Link href={`/dashboard/proctor/${examId}/questions`} className={styles.backBtn}>
            Lihat Soal Ujian
          </Link>
          <Link href="/dashboard/proctor" className={styles.backBtn}>
            Kembali ke Daftar Pengawasan
          </Link>
          <Link href="/dashboard/teacher" className={styles.backBtn}>
            Dashboard Guru
          </Link>
        </div>
      </PageHeader>

      {loading && <p className={styles.muted}>Memuat data monitoring...</p>}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && data && (
        <>
          <div className={styles.commandPanel}>
            <div>
              <span className={styles.panelEyebrow}>Ruang Pengawasan</span>
              <h2 className={styles.panelTitle}>Status peserta ujian</h2>
              <p className={styles.panelMeta}>
                {data.summary.total} peserta terpantau, {data.summary.finished} sudah selesai.
              </p>
              <p className={styles.panelMeta}>
                Akses siswa: <strong>{data.isExamOpen === true ? 'Dibuka' : 'Ditutup'}</strong>
              </p>
            </div>
            <div className={styles.panelMeters}>
              <div>
                <span>Online</span>
                <strong>{onlineRate}%</strong>
              </div>
              <div>
                <span>Selesai</span>
                <strong>{finishedRate}%</strong>
              </div>
            </div>
          </div>

          <div className={styles.stats}>
            <article className={styles.statCard}><span className={styles.statLabel}>Total Siswa</span><strong>{data.summary.total}</strong><small>Peserta yang masuk sesi</small></article>
            <article className={styles.statCard}><span className={styles.statLabel}>Siswa Online</span><strong className={styles.ok}>{data.summary.online}</strong><small>Aktif saat ini</small></article>
            <article className={styles.statCard}><span className={styles.statLabel}>Siswa Melanggar</span><strong className={styles.warn}>{data.summary.violated}</strong><small>Perlu perhatian pengawas</small></article>
            <article className={styles.statCard}><span className={styles.statLabel}>Siswa Selesai</span><strong className={styles.info}>{data.summary.finished}</strong><small>Jawaban terkumpul</small></article>
          </div>

          <div className={styles.tableWrap}>
            <div className={styles.tableHeader}>
              <div>
                <h3>Daftar Peserta</h3>
                <p>Urutan otomatis memprioritaskan siswa dengan pelanggaran.</p>
              </div>
            </div>
            {isMobile ? (
              /* ── Mobile card list ── */
              <div className={styles.mobileStudentList}>
                {data.students.map((student, idx) => (
                  <div key={student.studentId} className={`${styles.mobileStudentCard} ${student.violationCount > 0 ? styles.mobileCardViolation : ''}`}>
                    {/* Top: nomor + avatar + nama + status */}
                    <div className={styles.mobileStudentHead}>
                      <span className={styles.mobileStudentNo}>{idx + 1}</span>
                      <span className={styles.avatar}>{student.namaSiswa?.charAt(0)?.toUpperCase() || 'S'}</span>
                      <div className={styles.mobileStudentInfo}>
                        <strong>{student.namaSiswa}</strong>
                        <small>{student.studentId}</small>
                      </div>
                      <span className={`${styles.statusPill} ${student.status === 'online' ? styles.statusOnline : styles.statusOffline}`}>
                        <span className={`${styles.statusDot} ${student.status === 'online' ? styles.online : styles.offline}`} />
                        {student.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {/* Meta: NISN, pelanggaran, progress */}
                    <div className={styles.mobileStudentMeta}>
                      <div>
                        <span className={styles.mobileMetaLbl}>NISN</span>
                        <span className={styles.mobileMetaVal}>{student.nisn}</span>
                      </div>
                      <div>
                        <span className={styles.mobileMetaLbl}>Pelanggaran</span>
                        {student.violationCount > 0 ? (
                          <span className={styles.badge}>{student.violationCount}×</span>
                        ) : (
                          <span className={styles.cleanBadge}>Aman</span>
                        )}
                      </div>
                      <div>
                        <span className={styles.mobileMetaLbl}>Audit</span>
                        <span className={styles.mobileMetaVal}>
                          {student.auditEventCount || 0} event
                        </span>
                      </div>
                      <div>
                        <span className={styles.mobileMetaLbl}>Jawaban</span>
                        <span className={styles.progressCount}>{student.answeredCount}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={styles.mobileStudentActions}>
                      <button
                        className={styles.mobileActionBtn}
                        onClick={() => { setTarget(student); setActionType('warn'); }}
                      >
                        Tegur
                      </button>
                      <button
                        className={styles.mobileActionBtn}
                        onClick={() => setHistoryTarget(student)}
                      >
                        Riwayat
                      </button>
                      <button
                        className={`${styles.mobileActionBtn} ${styles.mobileActionDanger}`}
                        onClick={() => { setTarget(student); setActionType('disqualify'); }}
                      >
                        Diskualifikasi
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop table ── */
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nama Siswa</th>
                    <th>NISN</th>
                    <th>Status</th>
                    <th>Pelanggaran</th>
                    <th>Audit</th>
                    <th>Progress</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student, idx) => (
                    <tr key={student.studentId} className={student.violationCount > 0 ? styles.rowViolation : ''}>
                      <td>{idx + 1}</td>
                      <td>
                        <div className={styles.studentCell}>
                          <span className={styles.avatar}>{student.namaSiswa?.charAt(0)?.toUpperCase() || 'S'}</span>
                          <div>
                            <strong>{student.namaSiswa}</strong>
                            <small>{student.studentId}</small>
                          </div>
                        </div>
                      </td>
                      <td>{student.nisn}</td>
                      <td>
                        <span className={`${styles.statusPill} ${student.status === 'online' ? styles.statusOnline : styles.statusOffline}`}>
                          <span className={`${styles.statusDot} ${student.status === 'online' ? styles.online : styles.offline}`} />
                          {student.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td>
                        {student.violationCount > 0 ? (
                          <span className={styles.badge}>{student.violationCount} Pelanggaran</span>
                        ) : (
                          <span className={styles.cleanBadge}>Aman</span>
                        )}
                      </td>
                      <td>
                        <span className={student.hasActiveUnexpectedExit ? styles.badge : styles.cleanBadge}>
                          {student.auditEventCount || 0} event
                        </span>
                        <br />
                        <small>
                          {student.hasActiveUnexpectedExit
                            ? 'Keluar belum kembali'
                            : student.lastExamEvent?.type
                              ? `${student.lastExamEvent.type} - ${formatShortDateTime(student.lastExamEvent.at)}`
                              : `Seen ${formatShortDateTime(student.lastSeenAt)}`}
                        </small>
                      </td>
                      <td><span className={styles.progressCount}>{student.answeredCount}</span></td>
                      <td className={styles.actions}>
                        <button onClick={() => { setTarget(student); setActionType('warn'); }}>Tegur</button>
                        <button onClick={() => setHistoryTarget(student)}>Riwayat</button>
                        <button className={styles.danger} onClick={() => { setTarget(student); setActionType('disqualify'); }}>
                          Diskualifikasi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={actionType === 'warn'}
        onClose={() => { if (!actionLoading) { setActionType(null); setTarget(null); } }}
        onConfirm={handleWarn}
        title="Kirim Teguran"
        message={`Kirim teguran ke ${target?.namaSiswa || 'siswa'} sekarang?`}
        loading={actionLoading}
        confirmLabel="Kirim Teguran"
      />

      <Modal
        isOpen={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title={`Riwayat Pelanggaran - ${historyTarget?.namaSiswa || 'Siswa'}`}
        maxWidth="760px"
      >
        {historyTarget && (
          <div className={styles.historyModal}>
            <div className={styles.historySummary}>
              <div>
                <span className={styles.historyLabel}>Pelanggaran Resmi</span>
                <strong>{historyTarget.violationCount}</strong>
              </div>
              <div>
                <span className={styles.historyLabel}>Audit Event</span>
                <strong>{historyTarget.auditEventCount || 0}</strong>
              </div>
              <div>
                <span className={styles.historyLabel}>Keluar Tak Terduga</span>
                <strong>{historyTarget.unexpectedExitCount || 0}</strong>
              </div>
              <div>
                <span className={styles.historyLabel}>Terakhir Aktif</span>
                <strong>{formatShortDateTime(historyTarget.lastSeenAt)}</strong>
              </div>
            </div>

            {historyTarget.sessionStatus === 'locked' && historyTarget.disconnectReason === 'offline/disconnect' && (
              <div className={styles.historyAlert} style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B', borderLeftWidth: '4px' }}>
                <strong>Sesi Terkunci Otomatis (Disconnect):</strong>
                <br />
                Siswa terputus dari server pada <strong>{formatFullDateTime(historyTarget.disconnectAt)}</strong> dan mencoba menghubungkan kembali pada <strong>{formatFullDateTime(historyTarget.reconnectAt)}</strong> (melebihi batas waktu toleransi 2 menit).
              </div>
            )}

            {historyTarget.hasActiveUnexpectedExit && (
              <div className={styles.historyAlert}>
                Siswa tercatat keluar dari halaman ujian dan belum kembali pada refresh terakhir.
              </div>
            )}

            {!historyTarget.examEvents || historyTarget.examEvents.length === 0 ? (
              <p className={styles.muted}>Belum ada riwayat pelanggaran atau audit teknis untuk siswa ini.</p>
            ) : (
              <div className={styles.historyList}>
                {[...historyTarget.examEvents].reverse().map((event, idx) => (
                  <article
                    key={`${event.type}-${event.at || idx}-${idx}`}
                    className={`${styles.historyItem} ${event.countedAsViolation ? styles.historyViolation : ''}`}
                  >
                    <div className={styles.historyItemTop}>
                      <div>
                        <strong>{eventLabel(event.type)}</strong>
                        <span>{formatFullDateTime(event.at || event.returnedAt || event.exitAt)}</span>
                      </div>
                      <span className={event.countedAsViolation ? styles.badge : styles.cleanBadge}>
                        {event.countedAsViolation ? 'Dihitung Pelanggaran' : 'Audit'}
                      </span>
                    </div>
                    <div className={styles.historyMetaGrid}>
                      <div>
                        <span>Alasan</span>
                        <strong>{eventReasonLabel(event.reason)}</strong>
                      </div>
                      {event.durationMs !== null && (
                        <div>
                          <span>Durasi keluar</span>
                          <strong>{formatDuration(event.durationMs)}</strong>
                        </div>
                      )}
                      {event.unexpectedExitCount !== null && (
                        <div>
                          <span>Total keluar tak terduga</span>
                          <strong>{event.unexpectedExitCount}</strong>
                        </div>
                      )}
                      {event.exitCount !== null && (
                        <div>
                          <span>Exit count saat itu</span>
                          <strong>{event.exitCount}</strong>
                        </div>
                      )}
                      {event.violationRule && (
                        <div>
                          <span>Aturan</span>
                          <strong>{event.violationRule}</strong>
                        </div>
                      )}
                      {event.disconnectAt && (
                        <div>
                          <span>Waktu Disconnect</span>
                          <strong>{formatFullDateTime(event.disconnectAt)}</strong>
                        </div>
                      )}
                      {event.reconnectAt && (
                        <div>
                          <span>Waktu Reconnect</span>
                          <strong>{formatFullDateTime(event.reconnectAt)}</strong>
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
        isOpen={actionType === 'disqualify'}
        onClose={() => { if (!actionLoading) { setActionType(null); setTarget(null); } }}
        onConfirm={handleDisqualify}
        title="Konfirmasi Diskualifikasi"
        message={`Diskualifikasi ${target?.namaSiswa || 'siswa'} dari ujian ini?`}
        loading={actionLoading}
        confirmLabel="Diskualifikasi"
      />

      {toast && <div className={styles.toast}>{toast}</div>}
    </section>
  );
}
