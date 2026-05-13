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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function getClassCodes(source) {
  return Array.isArray(source?.classCodes) && source.classCodes.length
    ? source.classCodes
    : [source?.classCode].filter(Boolean);
}

function formatClassCodes(source) {
  const codes = getClassCodes(source);
  return codes.length ? codes.join(', ') : '-';
}

export default function MaterialsPage() {
  const isMobile = useIsMobile(640);
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
  const [formTitle, setFormTitle] = useState('');
  const [formText, setFormText] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formClassCodes, setFormClassCodes] = useState([]);

  // File Array management (Native arrays)
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [retainedOldFiles, setRetainedOldFiles] = useState([]);
  const fileInputRef = useRef(null);

  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const getFileListKey = (file, index, scope = 'file') =>
    [scope, file?.fileKey, file?.filename, file?.url, file?.originalName, index].filter(Boolean).join(':');

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
    queueMicrotask(() => {
      fetchMaterials();
    });
  }, [fetchMaterials]);

  // Handle Dropdown Subject Changing (Auto mapping Class Codes safely!)
  const handleSubjectChange = (e) => {
    const sId = e.target.value;
    setFormSubjectId(sId);

    // Reverse lookup to inject class code automatically into UI
    const targetSub = teacherSubjects.find(sub => sub._id === sId);
    if (targetSub) {
      setFormClassCodes(getClassCodes(targetSub));
    } else {
      setFormClassCodes([]);
    }
  };


  // Structural Modal Dispatches
  const handleOpenForm = (existingConfig = null) => {
    setSelectedMaterial(existingConfig);
    setFormError('');

    if (existingConfig) {
      setFormTitle(existingConfig.title || '');
      setFormText(existingConfig.text || '');
      setFormSubjectId(existingConfig.subjectId || '');

      const targetSub = teacherSubjects.find(sub => sub._id === existingConfig.subjectId);
      setFormClassCodes(targetSub ? getClassCodes(targetSub) : getClassCodes(existingConfig.subjectDetails));

      setRetainedOldFiles(existingConfig.files || []);
      setAttachedFiles([]);
    } else {
      setFormTitle('');
      setFormText('');
      setFormSubjectId('');
      setFormClassCodes([]);
      setRetainedOldFiles([]);
      setAttachedFiles([]);
    }
    setUploadProgress(0);
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
      // Validation: Total file sizes (New Incoming files only checked vs 50MB limit)
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
      let totalSize = 0;
      for (const f of attachedFiles) totalSize += f.size;
      
      if (totalSize > MAX_SIZE) {
        setFormError('Total ukuran lampiran baru melampaui batas maksimal 50 MB.');
        setFormLoading(false);
        return;
      }

      // Construction of Multiparts Frameworks Payload
      const formData = new FormData();
      formData.append('title', formTitle);
      formData.append('text', formText);

      if (!isEdit) {
        // Subject IDs strictly lock defensively passing POST requests cleanly
        formData.append('subjectId', formSubjectId);
      } else {
        // Filter Array Names logic extracting files Teacher retained directly 
        const keepArray = retainedOldFiles.map(f => f.fileKey || f.filename);
        formData.append('retainedFiles', JSON.stringify(keepArray));
      }

      // Appending all the Fresh Array files cleanly natively
      for (const fileItem of attachedFiles) {
        formData.append('files', fileItem);
      }

      const url = isEdit ? `/api/teacher/materials/${selectedMaterial._id}` : '/api/teacher/materials';
      const method = isEdit ? 'PUT' : 'POST';

      setUploadProgress(0);
      const data = await uploadWithProgress(url, formData, method, (progress) => {
         setUploadProgress(progress);
      });

      fetchMaterials();
      handleCloseForm();

    } catch (err) {
      setFormError(err.message || 'Sinyal Payload Form Data gagal terlempar (Jaringan Error).');
    } finally {
      setFormLoading(false);
      setUploadProgress(0);
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
      <PageHeader title="Portal Distribusi Materi" subtitle="Materi yang Anda publish berstatus LIVE terbatas pada parameter kode kelas spesifik siswa.">
        <button className={styles.btnPrimary} onClick={() => handleOpenForm()} disabled={!dependenciesLoaded}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Publikasi Modul Baru
        </button>
      </PageHeader>

      <ContentCard>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Mengenkripsi Direktori Server...
            </div>
          ) : materials.length === 0 ? (
            <EmptyState
              title="Belum Ada Materi"
              description="Modul masih steril. Belum ada materi terekam di sistem pangkalan Anda."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Penanda Waktu</th>
                  <th>Lokus Mapel</th>
                  <th>Judul Materi</th>
                  <th>Deskripsi / Berkas</th>
                  <th>Progress</th>
                  <th className={styles.thCenter}>Operasional</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => (
                  <tr key={mat._id}>
                    <td data-label="Tanggal">
                      <div className={styles.cellBold}>{new Date(mat.createdAt).toLocaleDateString('id-ID')}</div>
                      <div className={styles.cellSecondary}>{new Date(mat.createdAt).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td data-label="Mapel">
                      <div className={styles.cellAccent}>{mat.subjectDetails?.subjectName || 'Subjek Sinkronisasi Fail'}</div>
                      <div className={styles.cellChipWrap}>
                        <StatusBadge variant="student">{formatClassCodes(mat.subjectDetails)}</StatusBadge>
                      </div>
                    </td>
                    <td data-label="Judul">
                      <div className={styles.userName}>{mat.title || 'Tanpa Judul'}</div>
                    </td>
                    <td data-label="Deskripsi / Berkas">
                      <div className={styles.descriptionPreview}>{mat.text}</div>
                      <div className={styles.fileChipList}>
                        {(mat.files || []).map((f, i) => (
                          <a key={getFileListKey(f, i, `table-${mat._id}`)} href={f.url} target="_blank" rel="noopener noreferrer" className={styles.fileChip}>
                            📎 {f.originalName}
                          </a>
                        ))}
                        {(!mat.files || mat.files.length === 0) && <span className={styles.cellSecondary}>-</span>}
                      </div>
                    </td>
                    <td data-label="Progress">
                      <div className={styles.cellBold}>{mat.completionStats?.percentage || 0}% selesai</div>
                      <div className={styles.cellSecondary}>
                        {mat.completionStats?.completedCount || 0} / {mat.completionStats?.totalStudents || 0} siswa
                      </div>
                      <div className={styles.cellSecondary}>
                        Dipelajari: {mat.completionStats?.inProgressCount || 0} · Belum dibuka: {mat.completionStats?.notStartedCount || 0}
                      </div>
                    </td>
                    <td data-label="Aksi" className={styles.tdCenter}>
                      <div className={`${styles.actionBtns} ${styles.actionBtnsCenter}`}>
                        <button className={styles.iconBtn} onClick={() => handleOpenForm(mat)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedMaterial(mat); setIsDeleteOpen(true); }}>
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
        {!loading && materials.length > 0 && (
          <div className={styles.mobileMaterialList}>
            {materials.map((mat) => (
              <article key={`m-${mat._id}`} className={styles.mobileMaterialCard}>
                <div className={styles.mobileMaterialTop}>
                  <div>
                    <div className={styles.mobileMaterialTitle}>{mat.title || 'Tanpa Judul'}</div>
                    <div className={styles.mobileMaterialSubject}>{mat.subjectDetails?.subjectName || '-'}</div>
                  </div>
                  <div className={styles.mobileMaterialActions}>
                    <button className={styles.iconBtn} onClick={() => handleOpenForm(mat)} title="Edit">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedMaterial(mat); setIsDeleteOpen(true); }} title="Hapus">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                    </button>
                  </div>
                </div>
                <div className={styles.mobileMaterialMeta}>
                  <StatusBadge variant="student">{formatClassCodes(mat.subjectDetails)}</StatusBadge>
                  <span className={styles.mobileMaterialDate}>{new Date(mat.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                <div className={styles.mobileMaterialDesc}>{(mat.text || '').substring(0, 100)}{(mat.text || '').length > 100 ? '...' : ''}</div>
                <div className={styles.cellSecondary}>
                  Progress: {mat.completionStats?.completedCount || 0} / {mat.completionStats?.totalStudents || 0} siswa ({mat.completionStats?.percentage || 0}%)
                </div>
                <div className={styles.cellSecondary}>
                  Dipelajari: {mat.completionStats?.inProgressCount || 0} · Belum dibuka: {mat.completionStats?.notStartedCount || 0}
                </div>
                {(mat.files || []).length > 0 && (
                  <div className={styles.fileChipList}>
                    {mat.files.slice(0, 2).map((f, i) => (
                      <a key={getFileListKey(f, i, `mobile-${mat._id}`)} href={f.url} target="_blank" rel="noopener noreferrer" className={styles.fileChip}>📎 {f.originalName}</a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </ContentCard>

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
                className={`${styles.input} ${selectedMaterial ? styles.inputDisabled : styles.selectInput}`}
                required
                disabled={!!selectedMaterial}
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
                value={formClassCodes.length ? `Terkunci: Kelas [${formClassCodes.join(', ')}]` : 'Harap Setel Subjek'}
                disabled
                className={`${styles.input} ${styles.inputLocked}`}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Judul Materi Khusus Sistem*</label>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className={styles.input}
              required
              placeholder="Misal: Modul 1: Struktur Data Array Dasar"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Deskripsi / Konten (Text)*</label>
            <textarea
              value={formText}
              onChange={e => setFormText(e.target.value)}
              className={`${styles.input} ${styles.textarea}`}
              required
              placeholder="Tuliskan petunjuk kompetensi dasar materi disini..."
            />
          </div>

          {/* Native Form-Data File Handlers */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Tambah / Lampirkan Berkas Fs (Multiple File Select)</label>
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

            {/* Box mapping Arrays visualizing exactly what we retain logically */}
            <div className={styles.filePreviewList}>
              {retainedOldFiles.map((prevFl, idx) => (
                <div key={getFileListKey(prevFl, idx, 'retained')} className={`${styles.filePreviewItem} ${styles.filePreviewRetained}`}>
                  <span>📎 {prevFl.originalName} (Lawas)</span>
                  <button type="button" onClick={() => removeRetainedFile(prevFl.filename)} className={styles.fileRemoveBtn}>Hapus</button>
                </div>
              ))}

              {attachedFiles.map((fl, idx) => (
                <div key={idx} className={`${styles.filePreviewItem} ${styles.filePreviewNew}`}>
                  <span>📄 {fl.name} (Baru Disematkan)</span>
                  <button type="button" onClick={() => removeAttachedFile(idx)} className={styles.fileRemoveBtn}>Batalkan</button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            {formLoading && uploadProgress > 0 && <span className={styles.uploadProgressText}>Mengunggah... {uploadProgress}%</span>}
            <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Tarik Sinyal</button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Mengkompresi...' : 'Publikasi Jaringan'}
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
