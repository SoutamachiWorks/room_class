'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import styles from '../admin.module.css';

const initialForm = { label: '', isActive: true };

export default function AdminAcademicYearsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    const timer = setTimeout(() => {
      loadRows();
    }, 0);
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

  return (
    <div>
      <PageHeader
        title="Manajemen Tahun Ajaran"
        subtitle="Atur daftar tahun ajaran untuk dipakai di pembuatan akun siswa dan filter dashboard."
      />

      <ContentCard
        header={(
          <div className={styles.controlsBar}>
            <button className={styles.btnCreate} onClick={openCreate}>
              + Tambah Tahun Ajaran
            </button>
          </div>
        )}
      >
        {loading && <div className={styles.loading}>Memuat data...</div>}
        {!loading && error && <div className={styles.error}>{error}</div>}
        {!loading && !error && (
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
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.label}</td>
                    <td>{row.isActive ? 'Aktif' : 'Nonaktif'}</td>
                    <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString('id-ID') : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.btnEdit} onClick={() => openEdit(row)}>Edit</button>
                        <button
                          className={styles.btnDelete}
                          onClick={() => {
                            setSelected(row);
                            setFormError('');
                            setIsDeleteOpen(true);
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-subtext)' }}>
                      Belum ada tahun ajaran.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentCard>

      <Modal isOpen={isFormOpen} onClose={() => !formLoading && setIsFormOpen(false)}>
        <form className={styles.form} onSubmit={submit}>
          <h2 className={styles.formTitle}>{selected ? 'Edit Tahun Ajaran' : 'Tambah Tahun Ajaran'}</h2>
          {formError ? <p className={styles.formError}>{formError}</p> : null}

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Tahun Ajaran</label>
            <input
              className={styles.input}
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Contoh: 2025/2026"
              required
            />
          </div>

          <div className={styles.fieldGroup}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={Boolean(form.isActive)}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Jadikan tahun ajaran aktif
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.btnCancel} onClick={() => setIsFormOpen(false)} disabled={formLoading}>
              Batal
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={formLoading}>
              {formLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={remove}
        title="Hapus Tahun Ajaran"
        message={`Hapus tahun ajaran ${selected?.label}?`}
        loading={formLoading}
      />
    </div>
  );
}
