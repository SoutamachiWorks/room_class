'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from '@/components/dashboard/dashboard-analytics.module.css';
import mobileStyles from './mobile.module.css';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Gagal memuat data.');
  return data;
};

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

export default function CurriculumActiveUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const isMobile = useIsMobile(640);
  const params = useMemo(() => new URLSearchParams({ search, role }).toString(), [search, role]);
  const { data, isLoading, error } = useSWR(`/api/dashboard/active-users?${params}`, fetcher);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Kurikulum</div>
          <h1 className={styles.title}>Daftar Siswa dan Guru Aktif</h1>
          <p className={styles.subtitle}>Data aktif untuk kebutuhan pemantauan kurikulum.</p>
        </div>
      </div>

      <div className={styles.gridTwo}>
        <section className={`${styles.card} ${styles.summaryCard}`}>
          <div>
            <div className={styles.summaryValue}>{data?.summary?.students || 0}</div>
            <div className={styles.primaryText}>Siswa Aktif</div>
          </div>
        </section>
        <section className={`${styles.card} ${styles.summaryCard}`}>
          <div>
            <div className={styles.summaryValue}>{data?.summary?.teachers || 0}</div>
            <div className={styles.primaryText}>Guru Aktif</div>
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.searchRow}>
          <input className={styles.input} placeholder="Cari nama, NIS/NIP, username, atau kelas" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">Semua Role</option>
            <option value="student">Siswa</option>
            <option value="teacher">Guru</option>
          </select>
        </div>

        {isLoading && <div className={styles.skeleton} />}
        {error && <div className={styles.error}>{error.message}</div>}
        {!isLoading && !error && (
          isMobile ? (
            <div className={mobileStyles.cardList}>
              {(data?.users || []).map((user: any) => (
                <div key={user._id} className={mobileStyles.card}>
                  <div className={mobileStyles.cardName}>{user.fullName || '-'}</div>
                  <div className={mobileStyles.metaGrid}>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Role</span>
                      <span className={mobileStyles.metaValue}>{user.role === 'student' ? 'Siswa' : 'Guru'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>ID</span>
                      <span className={mobileStyles.metaValue}>{user.studentId || user.teacherId || '-'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Kelas</span>
                      <span className={mobileStyles.metaValue}>{user.classCode || '-'}</span>
                    </div>
                    <div className={mobileStyles.metaItem}>
                      <span className={mobileStyles.metaLabel}>Username</span>
                      <span className={mobileStyles.metaValue}>{user.username || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(data?.users || []).length === 0 && (
                <div className={mobileStyles.empty}>Tidak ada data pengguna aktif.</div>
              )}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Role</th>
                    <th>ID</th>
                    <th>Kelas</th>
                    <th>Username</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users || []).map((user: any) => (
                    <tr key={user._id}>
                      <td className={styles.primaryText}>{user.fullName || '-'}</td>
                      <td>{user.role === 'student' ? 'Siswa' : 'Guru'}</td>
                      <td>{user.studentId || user.teacherId || '-'}</td>
                      <td>{user.classCode || '-'}</td>
                      <td>{user.username || '-'}</td>
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
