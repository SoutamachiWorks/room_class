'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './archiveDetail.module.css';

export default function ArchiveDetailPage() {
  const { yearId } = useParams();
  const [activeTab, setActiveTab] = useState('materials');
  const [data, setData] = useState({ materials: [], assignments: [], exams: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearInfo, setYearInfo] = useState(null);

  useEffect(() => {
    async function fetchArchiveData() {
      try {
        setLoading(true);
        const [matRes, assRes, exRes] = await Promise.all([
          fetch(`/api/student/materials?yearId=${yearId}`),
          fetch(`/api/student/assignments?yearId=${yearId}`),
          fetch(`/api/student/exams?yearId=${yearId}`),
        ]);

        if (!matRes.ok) throw new Error('Gagal memuat materi');
        if (!assRes.ok) throw new Error('Gagal memuat tugas');
        if (!exRes.ok) throw new Error('Gagal memuat ujian');

        const matData = await matRes.json();
        const assData = await assRes.json();
        const exData = await exRes.json();

        setData({
          materials: matData.materials || [],
          assignments: assData.assignments || [],
          exams: exData.exams || [],
        });

        // Extract year info from any response since they all return enrolledYears
        if (matData.enrolledYears) {
          const info = matData.enrolledYears.find(y => y.yearId === yearId);
          if (info) setYearInfo(info);
        }
      } catch (err) {
        console.error('Error fetching archive details:', err);
        setError('Gagal memuat data arsip. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    }

    if (yearId) {
      fetchArchiveData();
    }
  }, [yearId]);

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className="spinner" aria-hidden="true" />
        <p>Memuat detail arsip...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBanner}>{error}</div>
        <Link href="/dashboard/student/archive" className={styles.backBtn}>
          &larr; Kembali ke Riwayat
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <Link href="/dashboard/student/archive" className={styles.backBtn}>
          &larr; Kembali ke Riwayat Belajar
        </Link>
        <h1 className={styles.title}>
          Detail Arsip: {yearInfo ? (yearInfo.label || yearInfo.academicYear || yearId) : yearId}
        </h1>
        {yearInfo && (
           <p className={styles.subtitle}>Kelas: {yearInfo.classCode}</p>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'materials' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          Materi ({data.materials.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'assignments' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          Tugas & Nilai ({data.assignments.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'exams' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('exams')}
        >
          Hasil Ujian ({data.exams.length})
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className={styles.tabContent}>
        
        {/* MATERIALS TAB */}
        {activeTab === 'materials' && (
          <div className={styles.grid}>
            {data.materials.length === 0 ? (
              <p className={styles.emptyText}>Tidak ada materi di arsip ini.</p>
            ) : (
              data.materials.map(mat => (
                <div key={mat._id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.subjectTag}>{mat.subjectDetails?.name || 'Mata Pelajaran'}</span>
                    <span className={styles.dateText}>{new Date(mat.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                  <h3 className={styles.cardTitle}>{mat.title}</h3>
                  <p className={styles.cardDesc}>{mat.description}</p>
                  {mat.files && mat.files.length > 0 && (
                    <div className={styles.fileList}>
                      {mat.files.map((file, idx) => (
                        <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                          Unduh File {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <div className={styles.grid}>
            {data.assignments.length === 0 ? (
              <p className={styles.emptyText}>Tidak ada tugas di arsip ini.</p>
            ) : (
              data.assignments.map(ass => {
                 const hasSubmission = !!ass.submission;
                 const score = ass.submission?.score;
                 return (
                  <div key={ass._id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.subjectTag}>{ass.subjectDetails?.name || 'Tugas'}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{ass.title}</h3>
                    
                    <div className={styles.submissionStatus}>
                       Status: {hasSubmission ? 'Sudah Mengumpulkan' : 'Tidak Mengumpulkan'}
                    </div>
                    {hasSubmission && (
                       <div className={styles.scoreBox}>
                         Nilai: <strong>{score !== undefined && score !== null ? score : 'Belum Dinilai'}</strong>
                       </div>
                    )}
                    {ass.submission?.teacherComment && (
                       <div className={styles.commentBox}>
                          <strong>Komentar Guru:</strong> {ass.submission.teacherComment}
                       </div>
                    )}
                    <div className={styles.warningText}>* File unggahan mungkin sudah dihapus dari server.</div>
                  </div>
                 );
              })
            )}
          </div>
        )}

        {/* EXAMS TAB */}
        {activeTab === 'exams' && (
          <div className={styles.grid}>
            {data.exams.length === 0 ? (
              <p className={styles.emptyText}>Tidak ada ujian di arsip ini.</p>
            ) : (
              data.exams.map(ex => {
                 const hasSession = !!ex.session;
                 const score = ex.session?.calculatedScore;
                 return (
                  <div key={ex._id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.subjectTag}>{ex.subjectDetails?.name || 'Ujian'}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{ex.title}</h3>
                    <div className={styles.submissionStatus}>
                       Status: {hasSession ? (ex.session.status === 'finished' ? 'Selesai' : 'Belum Selesai') : 'Tidak Mengerjakan'}
                    </div>
                    {hasSession && ex.session.status === 'finished' && ex.showResults && (
                       <div className={styles.scoreBox}>
                         Skor: <strong>{score !== null ? score : 'Belum Dinilai'}</strong>
                       </div>
                    )}
                  </div>
                 );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
