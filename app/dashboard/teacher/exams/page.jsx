'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../../admin/admin.module.css';

export default function ExamsPage() {
  const router = useRouter();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Delete state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Publish loading tracker (per exam ID)
  const [publishLoading, setPublishLoading] = useState(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teacher/exams');
      const data = await res.json();
      if (res.ok) setExams(data.exams);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Publish / Unpublish toggle
  const handleTogglePublish = async (exam) => {
    setPublishLoading(exam._id);
    try {
      const res = await fetch(`/api/teacher/exams/${exam._id}/publish`, { method: 'PUT' });
      const data = await res.json();
      if (res.ok) {
        fetchExams();
      } else {
        alert(data.error || 'Gagal mengubah status ujian.');
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setPublishLoading(null);
    }
  };

  // Visibility toggle
  const [visibilityLoading, setVisibilityLoading] = useState(null);

  const handleToggleVisibility = async (exam) => {
    setVisibilityLoading(exam._id);
    try {
      const res = await fetch(`/api/teacher/exams/${exam._id}/results-visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showResults: !exam.showResults })
      });
      const data = await res.json();
      if (res.ok) {
        fetchExams();
      } else {
        alert(data.error || 'Gagal mengubah visibilitas nilai.');
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setVisibilityLoading(null);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!selectedExam) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${selectedExam._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchExams();
        setIsDeleteOpen(false);
      } else {
        alert(data.error || 'Gagal menghapus ujian.');
        setIsDeleteOpen(false);
      }
    } catch {
      alert('Koneksi ke server gagal.');
      setIsDeleteOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Bank Ujian</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.btnPrimary}
            onClick={() => router.push('/dashboard/teacher/exams/builder')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Buat Ujian Baru
          </button>
        </div>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Kelola ujian untuk siswa Anda. Ujian berstatus <strong>Draft</strong> hanya tersimpan dan tidak terlihat oleh siswa. 
          Klik <strong>Publikasi</strong> agar ujian dapat diakses siswa.
        </p>

        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat daftar ujian...
            </div>
          ) : exams.length === 0 ? (
            <div className={styles.emptyState}>Belum ada ujian. Klik "Buat Ujian Baru" untuk memulai.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Judul Ujian</th>
                  <th style={{ width: '20%' }}>Mata Pelajaran</th>
                  <th style={{ textAlign: 'center' }}>Soal</th>
                  <th style={{ textAlign: 'center' }}>Acak</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Akses Nilai</th>
                  <th style={{ width: '12%' }}>Tanggal</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{exam.title}</div>
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
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {exam.questions?.length || 0}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {exam.randomCount || exam.questions?.length || 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {exam.status === 'published' ? (
                        <span className={`${styles.badge} ${styles.statusActive}`}>Published</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.statusInactive}`}>Draft</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          onClick={() => handleToggleVisibility(exam)}
                          disabled={visibilityLoading === exam._id}
                          className={styles.iconBtn}
                          style={{
                            background: exam.showResults ? '#D1F0D9' : '#FDE0DD',
                            color: exam.showResults ? '#198754' : '#DC3545',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            width: 'auto',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            border: '1px solid ' + (exam.showResults ? '#A3E4B8' : '#FCA5A5'),
                            opacity: visibilityLoading === exam._id ? 0.6 : 1
                          }}
                        >
                          {visibilityLoading === exam._id ? '...' : exam.showResults ? 'Terlihat' : 'Tersembunyi'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>
                        {new Date(exam.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td>
                      <div className={styles.actionBtns} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                        {/* Monitor Results */}
                        <button
                          className={styles.iconBtn}
                          title="Pantau & Nilai Ujian"
                          onClick={() => router.push(`/dashboard/teacher/exams/${exam._id}/results`)}
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>

                        {/* Edit — only draft */}
                        {exam.status === 'draft' && (
                          <button
                            className={styles.iconBtn}
                            title="Edit Ujian"
                            onClick={() => router.push(`/dashboard/teacher/exams/builder?id=${exam._id}`)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}

                        {/* Publish / Unpublish */}
                        <button
                          className={styles.iconBtn}
                          title={exam.status === 'published' ? 'Tarik ke Draft' : 'Publikasi'}
                          onClick={() => handleTogglePublish(exam)}
                          disabled={publishLoading === exam._id}
                          style={exam.status === 'published'
                            ? { color: '#B45309' }
                            : { color: '#198754' }
                          }
                        >
                          {exam.status === 'published' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          title="Hapus Ujian"
                          onClick={() => { setSelectedExam(exam); setIsDeleteOpen(true); }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Ujian"
        message={`Anda yakin ingin menghapus ujian "${selectedExam?.title || ''}"? Tindakan ini akan menghapus ujian beserta seluruh sesi ujian siswa yang terkait dan tidak dapat dibatalkan.`}
        loading={deleteLoading}
      />
    </>
  );
}
