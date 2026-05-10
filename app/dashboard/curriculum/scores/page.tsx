'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import AcademicFilterBar from '@/components/dashboard/shared/AcademicFilterBar';
import styles from '@/components/dashboard/dashboard-analytics.module.css';
import mobileStyles from './mobile.module.css';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Gagal memuat data.');
  return data;
};

function defaultFilters() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    academicYear: month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`,
  };
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function CurriculumScoresPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile(640);

  useEffect(() => {
    fetch('/api/dashboard/academic-years')
      .then((res) => res.json())
      .then((data) => {
        if (data?.activeAcademicYear) {
          setFilters((prev) => ({ ...prev, academicYear: data.activeAcademicYear }));
        }
      })
      .catch(() => {});
  }, []);

  const params = useMemo(() => new URLSearchParams({
    academicYear: filters.academicYear,
    search,
  }).toString(), [filters, search]);
  const { data, isLoading, error } = useSWR(`/api/dashboard/curriculum/scores?${params}`, fetcher);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Kurikulum</div>
          <h1 className={styles.title}>Nilai Siswa per Mata Pelajaran</h1>
          <p className={styles.subtitle}>Rata-rata nilai siswa per mapel dari semua ujian yang sudah dinilai.</p>
        </div>
      </div>

      <AcademicFilterBar filters={filters} onChange={setFilters} />

      <section className={styles.card}>
        <input className={styles.input} placeholder="Cari siswa, kelas, atau mata pelajaran" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ height: 16 }} />
        {isLoading && <div className={styles.skeleton} />}
        {error && <div className={styles.error}>{error.message}</div>}
        {!isLoading && !error && (
          isMobile ? (
            <div className={mobileStyles.cardList}>
              {(data?.data || []).map((row: any) => (
                <div key={`${row.nis}-${row.subjectName}`} className={mobileStyles.card}>
                  <div className={mobileStyles.cardName}>{row.studentName}</div>
                  <div className={mobileStyles.metaGrid}>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>NIS</span>
                      <span className={mobileStyles.metaValue}>{row.nis}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Kelas</span>
                      <span className={mobileStyles.metaValue}>{row.classCode || '-'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Mata Pelajaran</span>
                      <span className={mobileStyles.metaValue}>{row.subjectName || '-'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Jumlah Ujian</span>
                      <span className={mobileStyles.metaValue}>{row.examCount}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Nilai</span>
                      <span className={`${mobileStyles.metaValue} ${mobileStyles.bold}`}>{row.score}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Status</span>
                      <span className={mobileStyles.metaValue}>{row.status}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(data?.data || []).length === 0 && (
                <div className={mobileStyles.empty}>Tidak ada data nilai untuk periode ini.</div>
              )}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.wideTable}`}>
                <thead>
                  <tr>
                    <th>NIS</th>
                    <th>Nama</th>
                    <th>Kelas</th>
                    <th>Mata Pelajaran</th>
                    <th>Jumlah Ujian</th>
                    <th>Nilai</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data || []).map((row: any) => (
                    <tr key={`${row.nis}-${row.subjectName}`}>
                      <td>{row.nis}</td>
                      <td className={styles.primaryText}>{row.studentName}</td>
                      <td>{row.classCode || '-'}</td>
                      <td>{row.subjectName || '-'}</td>
                      <td>{row.examCount}</td>
                      <td className={styles.primaryText}>{row.score}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </div>
  );
}
