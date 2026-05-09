'use client';

import { useState, useEffect } from 'react';
import { promoteClassBulk, promoteViaExcel, promoteManualSelection } from '@/app/actions/studentPromotion';
import styles from './KenaikanKelas.module.css';

export default function PromotionPage() {
  const [activeTab, setActiveTab] = useState('bulk'); // 'bulk' | 'excel'
  const [classCodes, setClassCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Bulk State
  const [bulkData, setBulkData] = useState({
    sourceClass: '',
    targetClass: '',
    academicYear: '',
  });

  // Excel State
  const [excelFile, setExcelFile] = useState(null);
  const [excelYear, setExcelYear] = useState('');

  // Manual Selection State
  const [manualSourceClass, setManualSourceClass] = useState('');
  const [manualTargetClass, setManualTargetClass] = useState('');
  const [manualAcademicYear, setManualAcademicYear] = useState('');
  const [manualStudents, setManualStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);

  useEffect(() => {
    async function fetchClassCodes() {
      try {
        const res = await fetch('/api/admin/class-codes');
        const data = await res.json();
        if (res.ok) setClassCodes(data.classCodes || []);
      } catch (err) {
        console.error("Gagal mengambil kode kelas:", err);
      }
    }
    fetchClassCodes();
  }, []);

  useEffect(() => {
    async function fetchStudentsInClass(classCode) {
      setFetchingStudents(true);
      try {
        const res = await fetch(`/api/admin/users?role=student&classCode=${encodeURIComponent(classCode)}&limit=1000`);
        const data = await res.json();
        if (res.ok) {
          setManualStudents(data.users || []);
          setSelectedStudentIds([]);
        }
      } catch(err) {
         console.error("Gagal mengambil data siswa:", err);
      } finally {
         setFetchingStudents(false);
      }
    }

    if (manualSourceClass && activeTab === 'manual') {
      fetchStudentsInClass(manualSourceClass);
    } else {
      Promise.resolve().then(() => {
        setManualStudents([]);
        setSelectedStudentIds([]);
      });
    }
  }, [manualSourceClass, activeTab]);

  const handleSelectAll = (e) => {
     if (e.target.checked) {
        setSelectedStudentIds(manualStudents.map(s => s._id));
     } else {
        setSelectedStudentIds([]);
     }
  };

  const handleSelectStudent = (id, checked) => {
     if (checked) {
        setSelectedStudentIds(prev => [...prev, id]);
     } else {
        setSelectedStudentIds(prev => prev.filter(studentId => studentId !== id));
     }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await promoteClassBulk(
      bulkData.sourceClass,
      bulkData.targetClass,
      bulkData.academicYear
    );

    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      setBulkData({ sourceClass: '', targetClass: '', academicYear: '' });
    } else {
      setMessage({ type: 'error', text: res.error });
    }
    setLoading(false);
  };

  const handleExcelSubmit = async (e) => {
    e.preventDefault();
    if (!excelFile) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('academicYearId', excelYear);

    const res = await promoteViaExcel(formData);

    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      setExcelFile(null);
      setExcelYear('');
      e.target.reset();
    } else {
      setMessage({ type: 'error', text: res.error });
    }
    setLoading(false);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
       setMessage({ type: 'error', text: 'Pilih minimal satu siswa untuk dipindahkan.' });
       return;
    }

    setLoading(true);
    setMessage(null);

    const res = await promoteManualSelection(
      selectedStudentIds,
      manualTargetClass,
      manualAcademicYear
    );

    if (res.success) {
      setMessage({ type: 'success', text: res.message });
      setManualSourceClass('');
      setManualTargetClass('');
      setManualAcademicYear('');
      setManualStudents([]);
      setSelectedStudentIds([]);
    } else {
      setMessage({ type: 'error', text: res.error });
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Kenaikan Kelas & Kelulusan</h1>
        <p className={styles.pageSubtitle}>Kelola perpindahan siswa antar tahun ajaran dan pembersihan storage otomatis.</p>
      </header>

      {/* 1. Top Tab Navigation */}
      <nav className={styles.tabNavigation}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.tabBtnActive : ''}`}
          onClick={() => { setActiveTab('bulk'); setMessage(null); }}
        >
          Pindah Massal (1 Kelas Penuh)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.tabBtnActive : ''}`}
          onClick={() => { setActiveTab('manual'); setMessage(null); }}
        >
          Seleksi Manual (Per Siswa)
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'excel' ? styles.tabBtnActive : ''}`}
          onClick={() => { setActiveTab('excel'); setMessage(null); }}
        >
          Import Custom (Excel)
        </button>
      </nav>

      {/* Alert Component */}
      {message && (
        <div className={`${styles.alert} ${message.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
          {message.type === 'success' ? '✅' : '❌'}
          <span>{message.text}</span>
        </div>
      )}

      {/* 2. Main Configuration Card */}
      <main className={styles.configCard}>
        {activeTab === 'bulk' ? (
          <form onSubmit={handleBulkSubmit} className={styles.formLayout}>
            <div>
              <h2 className={styles.cardTitle}>Konfigurasi Perpindahan Massal</h2>
              <p className={styles.cardDescription}>Semua siswa aktif di kelas sumber akan dipindahkan ke kelas target dan data tugas lama akan dibersihkan dari R2.</p>
            </div>
            
            {/* 3. Form Inputs Structure */}
            {/* Row 1: 2 Columns */}
            <div className={styles.formRowGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Kelas Sumber (Asal)</label>
                <select 
                  className={styles.inputField} 
                  value={bulkData.sourceClass} 
                  onChange={e => setBulkData({...bulkData, sourceClass: e.target.value})}
                  required
                >
                  <option value="">Pilih Kelas Asal...</option>
                  {classCodes.map(c => <option key={c._id} value={c.code}>{c.code} - {c.label}</option>)}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Kelas Target (Tujuan)</label>
                <select 
                  className={styles.inputField} 
                  value={bulkData.targetClass} 
                  onChange={e => setBulkData({...bulkData, targetClass: e.target.value})}
                  required
                >
                  <option value="">Pilih Kelas Tujuan...</option>
                  <option value="GRADUATED" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>🎓 LULUS / ALUMNI</option>
                  {classCodes.map(c => <option key={c._id} value={c.code}>{c.code} - {c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: Full Width */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Tahun Ajaran Baru (ID/Label)</label>
              <input 
                type="text" 
                className={styles.inputField} 
                placeholder="Contoh: 2024/2025" 
                value={bulkData.academicYear}
                onChange={e => setBulkData({...bulkData, academicYear: e.target.value})}
                required
              />
            </div>

            {/* Row 3: Action */}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Memproses Database & Storage...' : 'Eksekusi Kenaikan Kelas Massal'}
            </button>
          </form>
        ) : activeTab === 'manual' ? (
          <form onSubmit={handleManualSubmit} className={styles.formLayout}>
            <div>
              <h2 className={styles.cardTitle}>Seleksi Siswa Manual</h2>
              <p className={styles.cardDescription}>Pilih siswa tertentu untuk dipindahkan. Berguna untuk kasus siswa tinggal kelas atau pindah jurusan.</p>
            </div>
            
            {/* Section A: Filters */}
            <div className={styles.formRowGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Kelas Asal</label>
                <select 
                  className={styles.inputField} 
                  value={manualSourceClass} 
                  onChange={e => setManualSourceClass(e.target.value)}
                  required
                >
                  <option value="">Pilih Kelas Asal...</option>
                  {classCodes.map(c => <option key={c._id} value={c.code}>{c.code} - {c.label}</option>)}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Kelas Tujuan</label>
                <select 
                  className={styles.inputField} 
                  value={manualTargetClass} 
                  onChange={e => setManualTargetClass(e.target.value)}
                  required
                >
                  <option value="">Pilih Kelas Tujuan...</option>
                  <option value="GRADUATED" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>🎓 LULUS / ALUMNI</option>
                  {classCodes.map(c => <option key={c._id} value={c.code}>{c.code} - {c.label}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Tahun Ajaran Baru (ID/Label)</label>
              <input 
                type="text" 
                className={styles.inputField} 
                placeholder="Contoh: 2024/2025" 
                value={manualAcademicYear}
                onChange={e => setManualAcademicYear(e.target.value)}
                required
              />
            </div>

            {/* Section B: Student Table */}
            {manualSourceClass && (
              <div className={styles.studentSelectionSection}>
                <h3 className={styles.sectionHeading}>Daftar Siswa di {manualSourceClass}</h3>
                
                {fetchingStudents ? (
                   <div className={styles.loadingBox}>Memuat data siswa...</div>
                ) : manualStudents.length === 0 ? (
                   <div className={styles.emptyState}>Tidak ada siswa ditemukan di kelas ini.</div>
                ) : (
                  <div className={styles.tableScrollContainer}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th style={{ width: '60px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedStudentIds.length === manualStudents.length && manualStudents.length > 0}
                              onChange={handleSelectAll}
                              className={styles.checkbox}
                            />
                          </th>
                          <th style={{ width: '120px' }}>NIS</th>
                          <th>Nama Siswa</th>
                          <th style={{ width: '150px' }}>Status Saat Ini</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualStudents.map(student => (
                          <tr key={student._id}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox"
                                checked={selectedStudentIds.includes(student._id)}
                                onChange={e => handleSelectStudent(student._id, e.target.checked)}
                                className={styles.checkbox}
                              />
                            </td>
                            <td>{student.studentId}</td>
                            <td style={{ fontWeight: 500 }}>{student.fullName}</td>
                            <td>
                              <span className={styles.statusBadge}>{student.status === 'active' ? 'Aktif' : student.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={loading || selectedStudentIds.length === 0}>
              {loading ? 'Memproses Kepindahan...' : `Pindahkan ${selectedStudentIds.length} Siswa Terpilih`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleExcelSubmit} className={styles.formLayout}>
            <div>
              <h2 className={styles.cardTitle}>Kenaikan Kelas via Excel</h2>
              <p className={styles.cardDescription}>Gunakan metode ini jika siswa dalam satu kelas berpindah ke kelas yang berbeda-beda.</p>
            </div>
            
            <div className={styles.inputGroup}>
              <label className={styles.label}>Tahun Ajaran Baru (ID/Label)</label>
              <input 
                type="text" 
                className={styles.inputField} 
                placeholder="Contoh: 2024/2025" 
                value={excelYear}
                onChange={e => setExcelYear(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Upload File Pemetaan (Excel)</label>
              <div className={styles.uploadBox}>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={e => setExcelFile(e.target.files[0])}
                  className={styles.fileInput}
                  required
                />
                <div className={styles.uploadHint}>
                  Kolom wajib di dalam Excel: <strong>nis</strong> dan <strong>newClassCode</strong>
                </div>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading || !excelFile}>
              {loading ? 'Memproses File & Validasi Zod...' : 'Upload & Proses Kenaikan Kelas'}
            </button>
          </form>
        )}
      </main>

      {/* 4. System Note Banner (OUTSIDE the Card) */}
      <aside className={styles.systemNoteBanner}>
        <div className={styles.bannerIcon}>💡</div>
        <div className={styles.bannerText}>
          <strong>Catatan Sistem:</strong> Kenaikan kelas akan otomatis memicu penghapusan file fisik tugas (Submissions) tahun lalu dari Cloudflare R2 untuk menghemat ruang, namun nilai dan komentar guru akan tetap tersimpan di database.
        </div>
      </aside>
    </div>
  );
}
