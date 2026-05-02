'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from '../../admin/admin.module.css';

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  // Pagination Logic
  const totalPages = Math.ceil(students.length / itemsPerPage);
  const paginatedStudents = students.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // ── Pagination footer ─────────────────────────────────────────────────
  const paginationFooter = totalPages > 1 ? (
    <>
      <div className={styles.pageInfo}>
        Menampilkan <strong>{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, students.length)}</strong> dari <strong>{students.length}</strong> siswa
      </div>
      <div className={styles.pageControls}>
        <button className={styles.pageBtn} onClick={handlePrevPage} disabled={currentPage === 1}>Sebelumnya</button>
        <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>{currentPage}</button>
        <button className={styles.pageBtn} onClick={handleNextPage} disabled={currentPage === totalPages}>Berikutnya</button>
      </div>
    </>
  ) : null;

  return (
    <>
      <PageHeader title="Daftar Siswa" subtitle="Berisi daftar siswa yang terhubung dengan mata pelajaran yang Anda ampu." />

      <ContentCard footer={paginationFooter}>
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat siswa...
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              title="Belum Ada Siswa"
              description="Belum ada siswa yang terdaftar di kelas Anda."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama Lengkap</th>
                  <th>NPM / NIS</th>
                  <th>Kode Kelas</th>
                  <th>Kelas Anda</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => (
                  <tr key={student._id}>
                    <td data-label="Nama">
                      <div className={styles.userName}>{student.fullName}</div>
                      <div className={styles.cellSecondary}>{student.email}</div>
                    </td>
                    <td data-label="NPM / NIS">
                      <span className={styles.cellBold}>{student.studentId}</span>
                    </td>
                    <td data-label="Kode Kelas">
                      <StatusBadge variant="student">{student.classCode}</StatusBadge>
                    </td>
                    <td data-label="Kelas Anda">
                      <div className={styles.subjectList}>
                        {student.mappedSubjects?.map((sub, i) => (
                          <div key={i} className={styles.subjectChipSmall}>{sub}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ContentCard>
    </>
  );
}
