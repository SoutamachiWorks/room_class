'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import styles from '../admin.module.css';

export default function ClassCodeManagementPage() {
  const [classCodes, setClassCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    label: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Data Loading Routine
  const fetchClassCodes = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
      });

      const res = await fetch(`/api/admin/class-codes?${query}`);
      const data = await res.json();

      if (res.ok) {
        setClassCodes(data.classCodes);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      console.error('Error fetching class codes:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchClassCodes();
  }, [fetchClassCodes]);

  // Handle Search Debounce mechanism
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset page trajectory on fresh searches
    }, 450);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Action Dispatchers
  const handleOpenForm = (existingConfig = null) => {
    setSelectedCode(existingConfig);
    if (existingConfig) {
      setFormData({
        code: existingConfig.code,
        label: existingConfig.label || '',
      });
    } else {
      setFormData({
        code: '',
        label: '',
      });
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCode(null);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = !!selectedCode;

    // Local Validation Check
    if (!formData.code || !formData.label) {
      setFormError('Semua field wajib diisi (Kode & Label).');
      setFormLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/admin/class-codes/${selectedCode._id}` : '/api/admin/class-codes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { label: formData.label } : formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Terjadi kesalahan sistem.');
      } else {
        fetchClassCodes();
        handleCloseForm();
      }
    } catch (err) {
      setFormError('Koneksi server gagal merespons. Silakan coba lagi.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCode) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/admin/class-codes/${selectedCode._id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (res.ok) {
        fetchClassCodes();
        setIsDeleteOpen(false);
      } else {
        // Here we handle HTTP 409 responses mapped to relational constraint blocks gracefully
        alert(data.error || 'Pemblokiran eksekusi tidak wajar. Hubungi admin.');
        setIsDeleteOpen(false);
      }
    } catch (err) {
      alert('Gagal menghubungi jalur eksekusi server.');
      setIsDeleteOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Konfigurasi Kode Kelas</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={() => handleOpenForm()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Buat Label Kelas
          </button>
        </div>
      </div>

      <div className={styles.contentCard}>
        {/* Filters Overlay Box */}
        <div className={styles.filterSection}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Cari struktur kode kelas..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {/* Data Architecture Array Grid */}
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div> {/* Spinner logic inherently grabs global dash loading hooks if attached */}
               Memuatan parameter database...
             </div>
          ) : classCodes.length === 0 ? (
            <div className={styles.emptyState}>Sistem kami mendeteksi tidak ada struktur Kelas Formasional saat ini.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Struktural Kode / ID</th>
                  <th>Label Panggil / Nama Rinci Referensi</th>
                  <th style={{ textAlign: 'center', width: '20%' }}>Sistem Konfigurasi</th>
                </tr>
              </thead>
              <tbody>
                {classCodes.map((cc) => (
                  <tr key={cc._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <div className={styles.avatar} style={{ background: '#E1E8FF', color: '#4A7AFA', fontSize: '0.625rem' }}>ID</div>
                         <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{cc.code}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)' }}>{cc.label}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <div className={styles.actionBtns} style={{ justifyContent: 'center' }}>
                          <button className={styles.iconBtn} onClick={() => handleOpenForm(cc)} aria-label="Edit Kelas Parameter">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedCode(cc); setIsDeleteOpen(true); }} aria-label="Amputasi Record Data">
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
              Parameter {Math.min((page - 1) * limit + 1, totalCount)} – {Math.min(page * limit, totalCount)} (Integrasi: {totalCount} Modul)
            </div>
            <div className={styles.pageControls}>
              <button 
                className={styles.pageBtn} 
                onClick={() => setPage(Math.max(1, page - 1))} 
                disabled={page === 1}
              >
                Kembali
              </button>
              <button 
                className={styles.pageBtn} 
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: 'transparent' }}
              >
                {page}
              </button>
              <button 
                className={styles.pageBtn} 
                onClick={() => setPage(Math.min(totalPages, page + 1))} 
                disabled={page === totalPages}
              >
                Maju
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Creation/Adjustment Modals */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={selectedCode ? 'Sesuaikan Parameter Kode' : 'Tambah Arsitektur Model Kelas'}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
           {formError && <div className={styles.formError}>{formError}</div>}

           {selectedCode && (
              <div style={{ background: '#FEF3C7', padding: '12px', borderRadius: '8px', fontSize: '0.8125rem', color: '#92400e', marginBottom: '8px' }}>
                 Tindakan modifikasi struktural ID/Kode secara permanen dikunci guna menghindari data corrupt akibat cross-linking data dengan murid dan mata pelajaran.
              </div>
           )}

           <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nomor Identifikasi / Kode Konstan*</label>
              <input 
                 name="code" 
                 value={formData.code} 
                 onChange={handleFormChange} 
                 className={styles.input} 
                 required 
                 placeholder="Cth: IPA-X-A"
                 disabled={!!selectedCode} // Disables active mutating on PUT
                 style={selectedCode ? { background: '#F3F4F6', color: '#9CA3AF', cursor: 'not-allowed' } : {}}
              />
           </div>

           <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Label Pemanggil / Rincian Penulisan*</label>
              <input 
                 name="label" 
                 value={formData.label} 
                 onChange={handleFormChange} 
                 className={styles.input} 
                 required 
                 placeholder="Cth: Kelas 10 A Sains Biologi"
              />
           </div>

           <div className={styles.formActions}>
              <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batal</button>
              <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
                 {formLoading ? 'Sinkronisasi Ulang...' : 'Simpan Pemetaan'}
              </button>
           </div>
        </form>
      </Modal>

      {/* Extreme Amputation Constraint Confirmation Overloads */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Validasi Penghapusan Skema"
        message={`Apakah Administrator memvalidasi eksekutor pembersihan untuk membakar file [${selectedCode?.code}] secara absolut? Sisa data yang terkait dengan file ini akan ikut ditangguhkan/dilarang dieksekusi.`}
        loading={formLoading}
      />
    </>
  );
}
