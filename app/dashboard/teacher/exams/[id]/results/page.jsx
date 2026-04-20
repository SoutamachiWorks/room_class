'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../../../../admin/admin.module.css';

export default function ExamResultsPage() {
  const { id: examId } = useParams();
  const router = useRouter();
  
  const [examTitle, setExamTitle] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in-progress':
        return <span className={styles.badge} style={{ background: '#FEF3C7', color: '#92400E' }}>Sedang Ujian</span>;
      case 'submitted':
        return <span className={styles.badge} style={{ background: '#D1F0D9', color: '#198754' }}>Selesai</span>;
      case 'locked':
        return <span className={styles.badge} style={{ background: '#FDE0DD', color: '#DC3545' }}>Terkunci</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <button 
            onClick={() => router.push('/dashboard/teacher/exams')}
            style={{ background: 'none', border: 'none', color: 'var(--color-subtext)', cursor: 'pointer', marginBottom: '8px', fontSize: '0.875rem' }}
          >
            ← Kembali ke Bank Ujian
          </button>
          <h1 className={styles.pageTitle}>{examTitle}</h1>
        </div>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Pantau progres ujian siswa, lihat aktivitas perpindahan tab, dan berikan akses kembali jika siswa terkunci (buka kunci).
        </p>

        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat hasil ujian...
            </div>
          ) : sessions.length === 0 ? (
            <div className={styles.emptyState}>Belum ada siswa yang memulai ujian ini.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Nama Siswa</th>
                  <th style={{ textAlign: 'center' }}>Waktu Mulai</th>
                  <th style={{ textAlign: 'center' }}>Status Ujian</th>
                  <th style={{ textAlign: 'center' }}>Pelanggaran</th>
                  <th style={{ textAlign: 'center' }}>Status Koreksi</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => (
                  <tr key={sess._id}>
                    <td data-label="Siswa">
                      <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{sess.studentInfo?.fullName || 'Siswa Dihapus'}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                        <span className={`${styles.badge} ${styles.badgeStudent}`}>{sess.studentInfo?.classCode || '-'}</span>
                      </div>
                    </td>
                    <td data-label="Waktu Mulai" style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                      {new Date(sess.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td data-label="Status" style={{ textAlign: 'center' }}>
                      {getStatusBadge(sess.status)}
                    </td>
                    <td data-label="Pelanggaran" style={{ textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: sess.exitCount >= 2 ? '#DC3545' : sess.exitCount === 1 ? '#D97706' : 'var(--color-subtext)'
                      }}>
                        {sess.exitCount || 0} kali
                      </span>
                    </td>
                    <td data-label="Koreksi" style={{ textAlign: 'center' }}>
                      {sess.status === 'submitted' ? (
                        sess.gradingStatus === 'pending-manual' ? (
                          <span style={{ fontSize: '0.8125rem', color: '#D97706', fontWeight: 600 }}>Perlu Dikoreksi</span>
                        ) : sess.gradingStatus === 'auto-graded' ? (
                          <span style={{ fontSize: '0.8125rem', color: '#198754', fontWeight: 600 }}>Ternilai Otomatis</span>
                        ) : sess.gradingStatus === 'fully-graded' ? (
                          <span style={{ fontSize: '0.8125rem', color: '#198754', fontWeight: 600 }}>Sudah Dikoreksi</span>
                        ) : (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)' }}>-</span>
                        )
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)' }}>-</span>
                      )}
                    </td>
                    <td data-label="Aksi">
                      <div className={styles.actionBtns} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                        {sess.status === 'submitted' && (
                          <button
                            className={styles.btnPrimary}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#4F46E5', color: '#FFF' }}
                            onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results/${sess._id}`)}
                          >
                            Koreksi Layar
                          </button>
                        )}
                        {sess.status === 'locked' && (
                          <button
                            className={styles.btnPrimary}
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            onClick={() => requestAction(sess._id, sess.studentInfo?.fullName, 'unlock')}
                          >
                            Buka Kunci
                          </button>
                        )}
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#DC3545', border: '1px solid #FCA5A5' }}
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
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmConfig.type === 'unlock' ? 'Buka Kunci Ujian' : 'Hapus & Reset Total'}
        message={
          confirmConfig.type === 'unlock' 
          ? `Siswa atas nama ${confirmConfig.studentName} akan diizinkan untuk melanjutkan sisa ujian (pelanggaran di-reset). Tindakan ini tidak mengubah jawaban yang sudah ada.`
          : `PERINGATAN: Sesi ujian atas nama ${confirmConfig.studentName} akan dihapus TOTAL secara permanen. Siswa akan mengulangi soal dari awal. Yakin ingin melanjutkan?`
        }
        loading={actionLoading}
      />
    </>
  );
}
