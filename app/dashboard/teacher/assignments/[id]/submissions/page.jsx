'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
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
            body: JSON.stringify({ score: Number(gradeInput) })
        });

        if (res.ok) {
            setGradingStudentId(null);
            setGradeInput('');
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <h1 className={styles.pageTitle} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <button onClick={() => router.push('/dashboard/teacher/assignments')} className={styles.iconBtn} style={{ background: 'var(--bg-card)', color: 'var(--color-heading)', border: '1px solid var(--color-border)' }}>
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             </button>
             Monitor Evaluasi Penugasan
           </h1>
           {assignmentMeta && (
               <div style={{ fontSize: '0.875rem', color: 'var(--color-subtext)', fontWeight: 600 }}>
                   Tugas: {assignmentMeta.text?.substring(0, 40)}... | Kelas: <span style={{ color: 'var(--color-primary)' }}>{assignmentMeta.subjectDetails?.classCode}</span>
               </div>
           )}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', background: 'transparent' }}>
            <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext)', display: 'block', marginBottom: '8px' }}>Aturan Batas Waktu Terkunci:</span>
                <span className={`${styles.badge} ${assignmentMeta?.deadline ? styles.statusInactive : styles.statusActive}`}>
                    {assignmentMeta?.deadline ? new Date(assignmentMeta.deadline).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : 'Tidak Berbatas Ruang / Infinity'}
                </span>
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid var(--color-border)', paddingLeft: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext)', display: 'block', marginBottom: '8px' }}>Terkumpul (Aktivasi Rasio):</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--color-heading)' }}>
                    {students.filter(s => s.submission).length} / {students.length} Siswa
                </strong>
            </div>
        </div>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div> 
               Mengenkripsi Saluran File Siswa...
             </div>
          ) : students.length === 0 ? (
            <div className={styles.emptyState}>Lokus Array Siswa Kosong. Tidak ada siswa di kelas mapping ini.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Siswa</th>
                  <th style={{ width: '40%' }}>Pernyataan / File Terlampir</th>
                  <th>Keterangan / Tenggat</th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Input Nilai Otentik</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const sub = student.submission;
                  const isGrading = gradingStudentId === student.studentId;

                  return (
                      <tr key={student._id}>
                        <td data-label="Siswa">
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{student.name || 'Nama Tidak Tersedia'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: '4px' }}>[{student.studentId}]</div>
                        </td>
                        <td data-label="Jawaban / File">
                          {sub ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                 {sub.text && (
                                     <div style={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap', background: 'var(--bg-input)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                         {sub.text}
                                     </div>
                                 )}
                                 
                                 {sub.files && sub.files.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                             <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext)' }}>Lampiran File ({sub.files.length})</span>
                                             <button 
                                                onClick={() => handleDownloadAllSelected(sub.files)} 
                                                style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                             >
                                                Unduh Semua 👇
                                             </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {sub.files.map((fl, x) => (
                                                <a key={x} href={fl.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--color-success)', textDecoration: 'none', fontSize: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>📎</span>
                                                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fl.originalName}</span>
                                                </a>
                                            ))}
                                        </div>
                                     </div>
                                 )}
                              </div>
                          ) : (
                             <span style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)', fontStyle: 'italic' }}>Belum Mengerjakan</span>
                          )}
                        </td>
                        <td data-label="Keterangan">
                           {sub ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Dikumpulkan:</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)' }}>{new Date(sub.submittedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                  {sub.isLate && (
                                      <span style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600, display: 'inline-block', marginTop: '4px', alignSelf: 'flex-start' }}>Terlambat</span>
                                  )}
                               </div>
                           ) : (
                               <span>-</span>
                           )}
                        </td>
                        <td data-label="Nilai">
                            {sub ? (
                                isGrading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                        <input 
                                            type="number" 
                                            value={gradeInput}
                                            onChange={e => setGradeInput(e.target.value)}
                                            style={{ width: '100%', padding: '8px', border: '2px solid var(--color-primary)', borderRadius: '6px', textAlign: 'center', fontWeight: 700, fontSize: '1rem', background: 'var(--bg-input)', color: 'var(--color-text)' }}
                                            placeholder="0-100"
                                            autoFocus
                                        />
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            <button onClick={() => setGradingStudentId(null)} disabled={gradeLoading} style={{ flex: 1, padding: '6px', background: 'var(--bg-app)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}>Batal</button>
                                            <button onClick={() => submitGrade(student.studentId)} disabled={gradeLoading} style={{ flex: 1, padding: '6px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', minHeight: '44px' }}>Simpan</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        {sub.score !== undefined && sub.score !== null ? (
                                            <div style={{ padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: '8px', fontWeight: 800, fontSize: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                {sub.score} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)' }}>/ 100</span>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', fontStyle: 'italic' }}>Belum Dinilai</span>
                                        )}
                                        <button 
                                            onClick={() => { setGradingStudentId(student.studentId); setGradeInput(sub.score || ''); }}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', minHeight: '44px' }}
                                        >
                                            Ubah / Setel Nilai
                                        </button>
                                    </div>
                                )
                            ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)' }}>-</span>
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
