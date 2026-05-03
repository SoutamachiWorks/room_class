'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from '../admin.module.css';

export default function AdminDashboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  // Form state
  const [formType, setFormType] = useState('teacher'); // 'teacher' | 'student'
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    teacherId: '',
    studentId: '',
    classCode: '',
    academicYearId: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        role: roleFilter,
        search,
      });
      const res = await fetch(`/api/admin/users?${query}`);
      const data = await res.json();
      
      if (res.ok) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handlers
  const handleOpenForm = (type, user = null) => {
    setFormType(type);
    setSelectedUser(user);
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        username: user.username || '',
        password: '',
        email: user.email || '',
        phone: user.phone || '',
        teacherId: user.teacherId || '',
        studentId: user.studentId || '',
        classCode: user.classCode || '',
        academicYearId: user.academicYearId || '',
      });
    } else {
      setFormData({
        fullName: '',
        username: '',
        password: '',
        email: '',
        phone: '',
        teacherId: '',
        studentId: '',
        classCode: '',
        academicYearId: '',
      });
    }
    setFormError('');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    const isEdit = !!selectedUser;
    
    // Validate required generic fields
    if (!formData.fullName || !formData.username || !formData.email) {
      setFormError('Nama lengkap, username, dan email wajib diisi.');
      setFormLoading(false);
      return;
    }
    if (!isEdit && !formData.password) {
      setFormError('Password wajib diisi untuk pengguna baru.');
      setFormLoading(false);
      return;
    }

    const payload = {
      role: formType,
      fullName: formData.fullName,
      username: formData.username,
      email: formData.email,
      phone: formData.phone,
      ...(formData.password && { password: formData.password })
    };

    if (formType === 'teacher') {
      if (!formData.teacherId) {
        setFormError('Teacher ID wajib diisi.');
        setFormLoading(false);
        return;
      }
      payload.teacherId = formData.teacherId;
    } else if (formType === 'student') {
      if (!formData.studentId || !formData.classCode) {
        setFormError('Student ID dan Kode Kelas wajib diisi.');
        setFormLoading(false);
        return;
      }
      payload.studentId = formData.studentId;
      payload.classCode = formData.classCode;
      if (formData.academicYearId) {
        payload.academicYearId = formData.academicYearId;
      }
    }

    try {
      const url = isEdit ? `/api/admin/users/${selectedUser._id}` : '/api/admin/users';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Terjadi kesalahan.');
      } else {
        fetchUsers();
        handleCloseForm();
      }
    } catch (err) {
      setFormError('Gagal menghubungi server.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
        setIsDeleteOpen(false);
      } else {
        alert(data.error || 'Gagal menghapus akun.');
      }
    } catch (err) {
      alert('Gagal menghubungi server.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const res = await fetch(`/api/admin/users/${user._id}/status`, { method: 'PATCH' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal mengubah status.');
      }
    } catch (err) {
      alert('Gagal menghubungi server.');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;

    setIsImporting(true);
    setImportResult(null);

    const formDataObj = new FormData();
    formDataObj.append('file', importFile);

    try {
      const res = await fetch('/api/teacher/students/import', {
        method: 'POST',
        body: formDataObj,
      });

      const data = await res.json();
      if (res.ok) {
        setImportResult({ type: 'success', data });
        fetchUsers();
      } else {
        setImportResult({ type: 'error', message: data.error, data });
      }
    } catch (err) {
      setImportResult({ type: 'error', message: 'Koneksi ke server gagal' });
    } finally {
      setIsImporting(false);
      setImportFile(null);
    }
  };

  // Role badge variant mapping
  const roleBadgeVariant = (role) => {
    if (role === 'admin') return 'admin';
    if (role === 'teacher') return 'teacher';
    return 'student';
  };

  const roleLabel = (role) => {
    if (role === 'admin') return 'Admin';
    if (role === 'teacher') return 'Guru';
    return 'Siswa';
  };

  // ── Filter bar (used as ContentCard header) ────────────────────────────
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
          placeholder="Cari nama, username, ID, atau email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className={styles.roleTabs}>
        <button className={`${styles.tabBtn} ${roleFilter === '' ? styles.tabBtnActive : ''}`} onClick={() => { setRoleFilter(''); setPage(1); }}>Semua</button>
        <button className={`${styles.tabBtn} ${roleFilter === 'admin' ? styles.tabBtnActive : ''}`} onClick={() => { setRoleFilter('admin'); setPage(1); }}>Admin</button>
        <button className={`${styles.tabBtn} ${roleFilter === 'teacher' ? styles.tabBtnActive : ''}`} onClick={() => { setRoleFilter('teacher'); setPage(1); }}>Guru</button>
        <button className={`${styles.tabBtn} ${roleFilter === 'student' ? styles.tabBtnActive : ''}`} onClick={() => { setRoleFilter('student'); setPage(1); }}>Siswa</button>
      </div>
    </div>
  );

  // ── Pagination (used as ContentCard footer) ────────────────────────────
  const paginationFooter = !loading && totalPages > 0 ? (
    <>
      <div className={styles.pageInfo}>
        Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} dari {totalCount} akun
      </div>
      <div className={styles.pageControls}>
        <button 
          className={styles.pageBtn} 
          onClick={() => setPage(Math.max(1, page - 1))} 
          disabled={page === 1}
        >
          Sebelumnya
        </button>
        <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>
          {page}
        </button>
        <button 
          className={styles.pageBtn} 
          onClick={() => setPage(Math.min(totalPages, page + 1))} 
          disabled={page === totalPages}
        >
          Selanjutnya
        </button>
      </div>
    </>
  ) : null;

  return (
    <>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader title="Manajemen Akun">
        <button className={styles.btnPrimary} onClick={() => handleOpenForm('teacher')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Guru
        </button>
        <button className={`${styles.btnPrimary} ${styles.btnDark}`} onClick={() => handleOpenForm('student')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Siswa
        </button>
        <button 
          className={`${styles.btnPrimary} ${styles.btnOutline}`}
          onClick={() => { setIsImportModalOpen(true); setImportResult(null); }} 
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import Siswa
        </button>
      </PageHeader>

      {/* ── Main Content Card ────────────────────────────────────────────── */}
      <ContentCard
        header={filterBar}
        footer={paginationFooter}
      >
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat data...
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              title="Tidak Ada Akun"
              description="Tidak ada akun yang cocok dengan filter pencarian Anda."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Kontak</th>
                  <th>ID / Kelas</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
              {users.map((u) => (
                  <tr key={u._id}>
                    <td data-label="Pengguna">
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{u.fullName?.charAt(0) || '?'}</div>
                        <div>
                          <div className={styles.userName}>{u.fullName}</div>
                          <div className={styles.userId}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Kontak">
                      <div className={styles.cellPrimary}>{u.email}</div>
                      <div className={styles.cellSecondary}>{u.phone || '-'}</div>
                    </td>
                    <td data-label="ID / Kelas">
                      <div className={styles.cellMedium}>
                        {u.role === 'teacher' ? u.teacherId : u.role === 'student' ? u.studentId : '-'}
                      </div>
                      {u.role === 'student' && <div className={styles.cellSecondary}>Kelas: {u.classCode || '-'}</div>}
                    </td>
                    <td data-label="Role">
                      <StatusBadge variant={roleBadgeVariant(u.role)}>
                        {roleLabel(u.role)}
                      </StatusBadge>
                    </td>
                    <td data-label="Status">
                      <StatusBadge variant={u.status === 'active' ? 'success' : 'neutral'}>
                        {u.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </StatusBadge>
                    </td>
                    <td data-label="Aksi">
                      <div className={styles.actionBtns}>
                        {/* Edit Button */}
                        <button className={styles.iconBtn} onClick={() => handleOpenForm(u.role, u)} aria-label="Edit">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {/* Toggle Status Button */}
                        <button className={styles.iconBtn} onClick={() => handleToggleStatus(u)} aria-label={u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'} title={u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}>
                          {u.status === 'active' ? (
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          ) : (
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          )}
                        </button>
                        {/* Delete Button */}
                        {u.role !== 'admin' && (
                        <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => { setSelectedUser(u); setIsDeleteOpen(true); }} aria-label="Hapus">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
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

      {/* ── Form Modal (Create/Edit Teacher/Student) ──────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={selectedUser ? `Edit ${formType === 'teacher' ? 'Guru' : 'Siswa'}` : `Tambah ${formType === 'teacher' ? 'Guru' : 'Siswa'} Baru`}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.formError}>{formError}</div>}
          
          <div className={styles.formRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Nama Lengkap*</label>
              <input name="fullName" value={formData.fullName} onChange={handleFormChange} className={styles.input} required />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Username*</label>
              <input name="username" value={formData.username} onChange={handleFormChange} className={styles.input} required />
            </div>
          </div>

          <div className={styles.formRow}>
             <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Email*</label>
              <input type="email" name="email" value={formData.email} onChange={handleFormChange} className={styles.input} required />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>No. Handphone</label>
              <input name="phone" value={formData.phone} onChange={handleFormChange} className={styles.input} />
            </div>
          </div>

          <div className={styles.formRow}>
             <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Password {selectedUser && '(Kosongkan jika tidak diubah)'}{!selectedUser && '*'}</label>
              <input type="password" name="password" value={formData.password} onChange={handleFormChange} className={styles.input} minLength={6} />
            </div>
            
            {formType === 'teacher' && (
               <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Teacher ID*</label>
                <input name="teacherId" value={formData.teacherId} onChange={handleFormChange} className={styles.input} required />
              </div>
            )}
            
            {formType === 'student' && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Student ID*</label>
                <input name="studentId" value={formData.studentId} onChange={handleFormChange} className={styles.input} required />
              </div>
            )}
          </div>
          
          {formType === 'student' && (
             <div className={styles.formRow}>
               <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Kode Kelas*</label>
                <input name="classCode" value={formData.classCode} onChange={handleFormChange} className={styles.input} placeholder="Contoh: 10A" required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Tahun Ajaran</label>
                <input
                  name="academicYearId"
                  value={formData.academicYearId}
                  onChange={handleFormChange}
                  className={styles.input}
                  placeholder="Contoh: 2025/2026"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', marginTop: 4, display: 'block' }}>
                  Opsional. Digunakan untuk Riwayat Belajar saat siswa naik kelas.
                </span>
              </div>
             </div>
          )}

          <div className={styles.formActions}>
            <button type="button" onClick={handleCloseForm} className={styles.btnCancel} disabled={formLoading}>Batal</button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Pengguna"
        message={`Apakah Anda yakin ingin menghapus akun ${selectedUser?.fullName}? Tindakan ini tidak dapat dibatalkan.`}
        loading={formLoading}
      />

      {/* ── Import Modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={isImportModalOpen} onClose={() => !isImporting && setIsImportModalOpen(false)}>
        <div className={styles.importModalBody}>
          <h2 className={styles.importTitle}>📥 Import Siswa dari Excel</h2>
          
          {!importResult && (
             <div className={styles.importIntro}>
                <p className={styles.importDesc}>
                   Isi data melalui format baku yang kami sediakan untuk menghindari kegagalan struktur data.
                </p>
                <a 
                   href="/api/teacher/students/template" 
                   download
                   className={styles.btnOutline}
                >
                   Unduh Template Excel (.xlsx)
                </a>
             </div>
          )}

          {importResult && importResult.type === 'success' && (
             <div className={`${styles.alert} ${styles.alertSuccess}`}>
                <h3 className={styles.alertTitle}>✅ Import Berhasil Diproses!</h3>
                <p className={styles.alertText}>{importResult.data.successCount} siswa sukses ditambahkan.</p>
                
                {importResult.data.failedCount > 0 && (
                   <div className={styles.alertDetail}>
                      <div className={styles.alertDetailTitle}>
                         ⚠️ {importResult.data.failedCount} Baris Gagal (Bentuk Duplikasi / Error):
                      </div>
                      <ul className={styles.alertDetailList}>
                         {importResult.data.errors?.slice(0, 5).map((err, i) => (
                            <li key={i}>Baris {err.row} ({err.email}): {err.reason}</li>
                         ))}
                         {importResult.data.errors?.length > 5 && <li>...dan {importResult.data.errors.length - 5} lainnya</li>}
                      </ul>
                   </div>
                )}
             </div>
          )}

          {importResult && importResult.type === 'error' && (
             <div className={`${styles.alert} ${styles.alertError}`}>
                <h3 className={styles.alertTitle}>❌ Gagal Import</h3>
                <p className={styles.alertText}>{importResult.message}</p>
             </div>
          )}

          {!importResult || importResult.type === 'error' ? (
             <form onSubmit={handleImport}>
               <div className={styles.fieldGroup}>
                 <label className={styles.fieldLabel}>Pilih File .xlsx</label>
                 <input 
                   type="file" 
                   accept=".xlsx, .xls"
                   onChange={(e) => setImportFile(e.target.files[0])}
                   className={styles.fileInput}
                   required
                 />
               </div>
               
               <div className={styles.formActions}>
                 <button type="button" onClick={() => setIsImportModalOpen(false)} className={styles.btnCancel} disabled={isImporting}>
                   Batal
                 </button>
                 <button type="submit" className={styles.btnSubmit} disabled={isImporting || !importFile}>
                   {isImporting ? 'Memproses...' : 'Upload & Tunggu'}
                 </button>
               </div>
             </form>
          ) : (
             <div className={styles.formActions}>
                 <button type="button" onClick={() => setIsImportModalOpen(false)} className={styles.btnSubmit}>
                   Tutup & Selesai
                 </button>
             </div>
          )}
        </div>
      </Modal>
    </>
  );
}
