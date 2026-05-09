'use client';

import { useState, useEffect } from 'react';
import styles from './admin-schedules.module.css';
import ConfirmDialog from '@/components/ConfirmDialog';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function AdminSchedulesPage() {
  const [classCodes, setClassCodes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: '',
    dayOfWeek: 1,
    startTime: '07:00',
    endTime: '08:30'
  });

  useEffect(() => {
    // Fetch filter data: classes
    fetch('/api/admin/class-codes')
      .then(r => r.json())
      .then(d => {
        setClassCodes(d.classCodes || []);
        if (d.classCodes?.length > 0) {
          setSelectedClass(d.classCodes[0].code);
        }
      })
      .catch(console.error);
  }, []);

  async function fetchSchedules(code) {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules?classCode=${code}`);
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedClass) return;
    
    // Fetch subjects for this class
    fetch(`/api/admin/subjects?classCode=${selectedClass}`)
      .then(r => r.json())
      .then(d => setSubjects(d.subjects || []))
      .catch(console.error);

    // Fetch schedules for this class
    const timer = setTimeout(() => {
      fetchSchedules(selectedClass);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedClass]);

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    setFormError('');
    const subject = subjects.find(s => s._id === formData.subjectId);
    if (!subject) {
      setFormError('Pilih mata pelajaran terlebih dahulu.');
      return;
    }

    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode: selectedClass,
          subjectId: subject._id,
          teacherId: subject.teacherId, // Ambil dari subject
          dayOfWeek: parseInt(formData.dayOfWeek, 10),
          startTime: formData.startTime,
          endTime: formData.endTime
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormError('');
        fetchSchedules(selectedClass);
      } else {
        const d = await res.json();
        setFormError(d.error || 'Gagal menyimpan jadwal.');
      }
    } catch (err) {
      console.error(err);
      setFormError('Terjadi kesalahan jaringan.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/schedules/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        setIsDeleteOpen(false);
        setDeleteTargetId('');
        fetchSchedules(selectedClass);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Group schedules by day
  const groupedSchedules = {};
  for (let i = 1; i <= 6; i++) {
    groupedSchedules[i] = schedules.filter(s => s.dayOfWeek === i).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Manajemen Jadwal</h1>
          <p className={styles.subtitle}>Atur jadwal pelajaran untuk setiap kelas</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setIsModalOpen(true)} disabled={!selectedClass}>
          + Tambah Jadwal
        </button>
      </header>

      <div className={styles.controls}>
        <div className={styles.selectGroup}>
          <label>Pilih Kelas</label>
          <select 
            className={styles.select} 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="" disabled>-- Pilih Kelas --</option>
            {classCodes.map(c => (
              <option key={c._id} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.emptyState}>Memuat jadwal...</div>
        ) : !selectedClass ? (
          <div className={styles.emptyState}>Pilih kelas terlebih dahulu</div>
        ) : schedules.length === 0 ? (
          <div className={styles.emptyState}>Belum ada jadwal untuk kelas ini</div>
        ) : (
          <div>
            {[1, 2, 3, 4, 5, 6].map(dayIdx => {
              const daySchedules = groupedSchedules[dayIdx];
              if (daySchedules.length === 0) return null;
              
              return (
                <div key={dayIdx} className={styles.daySection}>
                  <div className={styles.dayTitle}>{DAYS[dayIdx]}</div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Mata Pelajaran</th>
                        <th>Guru Pengampu</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daySchedules.map(sch => (
                        <tr key={sch._id}>
                          <td>{sch.startTime} - {sch.endTime}</td>
                          <td>{sch.subjectDetails?.subjectName || 'Mata Pelajaran'}</td>
                          <td>{sch.teacherDetails?.fullName || sch.teacherId}</td>
                          <td>
                            <button className={styles.btnDelete} onClick={() => { setDeleteTargetId(sch._id); setIsDeleteOpen(true); }}>
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Tambah Jadwal ({selectedClass})</h2>
            <form onSubmit={handleAddSchedule}>
              <div className={styles.formGroup}>
                <label>Mata Pelajaran</label>
                <select 
                  className={styles.formControl} 
                  value={formData.subjectId} 
                  onChange={e => setFormData({...formData, subjectId: e.target.value})}
                  required
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map(s => (
                    <option key={s._id} value={s._id}>{s.subjectName} ({s.teacherId})</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Hari</label>
                <select 
                  className={styles.formControl} 
                  value={formData.dayOfWeek} 
                  onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
                >
                  <option value={1}>Senin</option>
                  <option value={2}>Selasa</option>
                  <option value={3}>Rabu</option>
                  <option value={4}>Kamis</option>
                  <option value={5}>Jumat</option>
                  <option value={6}>Sabtu</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Jam Mulai</label>
                <input 
                  type="time" 
                  className={styles.formControl} 
                  value={formData.startTime} 
                  onChange={e => setFormData({...formData, startTime: e.target.value})}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Jam Selesai</label>
                <input 
                  type="time" 
                  className={styles.formControl} 
                  value={formData.endTime} 
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className={styles.btnPrimary}>Simpan Jadwal</button>
              </div>
              {formError && <p style={{ color: '#dc2626', fontSize: '0.9rem', marginTop: '0.75rem' }}>{formError}</p>}
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => { if (!deleteLoading) { setIsDeleteOpen(false); setDeleteTargetId(''); } }}
        onConfirm={handleDeleteConfirm}
        title="Hapus Jadwal"
        message="Yakin ingin menghapus jadwal ini?"
        loading={deleteLoading}
      />
    </div>
  );
}
