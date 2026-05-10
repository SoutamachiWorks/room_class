'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import AcademicFilterBar from '@/components/dashboard/shared/AcademicFilterBar';
import ExportCenter from '@/components/dashboard/principal/ExportCenter';
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

export default function PrincipalScoresPage() {
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
  const { data, isLoading, error } = useSWR(`/api/dashboard/principal/scores?${params}`, fetcher);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Sekolah</div>
          <h1 className={styles.title}>Nilai Siswa per Ujian</h1>
          <p className={styles.subtitle}>Lihat nilai setiap ujian dan export rekap nilai.</p>
        </div>
      </div>

      <AcademicFilterBar filters={filters} onChange={setFilters} />

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Export Nilai</h2>
            <p className={styles.cardSubtitle}>Export Excel atau PDF dari periode yang dipilih.</p>
          </div>
        </div>
        <ExportCenter filters={filters} />
      </section>

      <section className={styles.card}>
        <input className={styles.input} placeholder="Cari siswa, kelas, ujian, atau mata pelajaran" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ height: 16 }} />
        {isLoading && <div className={styles.skeleton} />}
        {error && <div className={styles.error}>{error.message}</div>}
        {!isLoading && !error && (
          isMobile ? (
            <div className={mobileStyles.cardList}>
              {(data?.data || []).map((row: any) => (
                <div key={row._id} className={mobileStyles.card}>
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
                      <span className={mobileStyles.metaLabel}>Ujian</span>
                      <span className={mobileStyles.metaValue}>{row.examTitle || '-'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Mata Pelajaran</span>
                      <span className={mobileStyles.metaValue}>{row.subjectName || '-'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Nilai</span>
                      <span className={`${mobileStyles.metaValue} ${mobileStyles.bold}`}>{row.score}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Status</span>
                      <span className={mobileStyles.metaValue}>{row.status}</span>
                    </div>
                    <div className={`${mobileStyles.metaItem} ${mobileStyles.fullWidth}`}>
                      <span className={mobileStyles.metaLabel}>Dikumpulkan</span>
                      <span className={mobileStyles.metaValue}>
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString('id-ID') : '-'}
                      </span>
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
                    <th>Ujian</th>
                    <th>Mata Pelajaran</th>
                    <th>Nilai</th>
                    <th>Status</th>
                    <th>Dikumpulkan</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data || []).map((row: any) => (
                    <tr key={row._id}>
                      <td>{row.nis}</td>
                      <td className={styles.primaryText}>{row.studentName}</td>
                      <td>{row.classCode || '-'}</td>
                      <td>{row.examTitle || '-'}</td>
                      <td>{row.subjectName || '-'}</td>
                      <td className={styles.primaryText}>{row.score}</td>
                      <td>{row.status}</td>
                      <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString('id-ID') : '-'}</td>
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
