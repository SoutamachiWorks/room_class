'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../../admin/admin.module.css'; // Utilizing central styles inherently isolating dependencies cleanly

export default function AssignmentPage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dropdown Dependencies safely isolating scopes locally
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // Modals state natively orchestrating arrays safely via DOM mappings
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Form State Configurations -> native FormData extraction
  const [formText, setFormText] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formClassCode, setFormClassCode] = useState(''); 
  const [formDeadline, setFormDeadline] = useState('');
  
  // File Arrays tracking
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [retainedOldFiles, setRetainedOldFiles] = useState([]);
  const fileInputRef = useRef(null);

  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Initializing the Subject arrays fetching data inherently limiting the mapping natively
  useEffect(() => {
    async function loadDependencies() {
      try {
        const subjectsRes = await fetch('/api/teacher/subjects');
        const subjectsData = await subjectsRes.json();
        if (subjectsRes.ok) setTeacherSubjects(subjectsData.subjects || []);
        setDependenciesLoaded(true);
      } catch (e) {
        console.error('Fetch Dep Fault:', e);
      }
    }
    loadDependencies();
  }, []);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/assignments`);
      const data = await res.json();
      if (res.ok) setAssignments(data.assignments);
    } catch (err) {
      console.error('Core Logic fail:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSubjectChange = (e) => {
    const sId = e.target.value;
    setFormSubjectId(sId);
    
    // Auto-locking mechanisms
    const targetSub = teacherSubjects.find(sub => sub._id === sId);
    if (targetSub) {
       setFormClassCode(targetSub.classCode);
    } else {
       setFormClassCode('');
    }
  };


  const handleOpenForm = (existingConfig = null) => {
    setSelectedAssignment(existingConfig);
    setFormError('');

    if (existingConfig) {
      setFormText(existingConfig.text || '');
      setFormSubjectId(existingConfig.subjectId || '');
      
      const targetSub = teacherSubjects.find(sub => sub._id === existingConfig.subjectId);
      setFormClassCode(targetSub ? targetSub.classCode : existingConfig.subjectDetails?.classCode || '');

      setFormDeadline(existingConfig.deadline ? new Date(existingConfig.deadline).toISOString().slice(0, 16) : '');

      setRetainedOldFiles(existingConfig.files || []);
      setAttachedFiles([]);
    } else {
      setFormText('');
      setFormSubjectId('');
      setFormClassCode('');
      setFormDeadline('');
      setRetainedOldFiles([]);
      setAttachedFiles([]);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedAssignment(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = !!selectedAssignment;

    if (!formSubjectId || !formText) {
      setFormError('Sistem mendeteksi array rincian batas relasi kosong. Harap lengkapi.');
      setFormLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('text', formText);
      if (formDeadline) {
         formData.append('deadline', formDeadline);
      }
      
      if (!isEdit) {
         formData.append('subjectId', formSubjectId);
      } else {
         const keepArray = retainedOldFiles.map(f => f.filename);
         formData.append('retainedFiles', JSON.stringify(keepArray));
      }

      for (const fileItem of attachedFiles) {
         formData.append('files', fileItem);
      }

      const url = isEdit ? `/api/teacher/assignments/${selectedAssignment._id}` : '/api/teacher/assignments';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData, 
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Galat kompilasi server logis.');
      } else {
        fetchAssignments();
        handleCloseForm();
      }
    } catch (err) {
      setFormError('Sinyal kompilasi API terpanggang timeout.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAssignment) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/teacher/assignments/${selectedAssignment._id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (res.ok) {
        // We notify the teacher how many dependent student arrays got natively executed
        const cascadeCount = data.cascadesTriggered || 0;
        if (cascadeCount > 0) {
           alert(`Pemusnahan Mutlak Tereksekusi.\nData root guru dihapus & [${cascadeCount}] file submission milik murid secara fisik turut dihapus permanen!`);
        }
        fetchAssignments();
        setIsDeleteOpen(false);
      } else {
        alert(data.error || 'Struktural penghapusan relasional dibatalkan secara tak lazim.');
        setIsDeleteOpen(false);
      }
    } catch (err) {
      alert('Kegagalan Konektif File Disk System.');
      setIsDeleteOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  const removeRetainedFile = (fileName) => {
      setRetainedOldFiles(prev => prev.filter(f => f.filename !== fileName));
  };
  
  const removeAttachedFile = (idx) => {
      setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };


  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Penugasan / Assignments Dashboard</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => handleOpenForm()} disabled={!dependenciesLoaded}>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
             </svg>
            Publikasi Tugas Baru
          </button>
        </div>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
           Modul Penugasan mendistribusikan kewajiban fungsional pada Siswa di lingkungan parametrik spesifik. Submission Data siswa yang menempel langsung akan ikut dihancurkan jika modul ditarik paksa.
        </p>
        
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div> 
               Mengintegrasikan Relasional Kompilasi...
             </div>
          ) : assignments.length === 0 ? (
            <div className={styles.emptyState}>Konfigurasi Bebas Hambatan. Belum ada Tugas termodul terpublish di akun Guru Anda.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Penanda Waktu</th>
                  <th style={{ width: '25%' }}>Pemetaan Ruang Kelas</th>
                  <th style={{ width: '35%' }}>Ketentuan Misi/Tugas</th>
                  <th>Sumber Fisik Guru</th>
                  <th style={{ textAlign: 'center' }}>Operasional</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asm) => (
                  <tr key={asm._id}>
                    <td>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{new Date(asm.createdAt).toLocaleDateString('id-ID')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{new Date(asm.createdAt).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{asm.subjectDetails?.subjectName || 'Subjek FailSync'}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                         <span className={`${styles.badge} ${styles.badgeStudent}`}>{asm.subjectDetails?.classCode || 'NO-REF'}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '6px', color: '#DC2626', fontWeight: 600 }}>
                         {asm.deadline ? `Batas Akhir: ${new Date(asm.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Tidak Ada Batas Waktu'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto' }}>
                         {asm.text}
                      </div>
                    </td>
                    <td>
                       <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(asm.files || []).map((f, i) => (
                             <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: '4px 8px', background: '#FEF3C7', borderRadius: '4px', fontSize: '0.6875rem', color: '#92400E', textDecoration: 'none', border: '1px solid #FDE68A' }}>
                                📑 {f.originalName}
                             </a>
                          ))}
                          {(!asm.files || asm.files.length === 0) && <span style={{fontSize: '0.75rem', color: '#9CA3AF'}}>-</span>}
                       </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                          <button 
                             className={styles.iconBtn} 
                             onClick={() => window.location.href = `/dashboard/teacher/assignments/${asm._id}/submissions`}
                             title="Pantau & Nilai Tugas"
                             style={{ color: '#4F46E5', background: '#E0E7FF' }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button className={styles.iconBtn} onClick={() => handleOpenForm(asm)} title="Edit Tugas">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedAssignment(asm); setIsDeleteOpen(true); }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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

      {/* Creation/Adjustment Modals */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={selectedAssignment ? 'Mutasi Ketentuan Penugasan Siswa' : 'Penetapan Penugasan Rutin Terisolasi'}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
           {formError && <div className={styles.formError}>{formError}</div>}

           <div className={styles.formRow}>
              <div className={styles.fieldGroup}>
                 <label className={styles.fieldLabel}>Integrasi Mata Pelajaran*</label>
                 <select 
                    name="subjectId" 
                    value={formSubjectId} 
                    onChange={handleSubjectChange} 
                    className={styles.input} 
                    required 
                    disabled={!!selectedAssignment} 
                    style={selectedAssignment ? { background: '#F3F4F6', color: '#9CA3AF' } : { appearance: 'auto' }}
                 >
                    <option value="" disabled>Pilih Subjek...</option>
                    {teacherSubjects.map(sub => (
                       <option key={sub._id} value={sub._id}>{sub.subjectName}</option>
                    ))}
                 </select>
              </div>

              <div className={styles.fieldGroup}>
                 <label className={styles.fieldLabel}>Logikal Routing Target Code</label>
                 <input 
                    type="text"
                    value={formClassCode ? `Terkunci: Kelas [${formClassCode}]` : 'Harap Setel Subjek'} 
                    disabled 
                    className={styles.input}
                    style={{ background: '#F3F4F6', fontWeight: 600, color: 'var(--color-primary)' }}
                 />
              </div>
           </div>

           <div className={styles.fieldGroup} style={{ marginBottom: '16px' }}>
              <label className={styles.fieldLabel}>Batas Waktu / Deadline (Opsional)</label>
              <input 
                 type="datetime-local" 
                 value={formDeadline} 
                 onChange={e => setFormDeadline(e.target.value)} 
                 className={styles.input} 
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', marginTop: '4px', display: 'block' }}>
                 Jika dibiarkan kosong, maka tugas ini tidak memiliki batas waktu.
              </span>
           </div>

           <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Instruksi Pengerjaan (Teks / Soal / Perintah)*</label>
              <textarea 
                 value={formText} 
                 onChange={e => setFormText(e.target.value)} 
                 className={styles.input} 
                 required 
                 style={{ height: '140px', paddingTop: '12px', resize: 'vertical' }}
                 placeholder="Cth: Kerjakan LKS halaman 24. Bagi siswa daring harap unggah file PDF..."
              />
           </div>

           {/* Native Form-Data File Handlers */}
           <div className={styles.fieldGroup} style={{ marginTop: '12px' }}>
              <label className={styles.fieldLabel}>Lampirkan File Guru Pendukung Teks (Opsional Secara Teknis - Format Berkemajemukan)</label>
              <input 
                 type="file" 
                 multiple 
                 ref={fileInputRef}
                 className={styles.input} 
                 style={{ paddingTop: '10px' }}
                 onChange={(e) => {
                    const newFiles = Array.from(e.target.files);
                    setAttachedFiles(prev => [...prev, ...newFiles]);
                    if (fileInputRef.current) fileInputRef.current.value = ""; 
                 }}
              />
              
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 
                 {retainedOldFiles.map((prevFl) => (
                    <div key={prevFl.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid #BBF7D0' }}>
                       <span>📑 {prevFl.originalName} (Lawas)</span>
                       <button type="button" onClick={() => removeRetainedFile(prevFl.filename)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Tarik/Hapus Disk</button>
                    </div>
                 ))}

                 {attachedFiles.map((fl, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEF3C7', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid #FDE68A' }}>
                       <span>📝 {fl.name} (Baru Disematkan)</span>
                       <button type="button" onClick={() => removeAttachedFile(idx)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Batalkan</button>
                    </div>
                 ))}

              </div>
           </div>

           <div className={styles.formActions} style={{ marginTop: '32px' }}>
              <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batalkan Opsi</button>
              <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
                 {formLoading ? 'Merekatkan Arus Sinkronisasi...' : 'Publish Penugasan'}
              </button>
           </div>
        </form>
      </Modal>

      {/* !!! HIGH ALERT CASCADING DELETE CONFIRMATION !!! */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="⚠️ PERINGATAN KRITIS: PEMUSNAHAN CASCADE"
        message={`Tindakan penghapusan Tugas ("${selectedAssignment?.text.substring(0, 30)}...") ini BERSIFAT PERMANEN DAN TIDAK BISA DIBATALKAN!\n\nSeluruh file lampiran tugas Anda, SERTA SELURUH FILE JAWABAN/PENGUMPULAN DARI SEMUA SISWA di database untuk tugas ini akan diledakkan dan lenyap selamanya dari hard drive server.\n\nApakah Anda benar-benar yakin ingin melanjutkan operasional destruksi fatal ini?`}
        loading={formLoading}
      />
    </>
  );
}
