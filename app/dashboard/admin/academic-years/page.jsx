'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import styles from './academic-years.module.css';

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

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

const initialForm = { label: '', isActive: true };

export default function AdminAcademicYearsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isMobile = useIsMobile(640);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/academic-years');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal memuat tahun ajaran.');
      setRows(data.academicYears || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat tahun ajaran.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadRows(), 0);
    return () => clearTimeout(timer);
  }, []);

  const openCreate = () => {
    setSelected(null);
    setForm(initialForm);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({ label: row.label || '', isActive: Boolean(row.isActive) });
    setFormError('');
    setIsFormOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const isEdit = Boolean(selected);
      const url = isEdit ? `/api/admin/academic-years/${selected._id}` : '/api/admin/academic-years';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menyimpan tahun ajaran.');
      setIsFormOpen(false);
      await loadRows();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan tahun ajaran.');
    } finally {
      setFormLoading(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/academic-years/${selected._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal menghapus tahun ajaran.');
      setIsDeleteOpen(false);
      setSelected(null);
      await loadRows();
    } catch (err) {
      setFormError(err.message || 'Gagal menghapus tahun ajaran.');
    } finally {
      setFormLoading(false);
    }
  };

  const StatusBadge = ({ isActive }) => (
    <span className={isActive ? styles.statusActive : styles.statusInactive}>
      <span className={styles.statusDot} />
      {isActive ? 'Aktif' : 'Nonaktif'}
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Manajemen Tahun Ajaran"
        subtitle="Atur daftar tahun ajaran untuk dipakai di pembuatan akun siswa dan filter dashboard."
      />

      <ContentCard
        header={
          <div className={styles.controlsBar}>
            <span className={styles.controlsTitle}>{rows.length} tahun ajaran terdaftar</span>
            <button className={styles.btnCreate} onClick={openCreate}>
              + Tambah Tahun Ajaran
            </button>
          </div>
        }
      >
        {loading && <div className={styles.loading}>Memuat data...</div>}
        {!loading && error && <div className={styles.error}>{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Desktop table ── */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tahun Ajaran</th>
                    <th>Status</th>
                    <th>Diperbarui</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-subtext)', padding: '40px' }}>
                        Belum ada tahun ajaran. Klik "+ Tambah Tahun Ajaran" untuk memulai.
                      </td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <div className={styles.yearLabel}>
                          <div className={styles.yearIcon}>
                            <CalendarIcon />
                          </div>
                          {row.label}
                        </div>
                      </td>
                      <td><StatusBadge isActive={row.isActive} /></td>
                      <td style={{ color: 'var(--color-subtext)', fontSize: '0.82rem' }}>
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString('id-ID') : '-'}
                      </td>
                      <td>
                        <div className={styles.actionCell}>
                          <button className={styles.btnEdit} onClick={() => openEdit(row)}>Edit</button>
                          <button
                            className={styles.btnDelete}
                            onClick={() => { setSelected(row); setFormError(''); setIsDeleteOpen(true); }}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile card list ── */}
            <div className={styles.mobileList}>
              {rows.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--color-subtext)', fontSize: '0.875rem' }}>
                  Belum ada tahun ajaran.
                </div>
              ) : rows.map((row) => (
                <div key={row._id} className={styles.mobileCard}>
                  {/* Top: icon + label + status */}
                  <div className={styles.mobileCardTop}>
                    <div className={styles.mobileYearLabel}>
                      <div className={styles.yearIcon}><CalendarIcon /></div>
                      <span className={styles.mobileYearText}>{row.label}</span>
                    </div>
                    <StatusBadge isActive={row.isActive} />
                  </div>

                  {/* Meta */}
                  <div className={styles.mobileMeta}>
                    <div className={styles.mobileMetaItem}>
                      <span className={styles.mobileMetaLabel}>Status</span>
                      <span className={styles.mobileMetaValue}>{row.isActive ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                    <div className={styles.mobileMetaItem}>
                      <span className={styles.mobileMetaLabel}>Diperbarui</span>
                      <span className={styles.mobileMetaValue}>
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.mobileActions}>
                    <button className={styles.btnEdit} onClick={() => openEdit(row)}>Edit</button>
                    <button
                      className={styles.btnDelete}
                      onClick={() => { setSelected(row); setFormError(''); setIsDeleteOpen(true); }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </ContentCard>

      {/* ── Form Modal ── */}
      <Modal isOpen={isFormOpen} onClose={() => !formLoading && setIsFormOpen(false)}>
        <form className={styles.form} onSubmit={submit}>
          <h2 className={styles.formTitle}>
            {selected ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}
          </h2>

          {formError && <p className={styles.formError}>{formError}</p>}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Tahun Ajaran *</label>
            <input
              className={styles.input}
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Contoh: 2025/2026"
              required
            />
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            <span className={styles.checkboxLabel}>Jadikan tahun ajaran aktif</span>
          </label>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={() => setIsFormOpen(false)}
              disabled={formLoading}
            >
              Batal
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={remove}
        title="Hapus Tahun Ajaran"
        message={`Hapus tahun ajaran "${selected?.label}"? Tindakan ini tidak dapat dibatalkan.`}
        loading={formLoading}
      />
    </div>
  );
}
