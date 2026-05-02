'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from '../../../../admin/admin.module.css'; 

export default function TeacherSubmissionPage({ params }) {
  const router = useRouter();
  
  // Unwrap parameters cleanly matching NextJS 15+ architectural requirements
  const resolvedParams = use(params);
  const assignmentId = resolvedParams.id;

  const [assignmentMeta, setAssignmentMeta] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Grading states natively
   const [gradingStudentId, setGradingStudentId] = useState(null);
   const [gradeInput, setGradeInput] = useState('');
   const [feedbackInput, setFeedbackInput] = useState('');
   const [gradeLoading, setGradeLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/submissions`);
      const data = await res.json();
      if (res.ok) {
        setAssignmentMeta(data.assignment);
        setStudents(data.students || []);
      } else {
        alert(data.error || 'Server menolak pelacakan submission.');
      }
    } catch (err) {
      console.error('Core Logic fail:', err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitGrade = async (studentId) => {
    if (gradeInput === '' || isNaN(gradeInput)) {
        alert('Format nilai harus diisi murni dengan angka bulat.');
        return;
    }
    
    setGradeLoading(true);
    try {
        const res = await fetch(`/api/teacher/assignments/${assignmentId}/submissions/${studentId}/grade`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                score: Number(gradeInput),
                feedback: feedbackInput
            })
        });

        if (res.ok) {
            setGradingStudentId(null);
            setGradeInput('');
            setFeedbackInput('');
            fetchData();
        } else {
            const data = await res.json();
            alert(data.error || 'Eksekusi mutasi gagal, data tak simetri.');
        }
    } catch (e) {
        alert('Koneksi terputus saat meramban database.');
    } finally {
        setGradeLoading(false);
    }
  };

  const handleDownloadAllSelected = (filesArray) => {
      // Loop map rendering physical anchors dynamically and chaining DOM clicks securely natively
      filesArray.forEach(file => {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = file.url;
          a.download = file.originalName || file.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      });
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.subPageHeaderCol}>
           <h1 className={`${styles.pageTitle} ${styles.pageTitleRow}`}>
             <button onClick={() => router.push('/dashboard/teacher/assignments')} className={styles.btnBack}>
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.btnBackIcon}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             </button>
             Monitor Evaluasi Penugasan
           </h1>
           {assignmentMeta && (
               <div className={styles.subPageMeta}>
                   Tugas: {assignmentMeta.text?.substring(0, 40)}... | Kelas: <span className={styles.subPageMetaAccent}>{assignmentMeta.subjectDetails?.classCode}</span>
               </div>
           )}
        </div>
      </div>

      <div className={styles.submissionStatsRow}>
        <div className={styles.submissionStatCol}>
            <span className={styles.submissionStatLabel}>Aturan Batas Waktu Terkunci:</span>
            <StatusBadge variant={assignmentMeta?.deadline ? 'danger' : 'success'}>
                {assignmentMeta?.deadline ? new Date(assignmentMeta.deadline).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : 'Tidak Berbatas Ruang / Infinity'}
            </StatusBadge>
        </div>
        <div className={`${styles.submissionStatCol} ${styles.submissionStatColBorder}`}>
            <span className={styles.submissionStatLabel}>Terkumpul (Aktivasi Rasio):</span>
            <strong className={styles.submissionStatValue}>
                {students.filter(s => s.submission).length} / {students.length} Siswa
            </strong>
        </div>
      </div>

      <ContentCard>
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div> 
               Mengenkripsi Saluran File Siswa...
             </div>
          ) : students.length === 0 ? (
            <EmptyState
              title="Tidak Ada Siswa"
              description="Lokus Array Siswa Kosong. Tidak ada siswa di kelas mapping ini."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Pernyataan / File Terlampir</th>
                  <th>Keterangan / Tenggat</th>
                  <th className={styles.thCenter}>Input Nilai Otentik</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const sub = student.submission;
                  const isGrading = gradingStudentId === student.studentId;

                  return (
                      <tr key={student._id}>
                        <td data-label="Siswa">
                          <div className={styles.userName}>{student.name || 'Nama Tidak Tersedia'}</div>
                          <div className={styles.subIdChip}>[{student.studentId}]</div>
                        </td>
                        <td data-label="Jawaban / File">
                          {sub ? (
                              <div className={styles.submissionContent}>
                                 {sub.text && (
                                     <div className={styles.submissionTextBox}>
                                         {sub.text}
                                     </div>
                                 )}
                                 
                                 {sub.files && sub.files.length > 0 && (
                                      <div className={styles.submissionFileSection}>
                                        <div className={styles.submissionFileHeader}>
                                             <span className={styles.submissionFileLabel}>Lampiran File ({sub.files.length})</span>
                                             <button 
                                                onClick={() => handleDownloadAllSelected(sub.files)} 
                                                className={styles.downloadAllBtn}
                                             >
                                                Unduh Semua 👇
                                             </button>
                                        </div>
                                        <div className={styles.fileChipList}>
                                            {sub.files.map((fl, x) => (
                                                <a key={x} href={fl.url} target="_blank" rel="noopener noreferrer" className={styles.fileChipSuccess}>
                                                    <span>📎</span>
                                                    <span className={styles.fileChipName}>{fl.originalName}</span>
                                                </a>
                                            ))}
                                        </div>
                                     </div>
                                 )}
                              </div>
                          ) : (
                             <span className={styles.noDataText}>Belum Mengerjakan</span>
                          )}
                        </td>
                        <td data-label="Keterangan">
                           {sub ? (
                               <div className={styles.submissionMeta}>
                                  <span className={styles.submissionMetaBold}>Dikumpulkan:</span>
                                  <span className={styles.cellSecondary}>{new Date(sub.submittedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                  {sub.isLate && (
                                      <StatusBadge variant="danger">Terlambat</StatusBadge>
                                  )}
                               </div>
                           ) : (
                               <span>-</span>
                           )}
                        </td>
                        <td data-label="Nilai" className={styles.tdCenter}>
                            {sub ? (
                                isGrading ? (
                                    <div className={styles.gradingInlineBox}>
                                        <input 
                                            type="number" 
                                            value={gradeInput}
                                            onChange={e => setGradeInput(e.target.value)}
                                            className={styles.gradingInlineInput}
                                            placeholder="0-100"
                                            autoFocus
                                        />
                                        <textarea 
                                            value={feedbackInput}
                                            onChange={e => setFeedbackInput(e.target.value)}
                                            placeholder="Catatan / Feedback Guru (Opsional)"
                                            className={styles.gradingInlineTextarea}
                                        />
                                        <div className={styles.gradingInlineActions}>
                                            <button onClick={() => setGradingStudentId(null)} disabled={gradeLoading} className={styles.gradingInlineBtnCancel}>Batal</button>
                                            <button onClick={() => submitGrade(student.studentId)} disabled={gradeLoading} className={styles.gradingInlineBtnSave}>Simpan</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.gradingResultCol}>
                                        {sub.score !== undefined && sub.score !== null ? (
                                            <div className={styles.scoreBadgeLarge}>
                                                {sub.score} <span className={styles.scoreBadgeSuffix}>/ 100</span>
                                            </div>
                                        ) : (
                                            <span className={styles.noDataText}>Belum Dinilai</span>
                                        )}
                                        {sub.feedback && (
                                            <div className={styles.gradingFeedbackText}>
                                                &quot;{sub.feedback}&quot;
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => { 
                                                setGradingStudentId(student.studentId); 
                                                setGradeInput(sub.score || ''); 
                                                setFeedbackInput(sub.feedback || '');
                                            }}
                                            className={styles.gradingEditLink}
                                        >
                                            Ubah / Setel Nilai
                                        </button>
                                    </div>
                                )
                            ) : (
                                <span className={styles.cellSecondary}>-</span>
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
