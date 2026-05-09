'use client';

import { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from './teacher-students.module.css';

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
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

  const filteredStudents = students.filter((student) => {
    const keyword = searchInput.toLowerCase();
    const subjectText = (student.mappedSubjects || []).join(' ').toLowerCase();
    return (
      (student.fullName || '').toLowerCase().includes(keyword) ||
      (student.studentId || '').toLowerCase().includes(keyword) ||
      (student.classCode || '').toLowerCase().includes(keyword) ||
      (student.email || '').toLowerCase().includes(keyword) ||
      subjectText.includes(keyword)
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const startIndex = (currentPage - 1) * itemsPerPage;

  const uniqueClasses = new Set(filteredStudents.map((s) => s.classCode).filter(Boolean)).size;
  const uniqueSubjects = new Set(filteredStudents.flatMap((s) => s.mappedSubjects || [])).size;

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
        Menampilkan {Math.max(1, startIndex + 1)} - {Math.min(currentPage * itemsPerPage, filteredStudents.length)} dari {filteredStudents.length} siswa
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

      <div className={styles.searchRow}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Cari nama siswa, NPM / NIS, atau kelas..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      <ContentCard footer={paginationFooter}>
        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat siswa...
            </div>
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              title="Belum Ada Siswa"
              description="Tidak ada siswa yang cocok dengan pencarian Anda."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Nama Lengkap</th>
                  <th>NPM / NIS</th>
                  <th>Kode Kelas</th>
                  <th>Kelas Anda</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student, idx) => (
                  <tr key={student._id}>
                    <td className={styles.cellNo}>{startIndex + idx + 1}</td>
                    <td data-label="Nama">
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{student.fullName?.charAt(0) || 'S'}</div>
                        <div>
                          <div className={styles.userName}>{student.fullName}</div>
                          <div className={styles.cellSecondary}>{student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="NPM / NIS">
                      <span className={styles.cellBold}>{student.studentId || '-'}</span>
                    </td>
                    <td data-label="Kode Kelas">
                      <StatusBadge variant="student">{student.classCode || '-'}</StatusBadge>
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

      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <div className={styles.statValue}>{filteredStudents.length}</div>
          <div className={styles.statLabel}>Total Siswa</div>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statValue}>{uniqueClasses}</div>
          <div className={styles.statLabel}>Kelas Diampu</div>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statValue}>{uniqueSubjects}</div>
          <div className={styles.statLabel}>Mata Pelajaran</div>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Penugasan Aktif</div>
        </article>
      </section>
    </>
  );
}
