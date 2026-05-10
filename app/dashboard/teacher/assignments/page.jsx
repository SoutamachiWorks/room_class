'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { uploadWithProgress } from '@/lib/xhrUpload';
import { ACCEPT_STR, validateFiles } from '@/lib/fileValidation';
import styles from '../../admin/admin.module.css';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function AssignmentPage() {
  const isMobile = useIsMobile(640);
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
  const [uploadProgress, setUploadProgress] = useState(0);

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
    setUploadProgress(0);
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
      // 50MB constraint threshold mapping explicitly
      const MAX_SIZE = 50 * 1024 * 1024;
      let totalSize = 0;
      for (const obj of attachedFiles) totalSize += obj.size;
      
      if (totalSize > MAX_SIZE) {
         setFormError('Sistem menolak muatan disk! Ukuran lampiran tugas Anda lebih besar dari 50 MB.');
         setFormLoading(false);
         return;
      }

      const formData = new FormData();
      formData.append('text', formText);
      if (formDeadline) {
        formData.append('deadline', formDeadline);
      }

      if (!isEdit) {
        formData.append('subjectId', formSubjectId);
      } else {
        const keepArray = retainedOldFiles.map(f => f.fileKey || f.filename);
        formData.append('retainedFiles', JSON.stringify(keepArray));
      }

      for (const fileItem of attachedFiles) {
        formData.append('files', fileItem);
      }

      const url = isEdit ? `/api/teacher/assignments/${selectedAssignment._id}` : '/api/teacher/assignments';
      const method = isEdit ? 'PUT' : 'POST';

      setUploadProgress(0);
      const data = await uploadWithProgress(url, formData, method, (val) => {
         setUploadProgress(val);
      });

      fetchAssignments();
      handleCloseForm();
    } catch (err) {
      setFormError(err.message || 'Sinyal kompilasi API terpanggang timeout.');
    } finally {
      setFormLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!selectedAssignment) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/teacher/assignments/${selectedAssignment._id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
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
      <PageHeader title="Penugasan / Assignments Dashboard" subtitle="Modul Penugasan mendistribusikan kewajiban fungsional pada Siswa di lingkungan parametrik spesifik.">
        <button className={styles.btnPrimary} onClick={() => handleOpenForm()} disabled={!dependenciesLoaded}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
          Publikasi Tugas Baru
        </button>
      </PageHeader>

      <ContentCard>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Mengintegrasikan Relasional Kompilasi...
            </div>
          ) : assignments.length === 0 ? (
            <EmptyState
              title="Belum Ada Tugas"
              description="Konfigurasi Bebas Hambatan. Belum ada Tugas termodul terpublish di akun Guru Anda."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Penanda Waktu</th>
                  <th>Pemetaan Ruang Kelas</th>
                  <th>Ketentuan Misi/Tugas</th>
                  <th>Sumber Fisik Guru</th>
                  <th className={styles.thCenter}>Operasional</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asm) => (
                  <tr key={asm._id}>
                    <td data-label="Tanggal">
                      <div className={styles.cellBold}>{new Date(asm.createdAt).toLocaleDateString('id-ID')}</div>
                      <div className={styles.cellSecondary}>{new Date(asm.createdAt).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td data-label="Mapel / Kelas">
                      <div className={styles.cellAccent}>{asm.subjectDetails?.subjectName || 'Subjek FailSync'}</div>
                      <div className={styles.cellChipWrap}>
                        <StatusBadge variant="student">{asm.subjectDetails?.classCode || 'NO-REF'}</StatusBadge>
                      </div>
                      <div className={styles.deadlineText}>
                        {asm.deadline ? `Batas Akhir: ${new Date(asm.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Tidak Ada Batas Waktu'}
                      </div>
                    </td>
                    <td data-label="Instruksi">
                      <div className={styles.descriptionPreview}>{asm.text}</div>
                    </td>
                    <td data-label="File Lampiran">
                      <div className={styles.fileChipList}>
                        {(asm.files || []).map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className={styles.fileChipWarm} title={f.originalName}>
                            <span>📑</span>
                            <span className={styles.fileChipLabel}>{f.originalName}</span>
                          </a>
                        ))}
                        {(!asm.files || asm.files.length === 0) && <span className={styles.cellSecondary}>-</span>}
                      </div>
                    </td>
                    <td data-label="Aksi" className={styles.tdCenter}>
                      <div className={`${styles.actionBtns} ${styles.actionBtnsCenter}`}>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnView}`}
                          onClick={() => window.location.href = `/dashboard/teacher/assignments/${asm._id}/submissions`}
                          title="Pantau & Nilai Tugas"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        <button className={styles.iconBtn} onClick={() => handleOpenForm(asm)} title="Edit Tugas">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedAssignment(asm); setIsDeleteOpen(true); }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile card list */}
        {!loading && assignments.length > 0 && (
          <div className={styles.mobileAssignmentList}>
            {assignments.map((asm) => (
              <article key={`m-${asm._id}`} className={styles.mobileAssignmentCard}>
                <div className={styles.mobileAssignmentTop}>
                  <div>
                    <div className={styles.mobileAssignmentTitle}>{asm.subjectDetails?.subjectName || 'Subjek FailSync'}</div>
                    <div className={styles.mobileAssignmentSubject}>{asm.subjectDetails?.classCode || 'NO-REF'}</div>
                  </div>
                  <div className={styles.mobileAssignmentActions}>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnView}`}
                      onClick={() => window.location.href = `/dashboard/teacher/assignments/${asm._id}/submissions`}
                      title="Pantau & Nilai Tugas"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                    <button className={styles.iconBtn} onClick={() => handleOpenForm(asm)} title="Edit Tugas">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedAssignment(asm); setIsDeleteOpen(true); }} title="Hapus">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                    </button>
                  </div>
                </div>
                <div className={styles.mobileAssignmentMeta}>
                  <StatusBadge variant="student">{asm.subjectDetails?.classCode || 'NO-REF'}</StatusBadge>
                  <span className={styles.mobileAssignmentDate}>{new Date(asm.createdAt).toLocaleDateString('id-ID')}</span>
                  {asm.deadline && (
                    <span className={styles.mobileAssignmentDeadline}>
                      Deadline: {new Date(asm.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </div>
                <div className={styles.mobileAssignmentDesc}>{(asm.text || '').substring(0, 80)}{(asm.text || '').length > 80 ? '...' : ''}</div>
                {(asm.files || []).length > 0 && (
                  <div className={styles.fileChipList}>
                    {asm.files.slice(0, 2).map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className={styles.fileChipWarm} title={f.originalName}>
                        <span>📑</span>
                        <span className={styles.fileChipLabel}>{f.originalName}</span>
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </ContentCard>

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
              <label className={styles.fieldLabel}>Mata Pelajaran*</label>
              <select
                name="subjectId"
                value={formSubjectId}
                onChange={handleSubjectChange}
                className={`${styles.input} ${selectedAssignment ? styles.inputDisabled : styles.selectInput}`}
                required
                disabled={!!selectedAssignment}
              >
                <option value="" disabled>Pilih Subjek...</option>
                {teacherSubjects.map(sub => (
                  <option key={sub._id} value={sub._id}>{sub.subjectName}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Target Kelas</label>
              <input
                type="text"
                value={formClassCode ? `Terkunci: Kelas [${formClassCode}]` : 'Harap Setel Subjek'}
                disabled
                className={`${styles.input} ${styles.inputLocked}`}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Batas Waktu / Deadline (Opsional)</label>
            <input
              type="datetime-local"
              value={formDeadline}
              onChange={e => setFormDeadline(e.target.value)}
              className={styles.input}
            />
            <span className={styles.fieldHint}>
              Jika dibiarkan kosong, maka tugas ini tidak memiliki batas waktu.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Instruksi Pengerjaan (Teks / Soal / Perintah)*</label>
            <textarea
              value={formText}
              onChange={e => setFormText(e.target.value)}
              className={`${styles.input} ${styles.textarea}`}
              required
              placeholder="Cth: Kerjakan LKS halaman 24. Bagi siswa daring harap unggah file PDF..."
            />
          </div>

          {/* Native Form-Data File Handlers */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Lampirkan File Guru Pendukung Teks (Opsional Secara Teknis - Format Berkemajemukan)</label>
            <input
              type="file"
              multiple
              accept={ACCEPT_STR}
              ref={fileInputRef}
              className={styles.fileInput}
              onChange={(e) => {
                const newFiles = Array.from(e.target.files);
                const validation = validateFiles(newFiles);
                
                if (!validation.valid) {
                  alert(`Kesalahan Upload:\n${validation.errors.join('\n')}\n\nPastikan format file sesuai dan ukuran maksimal 50MB per file.`);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  return;
                }

                setAttachedFiles(prev => [...prev, ...newFiles]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />

            <div className={styles.filePreviewList}>
              {retainedOldFiles.map((prevFl) => (
                <div key={prevFl.filename} className={`${styles.filePreviewItem} ${styles.filePreviewRetained}`}>
                  <span>📑 {prevFl.originalName} (Lawas)</span>
                  <button type="button" onClick={() => removeRetainedFile(prevFl.filename)} className={styles.fileRemoveBtn}>Hapus</button>
                </div>
              ))}

              {attachedFiles.map((fl, idx) => (
                <div key={idx} className={`${styles.filePreviewItem} ${styles.filePreviewNew}`}>
                  <span>📝 {fl.name} (Baru Disematkan)</span>
                  <button type="button" onClick={() => removeAttachedFile(idx)} className={styles.fileRemoveBtn}>Batalkan</button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            {formLoading && uploadProgress > 0 && <span className={styles.uploadProgressText}>Mengunggah... {uploadProgress}%</span>}
            <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batalkan Opsi</button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Merekatkan...' : 'Publish Penugasan'}
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
