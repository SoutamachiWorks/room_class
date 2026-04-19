'use client';

import { useState, useEffect } from 'react';
import styles from '../../admin/admin.module.css';

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/teacher/students');
      const data = await res.json();
      if (res.ok) setStudents(data.students || []);
    } catch (err) {
      console.error('Failed to fetch students', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Daftar Siswa</h1>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Berisi daftar siswa yang terhubung dengan mata pelajaran yang Anda ampu, dikelompokkan berdasarkan Kode Kelas.
        </p>

        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat siswa...
            </div>
          ) : students.length === 0 ? (
            <div className={styles.emptyState}>Belum ada siswa yang terdaftar di kelas Anda.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Nama Lengkap</th>
                  <th style={{ width: '20%' }}>NPM / NIS</th>
                  <th style={{ width: '20%' }}>Kode Kelas</th>
                  <th style={{ width: '30%' }}>Kelas Anda</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{student.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext)' }}>{student.email}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{student.studentId}</span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeStudent}`}>
                        {student.classCode}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {student.mappedSubjects?.map((sub, i) => (
                          <div key={i} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                            {sub}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
