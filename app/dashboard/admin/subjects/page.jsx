'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../admin.module.css';

export default function SubjectManagementPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering Arrays
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dropdown Dependencies
  const [teachersRef, setTeachersRef] = useState([]);
  const [classCodesRef, setClassCodesRef] = useState([]);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Form State Configurations
  const [formData, setFormData] = useState({
    subjectName: '',
    teacherId: '',
    classCode: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Initialization: Fetch Dependency Data for Dropdowns concurrently
  useEffect(() => {
    async function loadFormDependencies() {
      try {
        const [teachersRes, classesRes] = await Promise.all([
           fetch('/api/admin/users?role=teacher&limit=1000'),
           fetch('/api/admin/class-codes?limit=1000')
        ]);

        const [teachersData, classesData] = await Promise.all([
           teachersRes.json(),
           classesRes.json()
        ]);

        if (teachersRes.ok) setTeachersRef(teachersData.users || []);
        if (classesRes.ok) setClassCodesRef(classesData.classCodes || []);

        setDependenciesLoaded(true);
      } catch (e) {
        console.error('Core Dependencies Failure:', e);
      }
    }
    loadFormDependencies();
  }, []);


  // Main Grid Data Population Routines
  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
      });

      const res = await fetch(`/api/admin/subjects?${query}`);
      const data = await res.json();

      if (res.ok) {
        setSubjects(data.subjects);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Debouncing logic preventing request spam
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); 
    }, 450);
    return () => clearTimeout(timer);
  }, [searchInput]);


  // Structural Modal Dispatches
  const handleOpenForm = (existingConfig = null) => {
    setSelectedSubject(existingConfig);
    if (existingConfig) {
      setFormData({
        subjectName: existingConfig.subjectName || '',
        teacherId: existingConfig.teacherId || '',
        classCode: existingConfig.classCode || '',
      });
    } else {
      setFormData({
        subjectName: '',
        teacherId: '',
        classCode: '',
      });
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedSubject(null);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Execution Protocol
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = !!selectedSubject;

    if (!formData.subjectName || !formData.teacherId || !formData.classCode) {
      setFormError('Sistem mendeteksi array parameter yang kosong. Harap lengkapi semua kolom.');
      setFormLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/admin/subjects/${selectedSubject._id}` : '/api/admin/subjects';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Eksekusi tertunda akibat gangguan lintas rute.');
      } else {
        if (data.cascaded) {
           alert("Sistem Berhasil Mengalihkan Kepemilikan Data!\nTransfer berkas antar ID Guru bersangkutan telah terkalibrasi secara masal (Cascade Overwrite Sync).");
        }
        fetchSubjects();
        handleCloseForm();
      }
    } catch (err) {
      setFormError('Koneksi sistem parameter gagal.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSubject) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/admin/subjects/${selectedSubject._id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (res.ok) {
        fetchSubjects();
        setIsDeleteOpen(false);
      } else {
        // Here we handle HTTP 409 structurally avoiding page breaks capturing native logic limits safely
        alert(data.error || 'Operasional Penganuliran Gagal Dikonfirmasi.');
        setIsDeleteOpen(false);
      }
    } catch (err) {
      alert('Kegagalan Konektif System.');
      setIsDeleteOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Penamaan Resolusi Subjek / Mata Pelajaran</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => handleOpenForm()} disabled={!dependenciesLoaded}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Rekam Subjek Belajar
          </button>
        </div>
      </div>

      <div className={styles.contentCard}>
        {/* Core Array Filters */}
        <div className={styles.filterSection}>
          <div className={styles.searchBox}>
             <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
               <circle cx="11" cy="11" r="8" />
               <line x1="21" y1="21" x2="16.65" y2="16.65" />
             </svg>
             <input
               type="text"
               className={styles.searchInput}
               placeholder="Pindai Berdasarkan Nama Pelajaran / Guru / Kelas..."
               value={searchInput}
               onChange={(e) => setSearchInput(e.target.value)}
             />
          </div>
        </div>

        {/* Dynamic Display Arrays */}
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div> 
               Mengkalibrasi Struktur Modul...
             </div>
          ) : subjects.length === 0 ? (
            <div className={styles.emptyState}>Konfigurasi Matrix Kelas belum memiliki pemetaan Mata Pelajaran.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Modul Pembelajaran Aktif</th>
                  <th>Konfigurasi Pengampu Utama</th>
                  <th>Spesifikasi Kelas</th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Kompilator Aksi</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub) => (
                  <tr key={sub._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div className={styles.avatar} style={{ background: '#E1E8FF', color: '#4A7AFA', fontSize: '1rem', width: '42px', height: '42px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                         </div>
                         <div style={{ fontWeight: 600, color: 'var(--color-heading)', fontSize: '0.9375rem' }}>{sub.subjectName}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{sub.teacherName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>ID Induk: {sub.teacherId}</div>
                    </td>
                    <td>
                       <span className={`${styles.badge} ${styles.badgeStudent}`}>{sub.classCode}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                          <button className={styles.iconBtn} onClick={() => handleOpenForm(sub)} aria-label="Mutasi Parameter">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedSubject(sub); setIsDeleteOpen(true); }} aria-label="Burn Data">
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

        {/* Global Pagination Handler */}
        {!loading && totalPages > 0 && (
          <div className={styles.pagination}>
            <div className={styles.pageInfo}>
               Data Baris {Math.min((page - 1) * limit + 1, totalCount)} – {Math.min(page * limit, totalCount)} (Terkalibrasi: {totalCount})
            </div>
            <div className={styles.pageControls}>
              <button className={styles.pageBtn} onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Mundur</button>
              <button className={styles.pageBtn} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: 'transparent' }}>{page}</button>
              <button className={styles.pageBtn} onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Maju</button>
            </div>
          </div>
        )}
      </div>

      {/* Creation/Adjustment Modals leveraging pre-fetched contextual states */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={selectedSubject ? 'Mutasi Pengaturan Kelas / Subjek' : 'Struktural Inisialisasi Mata Pelajaran'}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
           {formError && <div className={styles.formError}>{formError}</div>}

           {selectedSubject && (
              <div style={{ background: '#E1E8FF', padding: '12px', borderRadius: '8px', fontSize: '0.8125rem', color: '#4A7AFA', marginBottom: '8px' }}>
                 <strong>Informasi Integritas Cascade:</strong> Mengubah kolom "Guru Pemegang Modul" pada interface mutasi ini akan secara otomatis mentransfer (swap) seluruh Hak Kepemilikan Materi, Tugas, dan Ujian pada sistem menuju Guru terkait secara absolut.
              </div>
           )}

           <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nama Spesifikasi Pelajaran*</label>
              <input 
                 name="subjectName" 
                 value={formData.subjectName} 
                 onChange={handleFormChange} 
                 className={styles.input} 
                 required 
                 placeholder="Cth: Ilmu Pengetahuan Biologi"
              />
           </div>

           <div className={styles.formRow}>
              <div className={styles.fieldGroup}>
                 <label className={styles.fieldLabel}>Guru Pemegang Modul*</label>
                 <select 
                    name="teacherId" 
                    value={formData.teacherId} 
                    onChange={handleFormChange} 
                    className={styles.input} 
                    required 
                    style={{ appearance: 'auto' }}
                 >
                    <option value="" disabled>Pilih Guru Aktif...</option>
                    {teachersRef.map(t => (
                       <option key={t.teacherId} value={t.teacherId}>{t.fullName} ({t.teacherId})</option>
                    ))}
                 </select>
              </div>

              <div className={styles.fieldGroup}>
                 <label className={styles.fieldLabel}>Relasi Kode Kelas*</label>
                 <select 
                    name="classCode" 
                    value={formData.classCode} 
                    onChange={handleFormChange} 
                    className={styles.input} 
                    required 
                    style={{ appearance: 'auto' }}
                 >
                    <option value="" disabled>Pilih Skema Kelas...</option>
                    {classCodesRef.map(c => (
                       <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                    ))}
                 </select>
              </div>
           </div>

           <div className={styles.formActions}>
              <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batal</button>
              <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
                 {formLoading ? 'Kompilasi Jalur Server...' : 'Implementasi Aturan'}
              </button>
           </div>
        </form>
      </Modal>

      {/* Extreme Amputation Constraint Confirmation Overloads */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Otentikasi Pemusnahan Alur Modul!"
        message={`Apakah Administrator memvalidasi pencabutan paksa Subjek Modul [${selectedSubject?.subjectName}] secara absolut? Sisa penugasan file tidak akan dihapus (sebagai archive), namun modul ini hilang permanent.`}
        loading={formLoading}
      />
    </>
  );
}
