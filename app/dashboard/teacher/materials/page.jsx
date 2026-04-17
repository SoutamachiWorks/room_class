'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../../admin/admin.module.css'; // Reusing central stylistic grids

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dropdown Subject Constraints
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // Form State Configurations -> FormData approach Native
  const [formText, setFormText] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formClassCode, setFormClassCode] = useState(''); // Read-only derived logically
  
  // File Array management (Native arrays)
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [retainedOldFiles, setRetainedOldFiles] = useState([]); // Used solely for PUT deletions
  const fileInputRef = useRef(null);

  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Initialization: Fetch Dependency Data & Primary Fetch Core
  useEffect(() => {
    async function loadFormDependencies() {
      try {
        const subjectsRes = await fetch('/api/teacher/subjects');
        const subjectsData = await subjectsRes.json();
        
        if (subjectsRes.ok) setTeacherSubjects(subjectsData.subjects || []);
        setDependenciesLoaded(true);
      } catch (e) {
        console.error('Dependency Fetch Failure:', e);
      }
    }
    loadFormDependencies();
  }, []);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/materials`);
      const data = await res.json();
      if (res.ok) setMaterials(data.materials);
    } catch (err) {
      console.error('Error fetching modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Handle Dropdown Subject Changing (Auto mapping Class Codes safely!)
  const handleSubjectChange = (e) => {
    const sId = e.target.value;
    setFormSubjectId(sId);
    
    // Reverse lookup to inject class code automatically into UI
    const targetSub = teacherSubjects.find(sub => sub._id === sId);
    if (targetSub) {
       setFormClassCode(targetSub.classCode);
    } else {
       setFormClassCode('');
    }
  };


  // Structural Modal Dispatches
  const handleOpenForm = (existingConfig = null) => {
    setSelectedMaterial(existingConfig);
    setFormError('');

    if (existingConfig) {
      setFormText(existingConfig.text || '');
      setFormSubjectId(existingConfig.subjectId || '');
      
      const targetSub = teacherSubjects.find(sub => sub._id === existingConfig.subjectId);
      setFormClassCode(targetSub ? targetSub.classCode : existingConfig.subjectDetails?.classCode || '');

      setRetainedOldFiles(existingConfig.files || []);
      setAttachedFiles([]); // Purge new intent files
    } else {
      setFormText('');
      setFormSubjectId('');
      setFormClassCode('');
      setRetainedOldFiles([]);
      setAttachedFiles([]);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedMaterial(null);
  };

  // Execution Protocol Leveraging Standard MultiPart Formatting APIs
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = !!selectedMaterial;

    if (!formSubjectId || !formText) {
      setFormError('Sistem mendeteksi array parameter Subjek / Deskripsi kosong. Lengkapi kolom.');
      setFormLoading(false);
      return;
    }

    try {
      // Construction of Multiparts Frameworks Payload
      const formData = new FormData();
      formData.append('text', formText);
      
      if (!isEdit) {
         // Subject IDs strictly lock defensively passing POST requests cleanly
         formData.append('subjectId', formSubjectId);
      } else {
         // Filter Array Names logic extracting files Teacher retained directly 
         const keepArray = retainedOldFiles.map(f => f.filename);
         formData.append('retainedFiles', JSON.stringify(keepArray));
      }

      // Appending all the Fresh Array files cleanly natively
      for (const fileItem of attachedFiles) {
         formData.append('files', fileItem);
      }

      const url = isEdit ? `/api/teacher/materials/${selectedMaterial._id}` : '/api/teacher/materials';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData, // Next.js intercepts 'multipart/form-data' content type inherently here organically.
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Terpotong saat kompilasi data transmisi Server.');
      } else {
        fetchMaterials();
        handleCloseForm();
      }
    } catch (err) {
      setFormError('Sinyal Payload Form Data gagal terlempar (Jaringan Error).');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMaterial) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/teacher/materials/${selectedMaterial._id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (res.ok) {
        fetchMaterials();
        setIsDeleteOpen(false);
      } else {
        alert(data.error || 'Pemotongan Struktur Physical Direktori Gagal.');
        setIsDeleteOpen(false);
      }
    } catch (err) {
      alert('Kegagalan Konektif System Penghapusan Disk File.');
      setIsDeleteOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  // Safe UI removal function over File Array Iterators directly isolating state
  const removeRetainedFile = (fileName) => {
      setRetainedOldFiles(prev => prev.filter(f => f.filename !== fileName));
  };
  
  const removeAttachedFile = (idx) => {
      setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };


  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Portal Distribusi Materi</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => handleOpenForm()} disabled={!dependenciesLoaded}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Publikasi Modul Baru
          </button>
        </div>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
           Material Section ini mengikat secara esensial pada pengaturan Subjek. Materi yang Anda publish berstatus **LIVE** terbatas pada parameter kode kelas spesifik siswa.
        </p>
        
        {/* Dynamic Display Arrays */}
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div> 
               Mengenkripsi Direktori Server...
             </div>
          ) : materials.length === 0 ? (
            <div className={styles.emptyState}>Modul masih steril. Belum ada materi terekam di sistem pangkalan Anda.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Penanda Waktu</th>
                  <th style={{ width: '25%' }}>Pemetaan Ruang Kelas</th>
                  <th style={{ width: '35%' }}>Deskripsi Modul</th>
                  <th>Berkas/File Fisik</th>
                  <th style={{ textAlign: 'center' }}>Operasional</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => (
                  <tr key={mat._id}>
                    <td>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{new Date(mat.createdAt).toLocaleDateString('id-ID')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{new Date(mat.createdAt).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{mat.subjectDetails?.subjectName || 'Subjek Sinkronisasi Fail'}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                         <span className={`${styles.badge} ${styles.badgeStudent}`}>{mat.subjectDetails?.classCode || 'NO-REF-CODE'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto' }}>
                         {mat.text}
                      </div>
                    </td>
                    <td>
                       <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {(mat.files || []).map((f, i) => (
                             <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: '4px 8px', background: '#F3F4F6', borderRadius: '4px', fontSize: '0.6875rem', color: '#4B5563', textDecoration: 'none', border: '1px solid #E5E7EB' }}>
                                📎 {f.originalName}
                             </a>
                          ))}
                          {(!mat.files || mat.files.length === 0) && <span style={{fontSize: '0.75rem', color: '#9CA3AF'}}>-</span>}
                       </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                          <button className={styles.iconBtn} onClick={() => handleOpenForm(mat)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedMaterial(mat); setIsDeleteOpen(true); }}>
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

      {/* Creation/Adjustment Modals leveraging File Arrays */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={selectedMaterial ? 'Injeksi / Mutasi Parametrik Modul' : 'Distribusi Berkas Fisik Kelas'}
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
                    disabled={!!selectedMaterial} // Block subject swapping safely natively maintaining sync
                    style={selectedMaterial ? { background: '#F3F4F6', color: '#9CA3AF' } : { appearance: 'auto' }}
                 >
                    <option value="" disabled>Pilih Subjek Anda...</option>
                    {teacherSubjects.map(sub => (
                       <option key={sub._id} value={sub._id}>{sub.subjectName}</option>
                    ))}
                 </select>
              </div>

              <div className={styles.fieldGroup}>
                 <label className={styles.fieldLabel}>Mapping Kode Kelas Tertutup</label>
                 <input 
                    type="text"
                    value={formClassCode ? `Terkunci: Kelas [${formClassCode}]` : 'Harap Setel Subjek'} 
                    disabled 
                    className={styles.input}
                    style={{ background: '#F3F4F6', fontWeight: 600, color: 'var(--color-primary)' }}
                 />
              </div>
           </div>

           <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Deskripsi / Konten (Text)*</label>
              <textarea 
                 value={formText} 
                 onChange={e => setFormText(e.target.value)} 
                 className={styles.input} 
                 required 
                 style={{ height: '140px', paddingTop: '12px', resize: 'vertical' }}
                 placeholder="Tuliskan petunjuk kompetensi dasar materi disini..."
              />
           </div>

           {/* Native Form-Data File Handlers */}
           <div className={styles.fieldGroup} style={{ marginTop: '12px' }}>
              <label className={styles.fieldLabel}>Tambah / Lampirkan Berkas Fs (Multiple File Select)</label>
              <input 
                 type="file" 
                 multiple 
                 ref={fileInputRef}
                 className={styles.input} 
                 style={{ paddingTop: '10px' }}
                 onChange={(e) => {
                    const newFiles = Array.from(e.target.files);
                    setAttachedFiles(prev => [...prev, ...newFiles]);
                    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear active input visual
                 }}
              />
              
              {/* Box mapping Arrays visualizing exactly what we retain logically */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 
                 {retainedOldFiles.map((prevFl) => (
                    <div key={prevFl.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid #BBF7D0' }}>
                       <span>📎 {prevFl.originalName} (Lawas)</span>
                       <button type="button" onClick={() => removeRetainedFile(prevFl.filename)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Tarik/Hapus Disk</button>
                    </div>
                 ))}

                 {attachedFiles.map((fl, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid #BFDBFE' }}>
                       <span>📄 {fl.name} (Baru Disematkan)</span>
                       <button type="button" onClick={() => removeAttachedFile(idx)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Batalkan</button>
                    </div>
                 ))}

              </div>
           </div>

           <div className={styles.formActions} style={{ marginTop: '32px' }}>
              <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Tarik Sinyal</button>
              <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
                 {formLoading ? 'Mengkompresi Alur Array Berkas...' : 'Publikasi Jaringan'}
              </button>
           </div>
        </form>
      </Modal>

      {/* Amputation Disk Clearance Constraints */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Pembakaran Berkas Fisik Disk"
        message={`Penghapusan file menginstruksikan modul NodeJS men-detach "File Fs" sepenuhnya dari penyimpanan sistem pusat public/uploads/materials! Apakah Anda memvalidasi tindakan irreversibel ini?`}
        loading={formLoading}
      />
    </>
  );
}
