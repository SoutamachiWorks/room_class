'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../../admin/admin.module.css';

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
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

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/assignments');
      const data = await res.json();
      if (res.ok) setAssignments(data.assignments || []);
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setFormText('');
      setRetainedOldFiles([]);
      setAttachedFiles([]);
    }
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
      const formData = new FormData();
      formData.append('text', formText);

      if (isEdit) {
        const keepArray = retainedOldFiles.map(f => f.filename);
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

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Gagal mengirim jawaban.');
      } else {
        fetchAssignments();
        handleCloseForm();
      }
    } catch {
      setFormError('Koneksi ke server gagal.');
    } finally {
      setFormLoading(false);
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

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Tugas Saya</h1>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Daftar tugas dari guru berdasarkan kelas Anda. Klik &quot;Kumpulkan&quot; untuk mengirim jawaban.
        </p>

        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat daftar tugas...
            </div>
          ) : assignments.length === 0 ? (
            <div className={styles.emptyState}>Belum ada tugas untuk kelas Anda saat ini.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Tanggal</th>
                  <th style={{ width: '20%' }}>Mata Pelajaran</th>
                  <th style={{ width: '30%' }}>Instruksi Tugas</th>
                  <th style={{ width: '30%' }}>Lampiran</th>
                  <th style={{ textAlign: 'center' }}>Batas Akhir</th>
                  <th style={{ textAlign: 'center' }}>Nilai</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((asm) => (
                  <tr key={asm._id}>
                    <td data-label="Tanggal">
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {new Date(asm.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td data-label="Mata Pelajaran">
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        {asm.subjectDetails?.subjectName || '-'}
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                        <span className={`${styles.badge} ${styles.badgeStudent}`}>
                          {asm.subjectDetails?.classCode || '-'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Instruksi">
                      <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto' }}>
                        {asm.text}
                      </div>
                    </td>
                    <td data-label="Lampiran">
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(asm.files || []).map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--color-warning)', textDecoration: 'none', border: '1px solid rgba(245, 158, 11, 0.3)', maxWidth: '200px' }}
                            title={f.originalName}
                          >
                            <span style={{ flexShrink: 0 }}>📎</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.originalName}</span>
                          </a>
                        ))}
                        {(!asm.files || asm.files.length === 0) && <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)' }}>-</span>}
                      </div>
                    </td>
                    <td data-label="Batas Akhir">
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: asm.deadline ? 'var(--color-danger)' : 'var(--color-subtext)' }}>
                        {asm.deadline ? new Date(asm.deadline).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Tidak Ada'}
                      </div>
                    </td>
                    <td data-label="Nilai">
                      {asm.submission?.score !== undefined && asm.submission?.score !== null && (
                        <div style={{ marginTop: '8px', padding: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, borderRadius: '4px', fontSize: '0.875rem' }}>
                          {asm.submission.score}/100
                        </div>
                      )}
                    </td>
                    <td data-label="Status">
                      {asm.submission ? (
                        <span className={`${styles.badge} ${styles.statusActive}`} style={asm.submission?.isLate ? { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' } : {}}>
                          {asm.submission?.isLate ? 'Terlambat Dikumpulkan' : 'Sudah Dikumpulkan'}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.statusInactive}`}>Belum dikumpulkan</span>
                      )}
                    </td>
                    <td data-label="Aksi">
                      <div className={styles.actionBtns} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                        {!asm.submission ? (
                          /* Submit button */
                          <button
                            className={styles.btnPrimary}
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
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
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
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
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
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
      </div>

      {/* Submit / Edit Submission Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={editingSubmission ? 'Edit Jawaban' : `Kumpulkan Jawaban`}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.formError}>{formError}</div>}

          {/* Show assignment context */}
          <div style={{ padding: '12px 16px', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '4px' }}>
              {selectedAssignment?.subjectDetails?.subjectName || 'Mata Pelajaran'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto' }}>
              {selectedAssignment?.text}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Jawaban / Catatan (Teks)</label>
            <textarea
              value={formText}
              onChange={e => setFormText(e.target.value)}
              className={styles.input}
              style={{ height: '120px', paddingTop: '12px', resize: 'vertical' }}
              placeholder="Tuliskan jawaban atau catatan Anda di sini..."
            />
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '12px' }}>
            <label className={styles.fieldLabel}>Lampirkan File (Opsional)</label>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className={styles.input}
              style={{ paddingTop: '10px' }}
              onChange={(e) => {
                const newFiles = Array.from(e.target.files);
                setAttachedFiles(prev => [...prev, ...newFiles]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {retainedOldFiles.map((f) => (
                <div key={f.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <span style={{ color: 'var(--color-success)' }}>📎 {f.originalName} (Sebelumnya)</span>
                  <button type="button" onClick={() => removeRetainedFile(f.filename)} style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Hapus</button>
                </div>
              ))}
              {attachedFiles.map((fl, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(120, 163, 255, 0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid rgba(120, 163, 255, 0.3)' }}>
                  <span style={{ color: 'var(--color-primary)' }}>📄 {fl.name} (Baru)</span>
                  <button type="button" onClick={() => removeAttachedFile(idx)} style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Batalkan</button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formActions} style={{ marginTop: '24px' }}>
            <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batal</button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Mengirim...' : (editingSubmission ? 'Perbarui Jawaban' : 'Kirim Jawaban')}
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
