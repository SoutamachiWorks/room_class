'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { uploadWithProgress } from '@/lib/xhrUpload';
import { ACCEPT_STR, validateFiles } from '@/lib/fileValidation';
import styles from '../../admin/admin.module.css';

export default function StudentAssignmentsPage() {
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');

  const [assignments, setAssignments] = useState([]);
  const [enrolledYears, setEnrolledYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Submission modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [editingSubmission, setEditingSubmission] = useState(null);

  // Delete modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form state
  const [formText, setFormText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [retainedOldFiles, setRetainedOldFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const url = yearId ? `/api/student/assignments?yearId=${yearId}` : '/api/student/assignments';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.assignments || []);
        setEnrolledYears(data.enrolledYears || []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Open submit / edit modal
  const handleOpenForm = (assignment, existingSubmission = null) => {
    setSelectedAssignment(assignment);
    setEditingSubmission(existingSubmission);
    setFormError('');

    if (existingSubmission) {
      setFormText(existingSubmission.text || '');
      setRetainedOldFiles(existingSubmission.files || []);
      setAttachedFiles([]);
    } else {
      setRetainedOldFiles([]);
      setAttachedFiles([]);
    }
    setUploadProgress(0);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedAssignment(null);
    setEditingSubmission(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = !!editingSubmission;

    if (!formText && attachedFiles.length === 0 && retainedOldFiles.length === 0) {
      setFormError('Isi teks jawaban atau lampirkan file.');
      setFormLoading(false);
      return;
    }

    try {
      // 10MB limit validation for normal student homework Submissions
      const MAX_SIZE = 10 * 1024 * 1024;
      let totalSize = 0;
      for (const obj of attachedFiles) totalSize += obj.size;
      
      if (totalSize > MAX_SIZE) {
         setFormError('Sistem menolak! Total batasan memori untuk jawaban Anda melebihi angka 10 MB.');
         setFormLoading(false);
         return;
      }

      const formData = new FormData();
      formData.append('text', formText);

      if (isEdit) {
        const keepArray = retainedOldFiles.map(f => f.fileKey || f.filename);
        formData.append('retainedFiles', JSON.stringify(keepArray));
      } else {
        formData.append('assignmentId', selectedAssignment._id);
      }

      for (const fileItem of attachedFiles) {
        formData.append('files', fileItem);
      }

      const url = isEdit
        ? `/api/student/submissions/${editingSubmission._id}`
        : '/api/student/submissions';
      const method = isEdit ? 'PUT' : 'POST';

      setUploadProgress(0);
      const data = await uploadWithProgress(url, formData, method, (val) => setUploadProgress(val));

      fetchAssignments();
      handleCloseForm();
    } catch (err) {
      setFormError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setFormLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/student/submissions/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchAssignments();
        setIsDeleteOpen(false);
      } else {
        alert(data.error || 'Gagal menghapus.');
        setIsDeleteOpen(false);
      }
    } catch {
      alert('Koneksi ke server gagal.');
      setIsDeleteOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const removeRetainedFile = (fileName) => {
    setRetainedOldFiles(prev => prev.filter(f => f.filename !== fileName));
  };

  const removeAttachedFile = (idx) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const isArchiveMode = yearId && enrolledYears.length > 0 && yearId !== enrolledYears[enrolledYears.length - 1].yearId;

  return (
    <>
      <PageHeader
        title={<>Tugas Saya {isArchiveMode && <span className={styles.archiveTag}>(Mode Arsip)</span>}</>}
        subtitle="Daftar tugas dari guru berdasarkan kelas Anda. Klik 'Kumpulkan' untuk mengirim jawaban."
      />

      {isArchiveMode && (
        <div className={styles.archiveBanner}>
          ⚠️ Anda sedang melihat tugas tahun ajaran sebelumnya. Mode baca-saja aktif.
        </div>
      )}

      <ContentCard>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat daftar tugas...
            </div>
          ) : assignments.length === 0 ? (
            <EmptyState
              title="Belum Ada Tugas"
              description="Belum ada tugas untuk kelas Anda saat ini."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Mata Pelajaran</th>
                  <th>Instruksi Tugas</th>
                  <th>Lampiran</th>
                  <th className={styles.thCenter}>Batas Akhir</th>
                  <th className={styles.thCenter}>Nilai</th>
                  <th className={styles.thCenter}>Status</th>
                  <th className={styles.thCenter}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asm) => (
                  <tr key={asm._id}>
                    <td data-label="Tanggal">
                      <div className={styles.cellBold}>
                        {new Date(asm.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td data-label="Mata Pelajaran">
                      <div className={styles.cellAccent}>
                        {asm.subjectDetails?.subjectName || '-'}
                      </div>
                      <div className={styles.cellChipWrap}>
                        <StatusBadge variant="student">
                          {asm.subjectDetails?.classCode || '-'}
                        </StatusBadge>
                      </div>
                    </td>
                    <td data-label="Instruksi">
                      <div className={styles.cellPrewrap}>
                        {asm.text}
                      </div>
                    </td>
                    <td data-label="Lampiran">
                      <div className={styles.fileChipList}>
                        {(asm.files || []).map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            className={styles.fileChipWarm}
                            title={f.originalName}
                          >
                            <span className={styles.fileChipIcon}>📎</span>
                            <span className={styles.fileChipName}>{f.originalName}</span>
                          </a>
                        ))}
                        {(!asm.files || asm.files.length === 0) && <span className={styles.cellSecondary}>-</span>}
                      </div>
                    </td>
                    <td data-label="Batas Akhir" className={styles.tdCenter}>
                      <div className={`${styles.deadlineText} ${asm.deadline ? styles.deadlineActive : ''}`}>
                        {asm.deadline ? new Date(asm.deadline).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Tidak Ada'}
                      </div>
                    </td>
                    <td data-label="Nilai" className={styles.tdCenter}>
                      {asm.submission?.score !== undefined && asm.submission?.score !== null && (
                        <div className={styles.scoreBadge}>
                          {asm.submission.score}/100
                        </div>
                      )}
                      {isArchiveMode && asm.submission?.feedback && (
                        <div className={styles.feedbackNote}>
                          Feedback: &quot;{asm.submission.feedback}&quot;
                        </div>
                      )}
                    </td>
                    <td data-label="Status" className={styles.tdCenter}>
                      {asm.submission ? (
                        asm.submission?.isLate ? (
                          <StatusBadge variant="danger">Terlambat Dikumpulkan</StatusBadge>
                        ) : (
                          <StatusBadge variant="success">Sudah Dikumpulkan</StatusBadge>
                        )
                      ) : (
                        <StatusBadge variant="neutral">Belum dikumpulkan</StatusBadge>
                      )}
                    </td>
                    <td data-label="Aksi" className={styles.tdCenter}>
                      <div className={`${styles.actionBtns} ${styles.actionBtnsCenter}`}>
                        {isArchiveMode ? (
                          <div style={{ textAlign: 'center' }}>
                            {asm.submission ? (
                              <div>
                                {/* Show archived file notice if files were deleted */}
                                {asm.submission.isDeletedFromStorage && (
                                  <div className={styles.archiveNote} title="File dihapus otomatis saat kenaikan kelas untuk menghemat storage">
                                    🗑️ File tugas dihapus otomatis.
                                    Nilai &amp; jawaban tetap tersimpan.
                                  </div>
                                )}
                                {/* Show submission text if any */}
                                {asm.submission.text && (
                                  <div className={styles.noDataText} style={{ marginTop: 4 }}>
                                    ✏️ "{asm.submission.text.substring(0, 40)}{asm.submission.text.length > 40 ? '...' : ''}"
                                  </div>
                                )}
                                {/* Show files if still available */}
                                {!asm.submission.isDeletedFromStorage && asm.submission.files?.length > 0 && (
                                  <div className={styles.fileChipList}>
                                    {asm.submission.files.map((f, i) => (
                                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                                        className={styles.fileChipSuccess}>
                                        📎 {f.originalName}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className={styles.noDataText}>Tidak mengumpulkan</span>
                            )}
                          </div>
                        ) : !asm.submission ? (
                          /* Submit button */
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallPrimary}`}
                            onClick={() => handleOpenForm(asm)}
                          >
                            Kumpulkan
                          </button>
                        ) : (
                          <>
                            {/* Edit */}
                            <button
                              className={styles.iconBtn}
                              title="Edit Jawaban"
                              onClick={() => handleOpenForm(asm, asm.submission)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title="Hapus Jawaban"
                              onClick={() => { setDeleteTarget(asm.submission); setIsDeleteOpen(true); }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ContentCard>

      {/* Submit / Edit Submission Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingSubmission ? 'Edit Jawaban' : `Kumpulkan Jawaban`}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.formError}>{formError}</div>}

          {/* Show assignment context */}
          <div className={styles.contextBox}>
            <div className={styles.contextLabel}>
              {selectedAssignment?.subjectDetails?.subjectName || 'Mata Pelajaran'}
            </div>
            <div className={styles.contextText}>
              {selectedAssignment?.text}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Jawaban / Catatan (Teks)</label>
            <textarea
              value={formText}
              onChange={e => setFormText(e.target.value)}
              className={`${styles.input} ${styles.inputTextarea}`}
              placeholder="Tuliskan jawaban atau catatan Anda di sini..."
            />
          </div>

          <div className={`${styles.fieldGroup} ${styles.fieldGroupSpaced}`}>
            <label className={styles.fieldLabel}>Lampirkan File (Opsional)</label>
            <input
              type="file"
              multiple
              accept={ACCEPT_STR}
              ref={fileInputRef}
              className={`${styles.input} ${styles.inputFile}`}
              onChange={(e) => {
                const newFiles = Array.from(e.target.files);
                const validation = validateFiles(newFiles);
                
                if (!validation.valid) {
                  alert(`Kesalahan Upload:\n${validation.errors.join('\n')}\n\nPastikan format file sesuai dan ukuran maksimal 50MB per file.`);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  return;
                }

                setAttachedFiles(prev => [...prev, ...newFiles]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            <div className={styles.filePreviewList}>
              {retainedOldFiles.map((f) => (
                <div key={f.filename} className={styles.fileChipRetained}>
                  <span className={styles.fileChipRetainedLabel}>📎 {f.originalName} (Sebelumnya)</span>
                  <button type="button" onClick={() => removeRetainedFile(f.filename)} className={styles.fileChipRemoveBtn}>Hapus</button>
                </div>
              ))}
              {attachedFiles.map((fl, idx) => (
                <div key={idx} className={styles.fileChipNew}>
                  <span className={styles.fileChipNewLabel}>📄 {fl.name} (Baru)</span>
                  <button type="button" onClick={() => removeAttachedFile(idx)} className={styles.fileChipRemoveBtn}>Batalkan</button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            {formLoading && uploadProgress > 0 && <span className={styles.uploadProgressText}>Terkirim... {uploadProgress}%</span>}
            <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batal</button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Memproses...' : (editingSubmission ? 'Perbarui Jawaban' : 'Kirim Jawaban')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Jawaban"
        message="Anda yakin ingin menghapus jawaban Anda? Seluruh file yang telah dilampirkan juga akan dihapus. Tindakan ini tidak dapat dibatalkan."
        loading={deleteLoading}
      />
    </>
  );
}
