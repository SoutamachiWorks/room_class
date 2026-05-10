'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import styles from './page.module.css';

const PAGE_SIZE = 10;

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

function getQuestionTypeLabel(exam) {
  const questions = exam?.questions || [];
  const hasMc = questions.some((q) => !!q.multipleChoice);
  const hasEssay = questions.some((q) => !!q.essay);
  const hasUpload = questions.some((q) => !!q.fileUpload);

  const totalActive = [hasMc, hasEssay, hasUpload].filter(Boolean).length;
  if (totalActive > 1) return 'Campuran';
  if (hasEssay) return 'Esai';
  if (hasUpload) return 'File Upload';
  return 'Pilihan Ganda';
}

function getMapelColor(subjectName) {
  const key = (subjectName || '').toLowerCase();
  if (key.includes('mat')) return 'mapelBlue';
  if (key.includes('bio')) return 'mapelGreen';
  if (key.includes('kim')) return 'mapelPurple';
  if (key.includes('fis')) return 'mapelCyan';
  if (key.includes('indo')) return 'mapelIndigo';
  return 'mapelSlate';
}

export default function ExamsPage() {
  const isMobile = useIsMobile(640);
  const router = useRouter();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [publishLoading, setPublishLoading] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teacher/exams');
      const data = await res.json();
      if (res.ok) {
        setExams(data.exams || []);
      } else {
        alert(data.error || 'Gagal memuat data bank soal.');
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const normalizedRows = useMemo(
    () =>
      exams.map((exam) => ({
        ...exam,
        subjectName: exam.subjectDetails?.subjectName || '-',
        classCode: exam.subjectDetails?.classCode || '-',
        typeLabel: getQuestionTypeLabel(exam),
        examCategory: exam.examCategory === 'semester' ? 'semester' : 'ulangan',
        requiresCurriculumApproval: exam.requiresCurriculumApproval === true,
        validationStatus: exam.validationStatus || (exam.requiresCurriculumApproval ? 'Pending' : 'NotRequired'),
      })),
    [exams]
  );

  const summary = useMemo(() => {
    const totalSoal = normalizedRows.length;
    const publikasi = normalizedRows.filter((row) => row.status === 'published').length;
    const draft = normalizedRows.filter((row) => row.status === 'draft').length;
    const uniqueMapel = new Set(normalizedRows.map((row) => row.subjectName).filter((v) => v && v !== '-')).size;
    return { totalSoal, publikasi, draft, uniqueMapel };
  }, [normalizedRows]);

  const subjectOptions = useMemo(
    () => Array.from(new Set(normalizedRows.map((row) => row.subjectName))).filter((v) => v && v !== '-'),
    [normalizedRows]
  );
  const classOptions = useMemo(
    () => Array.from(new Set(normalizedRows.map((row) => row.classCode))).filter((v) => v && v !== '-'),
    [normalizedRows]
  );

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return normalizedRows.filter((row) => {
      const matchedSearch =
        !q ||
        row.title?.toLowerCase().includes(q) ||
        row.subjectName?.toLowerCase().includes(q) ||
        row.classCode?.toLowerCase().includes(q);
      const matchedSubject = !subjectFilter || row.subjectName === subjectFilter;
      const matchedClass = !classFilter || row.classCode === classFilter;
      const matchedType = !typeFilter || row.typeLabel === typeFilter;
      const matchedStatus = !statusFilter || row.status === statusFilter;
      return matchedSearch && matchedSubject && matchedClass && matchedType && matchedStatus;
    });
  }, [normalizedRows, searchTerm, subjectFilter, classFilter, typeFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, subjectFilter, classFilter, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  const resetFilters = () => {
    setSearchTerm('');
    setSubjectFilter('');
    setClassFilter('');
    setTypeFilter('');
    setStatusFilter('');
  };

  const handleTogglePublish = async (exam) => {
    setPublishLoading(exam._id);
    try {
      const res = await fetch(`/api/teacher/exams/${exam._id}/publish`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengubah status publikasi.');
      } else {
        await fetchExams();
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setPublishLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${selectedExam._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menghapus bank soal.');
      } else {
        await fetchExams();
      }
    } catch {
      alert('Koneksi ke server gagal.');
    } finally {
      setDeleteLoading(false);
      setIsDeleteOpen(false);
      setSelectedExam(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Bank Soal"
        subtitle="Kelola dan kelompokkan soal untuk digunakan dalam ujian. Soal yang ditandai Publikasi akan tersedia untuk pembuatan ujian."
      >
        <button className={styles.primaryBtn} onClick={() => router.push('/dashboard/teacher/exams/builder')}>
          + Buat Soal Baru
        </button>
      </PageHeader>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryBlue}`}>Q</div>
          <div>
            <p>Total Soal</p>
            <strong>{summary.totalSoal}</strong>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryGreen}`}>P</div>
          <div>
            <p>Soal Publikasi</p>
            <strong>{summary.publikasi}</strong>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryAmber}`}>D</div>
          <div>
            <p>Soal Draft</p>
            <strong>{summary.draft}</strong>
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryPurple}`}>M</div>
          <div>
            <p>Jumlah Mapel</p>
            <strong>{summary.uniqueMapel}</strong>
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>S</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari judul soal, topik, atau kata kunci..."
            />
          </div>
          <button className={styles.filterBtn} onClick={() => setIsFilterOpen((prev) => !prev)}>
            Filter
          </button>
        </div>

        {isFilterOpen && (
          <div className={styles.filterRow}>
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="">Semua Mapel</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Semua Kelas</option>
              {classOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Semua Jenis</option>
              <option value="Pilihan Ganda">Pilihan Ganda</option>
              <option value="Esai">Esai</option>
              <option value="File Upload">File Upload</option>
              <option value="Campuran">Campuran</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua Status</option>
              <option value="published">Publikasi</option>
              <option value="draft">Draft</option>
            </select>
            <button className={styles.resetBtn} onClick={resetFilters}>
              Reset
            </button>
          </div>
        )}

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div>
              Memuat daftar bank soal...
            </div>
          ) : currentRows.length === 0 ? (
            <EmptyState title="Belum Ada Data Soal" description="Coba ubah filter atau buat soal baru untuk mulai mengisi bank soal." />
          ) : (
            <>
              <table className={styles.table}>
              <thead>
                <tr>
                  <th>Judul Soal</th>
                  <th>Mata Pelajaran</th>
                  <th>Kelas</th>
                  <th>Kategori</th>
                  <th>Jenis Soal</th>
                  <th>Approval</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row) => (
                  <tr key={row._id}>
                    <td data-label="Judul Soal">
                      <div className={styles.titleCell}>
                        <strong>{row.title}</strong>
                      </div>
                    </td>
                    <td data-label="Mata Pelajaran">
                      <span className={`${styles.mapelBadge} ${styles[getMapelColor(row.subjectName)]}`}>{row.subjectName}</span>
                    </td>
                    <td data-label="Kelas">
                      <span className={styles.classBadge}>{row.classCode}</span>
                    </td>
                    <td data-label="Kategori">{row.examCategory === 'semester' ? 'Ujian Semester' : 'Ulangan'}</td>
                    <td data-label="Jenis Soal">
                      <span className={styles.typeBadge}>{row.typeLabel}</span>
                    </td>
                    <td data-label="Approval">
                      {row.requiresCurriculumApproval ? row.validationStatus : 'Tidak Perlu'}
                    </td>
                    <td data-label="Status">
                      <span className={`${styles.statusBadge} ${row.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                        {row.status === 'published' ? 'Publikasi' : 'Draft'}
                      </span>
                    </td>
                    <td data-label="Dibuat">{new Date(row.createdAt).toLocaleDateString('id-ID')}</td>
                    <td data-label="Aksi">
                      <div className={styles.actionRow}>
                        <button
                          className={styles.iconBtn}
                          title="Lihat hasil ujian"
                          onClick={() => router.push(`/dashboard/teacher/exams/${row._id}/results`)}
                        >
                          V
                        </button>
                        <button
                          className={styles.iconBtn}
                          title="Edit soal"
                          disabled={row.status !== 'draft'}
                          onClick={() => row.status === 'draft' && router.push(`/dashboard/teacher/exams/builder?id=${row._id}`)}
                        >
                          E
                        </button>
                        <details className={styles.moreMenu}>
                          <summary className={styles.iconBtn}>...</summary>
                          <div className={styles.moreMenuContent}>
                            <button onClick={() => handleTogglePublish(row)} disabled={publishLoading === row._id}>
                              {publishLoading === row._id ? 'Memproses...' : row.status === 'published' ? 'Tarik ke Draft' : 'Publikasikan'}
                            </button>
                            <button
                              className={styles.dangerMenu}
                              onClick={() => {
                                setSelectedExam(row);
                                setIsDeleteOpen(true);
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile exam card list */}
            <div className={styles.mobileExamList}>
              {currentRows.map((row) => (
                <article key={`m-${row._id}`} className={styles.mobileExamCard}>
                  <div className={styles.mobileExamTop}>
                    <div className={styles.mobileExamBadges}>
                      <span className={`${styles.statusBadge} ${row.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                        {row.status === 'published' ? 'Publikasi' : 'Draft'}
                      </span>
                      <span className={`${styles.mapelBadge} ${styles[getMapelColor(row.subjectName)]}`}>{row.subjectName}</span>
                    </div>
                    <div className={styles.actionRow}>
                      <button
                        className={styles.iconBtn}
                        title="Lihat hasil ujian"
                        onClick={() => router.push(`/dashboard/teacher/exams/${row._id}/results`)}
                      >
                        V
                      </button>
                      <button
                        className={styles.iconBtn}
                        title="Edit soal"
                        disabled={row.status !== 'draft'}
                        onClick={() => row.status === 'draft' && router.push(`/dashboard/teacher/exams/builder?id=${row._id}`)}
                      >
                        E
                      </button>
                      <details className={styles.moreMenu}>
                        <summary className={styles.iconBtn}>...</summary>
                        <div className={styles.moreMenuContent}>
                          <button onClick={() => handleTogglePublish(row)} disabled={publishLoading === row._id}>
                            {publishLoading === row._id ? 'Memproses...' : row.status === 'published' ? 'Tarik ke Draft' : 'Publikasikan'}
                          </button>
                          <button
                            className={styles.dangerMenu}
                            onClick={() => {
                              setSelectedExam(row);
                              setIsDeleteOpen(true);
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                  <div className={styles.mobileExamTitle}>{row.title}</div>
                  <div className={styles.mobileExamMeta}>
                    <span className={styles.classBadge}>{row.classCode}</span>
                    <span className={styles.typeBadge}>{row.typeLabel}</span>
                    <span style={{fontSize:'0.78rem',color:'var(--color-subtext)'}}>{new Date(row.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                </article>
              ))}
            </div>
            </>
          )}
        </div>

        <div className={styles.pagination}>
          <p>
            Menampilkan {filteredRows.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filteredRows.length)} dari {filteredRows.length}{' '}
            soal
          </p>
          <div className={styles.paginationControls}>
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              {'<'}
            </button>
            <button className={styles.activePage}>{currentPage}</button>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
              {'>'}
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Hapus Soal"
        message={`Anda yakin ingin menghapus "${selectedExam?.title || ''}"? Data sesi ujian terkait juga akan terhapus.`}
        loading={deleteLoading}
      />
    </>
  );
}
