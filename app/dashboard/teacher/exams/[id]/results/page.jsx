'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from '../../../../admin/admin.module.css';

export default function ExamResultsPage() {
  const { id: examId } = useParams();
  const router = useRouter();
  
  const [examTitle, setExamTitle] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // States for Confirm Dialog
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ action: null, sessionId: null, studentName: '', type: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/sessions`);
      const data = await res.json();
      if (res.ok) {
        setSessions(data.sessions || []);
        setExamTitle(data.examTitle || 'Hasil Ujian');
      } else {
        alert(data.error || 'Gagal memuat hasil ujian.');
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

  // Pagination logic
  const totalPages = Math.ceil(sessions.length / itemsPerPage);
  const paginatedSessions = sessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const requestAction = (sessionId, studentName, type) => {
    setConfirmConfig({ sessionId, studentName, type });
    setIsConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    const { sessionId, type } = confirmConfig;
    if (!sessionId) return;
    
    setActionLoading(true);
    try {
      const method = type === 'unlock' ? 'PATCH' : 'DELETE';
      const res = await fetch(`/api/teacher/exams/${examId}/sessions/${sessionId}/unlock`, {
        method,
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || 'Gagal mengeksekusi perintah.');
      } else {
        fetchResults();
      }
    } catch {
      alert('Koneksi sistem gagal.');
    } finally {
      setActionLoading(false);
      setIsConfirmOpen(false);
    }
  };

  const getViolationClass = (exitCount) => {
    if (exitCount >= 2) return styles.violationHigh;
    if (exitCount === 1) return styles.violationMedium;
    return styles.violationNone;
  };

  return (
    <>
      <PageHeader title={examTitle} subtitle="Pantau progres ujian siswa, lihat aktivitas perpindahan tab, dan berikan akses kembali jika siswa terkunci.">
        <button
          onClick={() => router.push('/dashboard/teacher/exams')}
          className={styles.btnBack}
        >
          ← Kembali ke Bank Ujian
        </button>
      </PageHeader>

      <ContentCard>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat hasil ujian...
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              title="Belum Ada Peserta"
              description="Belum ada siswa yang memulai ujian ini."
            />
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nama Siswa</th>
                    <th className={styles.thCenter}>Waktu Mulai</th>
                    <th className={styles.thCenter}>Status Ujian</th>
                    <th className={styles.thCenter}>Pelanggaran</th>
                    <th className={styles.thCenter}>Status Koreksi</th>
                    <th className={styles.thCenter}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.map((sess) => (
                    <tr key={sess._id}>
                      <td data-label="Siswa">
                        <div className={styles.userName}>{sess.studentInfo?.fullName || 'Siswa Dihapus'}</div>
                        <div className={styles.cellChipWrap}>
                          <StatusBadge variant="student">{sess.studentInfo?.classCode || '-'}</StatusBadge>
                        </div>
                      </td>
                      <td data-label="Waktu Mulai" className={styles.tdCenter}>
                        {new Date(sess.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td data-label="Status" className={styles.tdCenter}>
                        {sess.status === 'in-progress' && <StatusBadge variant="warning">Sedang Ujian</StatusBadge>}
                        {sess.status === 'submitted' && <StatusBadge variant="success">Selesai</StatusBadge>}
                        {sess.status === 'locked' && <StatusBadge variant="danger">Terkunci</StatusBadge>}
                        {!['in-progress', 'submitted', 'locked'].includes(sess.status) && <StatusBadge>{sess.status}</StatusBadge>}
                      </td>
                      <td data-label="Pelanggaran" className={styles.tdCenter}>
                        <span className={getViolationClass(sess.exitCount)}>
                          {sess.exitCount || 0} kali
                        </span>
                      </td>
                      <td data-label="Koreksi" className={styles.tdCenter}>
                        {sess.status === 'submitted' ? (
                          sess.gradingStatus === 'pending-manual' ? (
                            <span className={styles.gradingPending}>Perlu Dikoreksi</span>
                          ) : sess.gradingStatus === 'auto-graded' ? (
                            <span className={styles.gradingDone}>Ternilai Otomatis</span>
                          ) : sess.gradingStatus === 'fully-graded' ? (
                            <span className={styles.gradingDone}>Sudah Dikoreksi</span>
                          ) : (
                            <span className={styles.cellSecondary}>-</span>
                          )
                        ) : (
                          <span className={styles.cellSecondary}>-</span>
                        )}
                      </td>
                      <td data-label="Aksi" className={styles.tdCenter}>
                        <div className={`${styles.actionBtns} ${styles.actionBtnsCenter}`}>
                          {sess.status === 'submitted' && (
                            <button
                              className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
                              onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}
                            >
                              Koreksi Layar
                            </button>
                          )}
                          {(sess.status === 'locked' || (sess.status === 'in-progress' && sess.exitCount > 0)) && (
                            <button
                              className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
                              onClick={() => requestAction(sess._id, sess.studentInfo?.fullName, 'unlock')}
                            >
                              Buka Kunci
                            </button>
                          )}
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                            onClick={() => requestAction(sess._id, sess.studentInfo?.fullName, 'reset')}
                          >
                            Reset Total
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination UI */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <div className={styles.pageInfo}>
                    Menampilkan <strong>{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, sessions.length)}</strong> dari <strong>{sessions.length}</strong> siswa
                  </div>
                  <div className={styles.pageControls}>
                    <button 
                      className={styles.pageBtn} 
                      onClick={handlePrevPage} 
                      disabled={currentPage === 1}
                    >
                      Sebelumnya
                    </button>
                    <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>
                      {currentPage}
                    </button>
                    <button 
                      className={styles.pageBtn} 
                      onClick={handleNextPage} 
                      disabled={currentPage === totalPages}
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ContentCard>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmConfig.type === 'unlock' ? 'Buka Kunci Ujian' : 'Hapus & Reset Total'}
        message={
          confirmConfig.type === 'unlock' 
          ? `Siswa atas nama ${confirmConfig.studentName} akan diizinkan untuk melanjutkan sisa ujian (pelanggaran di-reset ke 0). Tindakan ini akan mengaktifkan kembali sesi yang terkunci atau membersihkan riwayat pelanggaran sementara.`
          : `PERINGATAN: Sesi ujian atas nama ${confirmConfig.studentName} akan dihapus TOTAL secara permanen. Siswa akan mengulangi soal dari awal. Yakin ingin melanjutkan?`
        }
        loading={actionLoading}
      />
    </>
  );
}
