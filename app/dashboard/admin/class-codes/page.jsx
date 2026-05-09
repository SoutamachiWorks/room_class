'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { importClassesFromExcel } from '@/app/actions/classImport';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import EmptyState from '@/components/EmptyState';
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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

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
      setPage(1);
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

  const handleImportExcel = async (e) => {
    e.preventDefault();
    const file = e.target.elements.excelFile.files[0];
    if (!file) return;

    setImportLoading(true);
    setImportError('');
    setImportResult(null);

    const formDataObj = new FormData();
    formDataObj.append('file', file);

    try {
      const res = await importClassesFromExcel(formDataObj);
      if (res.success) {
        setImportResult(res);
        fetchClassCodes();
      } else {
        setImportError(res.error || 'Gagal mengimpor data.');
      }
    } catch (err) {
      setImportError('Terjadi kesalahan koneksi.');
    } finally {
      setImportLoading(false);
    }
  };

  // ── Filter bar ────────────────────────────────────────────────────────
  const filterBar = (
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
  );

  // ── Pagination footer ─────────────────────────────────────────────────
  const paginationFooter = !loading && totalPages > 0 ? (
    <>
      <div className={styles.pageInfo}>
        Parameter {Math.min((page - 1) * limit + 1, totalCount)} – {Math.min(page * limit, totalCount)} (Integrasi: {totalCount} Modul)
      </div>
      <div className={styles.pageControls}>
        <button className={styles.pageBtn} onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Kembali</button>
        <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>{page}</button>
        <button className={styles.pageBtn} onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Maju</button>
      </div>
    </>
  ) : null;

  return (
    <>
      <PageHeader title="Konfigurasi Kode Kelas">
        <button className={`${styles.btnPrimary} ${styles.btnOutline} ${styles.headerActionBtn}`} onClick={() => { setIsImportOpen(true); setImportResult(null); setImportError(''); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Impor Excel
        </button>
        <button className={`${styles.btnPrimary} ${styles.headerActionBtn}`} onClick={() => handleOpenForm()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Buat Label Kelas
        </button>
      </PageHeader>

      <ContentCard header={filterBar} footer={paginationFooter}>
        <div className={`${styles.tableContainer} ${styles.desktopOnlyBlock}`}>
          {loading ? (
             <div className={styles.loadingBox}>
               <div className="spinner"></div>
               Memuatan parameter database...
             </div>
          ) : classCodes.length === 0 ? (
            <EmptyState
              title="Belum Ada Kode Kelas"
              description="Sistem kami mendeteksi tidak ada struktur Kelas Formasional saat ini."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Struktural Kode / ID</th>
                  <th>Label Panggil / Nama Rinci Referensi</th>
                  <th className={styles.thCenter}>Sistem Konfigurasi</th>
                </tr>
              </thead>
              <tbody>
                {classCodes.map((cc) => (
                  <tr key={cc._id}>
                    <td data-label="Kode">
                      <div className={styles.userCell}>
                         <div className={styles.avatarIcon}>ID</div>
                         <div className={styles.userName}>{cc.code}</div>
                      </div>
                    </td>
                    <td data-label="Label">
                      <div className={styles.cellMedium}>{cc.label}</div>
                    </td>
                    <td data-label="Aksi" className={styles.tdCenter}>
                       <div className={`${styles.actionBtns} ${styles.actionBtnsCenter}`}>
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

        {!loading && classCodes.length > 0 && (
          <div className={styles.mobileUserList}>
            {classCodes.map((cc) => (
              <article key={`mobile-${cc._id}`} className={styles.mobileUserCard}>
                <div className={styles.mobileUserHead}>
                  <div className={styles.userCell}>
                    <div className={styles.avatarIcon}>ID</div>
                    <div>
                      <div className={styles.mobileMetaLabel}>Kode</div>
                      <div className={styles.userName}>{cc.code}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.mobileUserMeta}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.mobileMetaLabel}>Label</div>
                    <div className={styles.cellPrimary}>{cc.label}</div>
                  </div>
                </div>

                <div className={styles.mobileUserActions}>
                  <button className={styles.mobileActionBtn} onClick={() => handleOpenForm(cc)}>Edit</button>
                  <button className={`${styles.mobileActionBtn} ${styles.mobileActionBtnDanger}`} onClick={() => { setSelectedCode(cc); setIsDeleteOpen(true); }}>
                    Hapus
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Creation/Adjustment Modals */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={selectedCode ? 'Sesuaikan Parameter Kode' : 'Tambah Arsitektur Model Kelas'}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
           {formError && <div className={styles.formError}>{formError}</div>}

           {selectedCode && (
              <div className={`${styles.alert} ${styles.alertWarning}`}>
                 Tindakan modifikasi struktural ID/Kode secara permanen dikunci guna menghindari data corrupt akibat cross-linking data dengan murid dan mata pelajaran.
              </div>
           )}

           <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nomor Identifikasi / Kode Konstan*</label>
              <input 
                 name="code" 
                 value={formData.code} 
                 onChange={handleFormChange} 
                 className={`${styles.input} ${selectedCode ? styles.inputDisabled : ''}`}
                 required 
                 placeholder="Cth: IPA-X-A"
                 disabled={!!selectedCode}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Validasi Penghapusan Skema"
        message={`Apakah Administrator memvalidasi eksekutor pembersihan untuk membakar file [${selectedCode?.code}] secara absolut? Sisa data yang terkait dengan file ini akan ikut ditangguhkan/dilarang dieksekusi.`}
        loading={formLoading}
      />

      {/* Excel Import Modal */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => !importLoading && setIsImportOpen(false)}
        title="Impor Kode Kelas (Excel)"
      >
        <div className={styles.importModalBody}>
          <p className={styles.importDesc}>
            Unggah file Excel (.xlsx) dengan kolom: <strong>className</strong>, <strong>classCode</strong>, dan <strong>gradeLevel</strong>.
          </p>

          {!importResult ? (
            <form onSubmit={handleImportExcel}>
              {importError && <div className={styles.formError}>{importError}</div>}
              
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Pilih File Excel</label>
                <input 
                  type="file" 
                  name="excelFile" 
                  accept=".xlsx, .xls" 
                  className={styles.fileInput} 
                  required 
                  disabled={importLoading}
                />
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={() => setIsImportOpen(false)} className={styles.btnCancel} disabled={importLoading}>Batal</button>
                <button type="submit" className={styles.btnSubmit} disabled={importLoading}>
                  {importLoading ? 'Memproses...' : 'Mulai Impor'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.importResultBox}>
              <div className={styles.importResultIcon}>📊</div>
              <h3 className={styles.importResultTitle}>Hasil Impor Selesai</h3>
              
              <div className={styles.importResultGrid}>
                <div className={`${styles.importResultCard} ${styles.importResultSuccess}`}>
                  <div className={styles.importResultValue}>{importResult.successCount}</div>
                  <div className={styles.importResultLabel}>Berhasil</div>
                </div>
                <div className={`${styles.importResultCard} ${styles.importResultWarn}`}>
                  <div className={styles.importResultValue}>{importResult.duplicateCount}</div>
                  <div className={styles.importResultLabel}>Duplikat (Lewat)</div>
                </div>
              </div>

              {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                <div className={styles.importErrorList}>
                  <div className={styles.importErrorListTitle}>Detail Duplikat:</div>
                  {importResult.errorDetails.map((err, i) => (
                    <div key={i} className={styles.importErrorItem}>• {err}</div>
                  ))}
                </div>
              )}

              <button 
                className={`${styles.btnSubmit} ${styles.btnFullWidth}`}
                onClick={() => setIsImportOpen(false)}
              >
                Tutup Ringkasan
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
