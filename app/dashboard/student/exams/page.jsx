'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from '../../admin/admin.module.css';

function StudentExamsContent() {
  const [exams, setExams] = useState([]);
  const [enrolledYears, setEnrolledYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');
  const isSubmitted = searchParams.get('submitted') === '1';

  useEffect(() => {
    setCurrentTime(Date.now());
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
    fetchExams();
  }, [fetchExams]);

  const getSessionStatus = (exam) => {
    let baseStatus = 'available';
    if (exam.session) {
      baseStatus = exam.session.status; // 'in-progress' | 'submitted' | 'locked'
    }

    if ((baseStatus === 'available' || baseStatus === 'in-progress') && exam.deadline && currentTime > 0) {
      if (new Date(exam.deadline).getTime() < currentTime) {
        return 'expired';
      }
    }
    return baseStatus;
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

  const isArchiveMode = yearId && enrolledYears.length > 0 && yearId !== enrolledYears[enrolledYears.length - 1].yearId;

  return (
    <>
      <PageHeader
        title={<>Ujian {isArchiveMode && <span className={styles.archiveTag}>(Mode Arsip)</span>}</>}
        subtitle="Daftar ujian yang dipublikasikan oleh guru untuk kelas Anda. Klik 'Mulai Ujian' untuk mengerjakan."
      />

      {isArchiveMode && (
        <div className={styles.archiveBanner}>
          ⚠️ Anda sedang melihat riwayat ujian tahun ajaran sebelumnya.
        </div>
      )}

      {isSubmitted && (
        <div className={styles.successBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bannerIcon}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div>
            <strong>Jawaban berhasil dikirim,</strong> nilai akan segera diumumkan oleh guru.
          </div>
        </div>
      )}

      {notifBlocked && (
        <div className={styles.warningBanner}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bannerIcon}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <strong>Izin Notifikasi Ditolak.</strong> Anda harus mengaktifkan notifikasi browser untuk mengikuti ujian. Silakan buka pengaturan browser Anda dan aktifkan notifikasi untuk situs ini, lalu coba lagi.
          </div>
        </div>
      )}

      <ContentCard>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat daftar ujian...
            </div>
          ) : exams.length === 0 ? (
            <EmptyState
              title="Belum Ada Ujian"
              description="Belum ada ujian yang dipublikasikan untuk kelas Anda."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Judul Ujian</th>
                  <th>Mata Pelajaran</th>
                  <th className={styles.thCenter}>Jumlah Soal</th>
                  <th className={styles.thCenter}>Status</th>
                  <th className={styles.thCenter}>Nilai / Aksi</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const sessionStatus = getSessionStatus(exam);

                  return (
                    <tr key={exam._id}>
                      <td data-label="Tanggal">
                        <div className={styles.cellBold}>
                          {new Date(exam.createdAt).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td data-label="Judul Ujian">
                        <div className={styles.userName}>{exam.title}</div>
                        {exam.deadline && (
                          <div className={`${styles.deadlineText} ${sessionStatus === 'expired' ? styles.deadlineExpired : ''}`}>
                            ⏱️ Deadline: {new Date(exam.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        )}
                      </td>
                      <td data-label="Mapel">
                        <div className={styles.cellAccent}>
                          {exam.subjectDetails?.subjectName || '-'}
                        </div>
                        <div className={styles.cellChipWrap}>
                          <StatusBadge variant="student">
                            {exam.subjectDetails?.classCode || '-'}
                          </StatusBadge>
                        </div>
                      </td>
                      <td data-label="Soal" className={styles.tdCenter}>
                        <span className={styles.cellBoldInline}>{exam.randomCount || exam.totalQuestions}</span>
                        <span className={styles.cellSecondary}> soal</span>
                      </td>
                      <td data-label="Status" className={styles.tdCenter}>
                        {sessionStatus === 'available' && <StatusBadge variant="success">Tersedia</StatusBadge>}
                        {sessionStatus === 'in-progress' && <StatusBadge variant="warning">Sedang Dikerjakan</StatusBadge>}
                        {sessionStatus === 'submitted' && <StatusBadge variant="success">Sudah Dikumpulkan</StatusBadge>}
                        {sessionStatus === 'locked' && <StatusBadge variant="danger">Terkunci</StatusBadge>}
                        {sessionStatus === 'expired' && <StatusBadge variant="neutral">Melewati Deadline</StatusBadge>}
                      </td>
                      <td data-label="Nilai / Aksi" className={styles.tdCenter}>
                        {isArchiveMode ? (
                          exam.session?.calculatedScore !== undefined ? (
                            <div>
                              <span className={styles.examScoreLarge}>{exam.session?.calculatedScore || 0}</span>
                              <span className={styles.examScoreSuffix}>/ 100</span>
                            </div>
                          ) : (
                            <span className={styles.noDataText}>Tidak Ada Data</span>
                          )
                        ) : sessionStatus === 'available' && (
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
                            onClick={() => handleStartExam(exam)}
                            disabled={startingId === exam._id}
                          >
                            {startingId === exam._id ? 'Memulai...' : 'Mulai Ujian'}
                          </button>
                        )}
                        {sessionStatus === 'in-progress' && (
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
                            onClick={() => handleStartExam(exam)}
                            disabled={startingId === exam._id}
                          >
                            {startingId === exam._id ? 'Lanjutkan...' : 'Lanjutkan Ujian'}
                          </button>
                        )}
                        {sessionStatus === 'submitted' && (
                          exam.showResults ? (
                            exam.session?.gradingStatus === 'pending-manual' ? (
                              <span className={styles.gradingPending}>Menunggu Koreksi Guru</span>
                            ) : (
                              <div>
                                <span className={styles.examScoreLarge}>{exam.session?.calculatedScore || 0}</span>
                                <span className={styles.examScoreSuffix}>/ 100</span>
                              </div>
                            )
                          ) : (
                            <span className={styles.noDataText}>Diumumkan Nanti</span>
                          )
                        )}
                        {sessionStatus === 'locked' && (
                          <span className={styles.lockedText}>Terkunci</span>
                        )}
                        {sessionStatus === 'expired' && (
                          <span className={styles.expiredText}>Melewati Deadline</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
