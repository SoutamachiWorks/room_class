'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../../admin/admin.module.css';

function StudentExamsContent() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSubmitted = searchParams.get('submitted') === '1';

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/exams');
      const data = await res.json();
      if (res.ok) setExams(data.exams || []);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const getSessionStatus = (exam) => {
    let baseStatus = 'available';
    if (exam.session) {
      baseStatus = exam.session.status; // 'in-progress' | 'submitted' | 'locked'
    }

    if ((baseStatus === 'available' || baseStatus === 'in-progress') && exam.deadline) {
      if (new Date(exam.deadline).getTime() < Date.now()) {
        return 'expired';
      }
    }
    return baseStatus;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'available':
        return { label: 'Tersedia', className: `${styles.badge} ${styles.statusActive}` };
      case 'in-progress':
        return { label: 'Sedang Dikerjakan', className: styles.badge, style: { background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', border: '1px solid currentColor' } };
      case 'submitted':
        return { label: 'Sudah Dikumpulkan', className: styles.badge, style: { background: 'var(--color-success-bg)', color: 'var(--color-success-text)' } };
      case 'locked':
        return { label: 'Terkunci', className: styles.badge, style: { background: 'var(--color-failed-bg)', color: 'var(--color-failed-text)' } };
      case 'expired':
        return { label: 'Melewati Deadline', className: styles.badge, style: { background: 'var(--bg-card)', color: 'var(--color-subtext)', border: '1px solid var(--color-border)' } };
      default:
        return { label: status, className: styles.badge };
    }
  };

  const handleStartExam = async (exam) => {
    setStartingId(exam._id);
    setNotifBlocked(false);

    // Step 1: Notification Permission Gate
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

    // Step 2: Start the exam session via API
    try {
      const res = await fetch(`/api/student/exams/${exam._id}/start`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          router.push('/dashboard/student/exams/lockout');
        } else {
          alert(data.error || 'Gagal memulai ujian.');
        }
        setStartingId(null);
        return;
      }

      // Navigate to the take exam page
      router.push(`/dashboard/student/exams/${exam._id}/take`);
    } catch {
      alert('Koneksi ke server gagal.');
      setStartingId(null);
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Ujian</h1>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Daftar ujian yang dipublikasikan oleh guru untuk kelas Anda. Klik &quot;Mulai Ujian&quot; untuk mengerjakan.
        </p>

        {isSubmitted && (
          <div style={{
            padding: '14px 20px',
            background: 'var(--color-success-bg)',
            borderRadius: '12px',
            border: '1px solid currentColor',
            color: 'var(--color-success)',
            fontSize: '0.875rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <div>
              <strong>Jawaban berhasil dikirim,</strong> nilai akan segera diumumkan oleh guru.
            </div>
          </div>
        )}

        {notifBlocked && (
          <div style={{
            padding: '14px 20px',
            background: 'var(--color-warning-bg)',
            borderRadius: '12px',
            border: '1px solid currentColor',
            color: 'var(--color-warning)',
            fontSize: '0.875rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <strong>Izin Notifikasi Ditolak.</strong> Anda harus mengaktifkan notifikasi browser untuk mengikuti ujian. Silakan buka pengaturan browser Anda dan aktifkan notifikasi untuk situs ini, lalu coba lagi.
            </div>
          </div>
        )}

        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat daftar ujian...
            </div>
          ) : exams.length === 0 ? (
            <div className={styles.emptyState}>Belum ada ujian yang dipublikasikan untuk kelas Anda.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Tanggal</th>
                  <th style={{ width: '25%' }}>Judul Ujian</th>
                  <th style={{ width: '20%' }}>Mata Pelajaran</th>
                  <th style={{ textAlign: 'center' }}>Jumlah Soal</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Nilai / Aksi</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const sessionStatus = getSessionStatus(exam);
                  const badge = getStatusBadge(sessionStatus);

                  return (
                    <tr key={exam._id}>
                      <td>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                          {new Date(exam.createdAt).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-heading)' }}>{exam.title}</div>
                        {exam.deadline && (
                          <div style={{ fontSize: '0.75rem', marginTop: '4px', color: sessionStatus === 'expired' ? 'var(--color-danger)' : 'var(--color-subtext)', fontWeight: sessionStatus === 'expired' ? 600 : 400 }}>
                            ⏱️ Deadline: {new Date(exam.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          {exam.subjectDetails?.subjectName || '-'}
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                          <span className={`${styles.badge} ${styles.badgeStudent}`}>
                            {exam.subjectDetails?.classCode || '-'}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{exam.randomCount || exam.totalQuestions}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)' }}> soal</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={badge.className} style={badge.style || {}}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {sessionStatus === 'available' && (
                          <button
                            className={styles.btnPrimary}
                            style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                            onClick={() => handleStartExam(exam)}
                            disabled={startingId === exam._id}
                          >
                            {startingId === exam._id ? 'Memulai...' : 'Mulai Ujian'}
                          </button>
                        )}
                        {sessionStatus === 'in-progress' && (
                          <button
                            className={styles.btnPrimary}
                            style={{ padding: '8px 16px', fontSize: '0.75rem' }}
                            onClick={() => handleStartExam(exam)}
                            disabled={startingId === exam._id}
                          >
                            {startingId === exam._id ? 'Lanjutkan...' : 'Lanjutkan Ujian'}
                          </button>
                        )}
                        {sessionStatus === 'submitted' && (
                          exam.showResults ? (
                            exam.session?.gradingStatus === 'pending-manual' ? (
                              <div>
                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-warning)', fontWeight: 600 }}>Menunggu Koreksi Guru</span>
                              </div>
                            ) : (
                              <div>
                                <span style={{ fontSize: '1.25rem', color: 'var(--color-success)', fontWeight: 800 }}>{exam.session?.calculatedScore || 0}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', marginLeft: '4px' }}>/ 100</span>
                              </div>
                            )
                          ) : (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)', fontStyle: 'italic' }}>Diumumkan Nanti</span>
                          )
                        )}
                        {sessionStatus === 'locked' && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', fontWeight: 600 }}>Terkunci</span>
                        )}
                        {sessionStatus === 'expired' && (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)', fontWeight: 600 }}>Melewati Deadline</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
