'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import styles from '@/components/dashboard/dashboard-analytics.module.css';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Gagal memuat data.');
  return data;
};

export default function PrincipalActivityPage() {
  const [search, setSearch] = useState('');
  const params = useMemo(() => new URLSearchParams({ search }).toString(), [search]);
  const { data, isLoading, error } = useSWR(`/api/dashboard/principal/development-log?${params}`, fetcher, {
    refreshInterval: 60000,
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Sekolah</div>
          <h1 className={styles.title}>Log Aktivitas Pengembangan RoomClass</h1>
          <p className={styles.subtitle}>Pantau pembuatan ujian, tugas, dan materi terbaru.</p>
        </div>
      </div>

      <section className={styles.card}>
        <input className={styles.input} placeholder="Cari judul ujian, tugas, atau materi" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ height: 16 }} />
        {isLoading && <div className={styles.skeleton} />}
        {error && <div className={styles.error}>{error.message}</div>}
        {!isLoading && !error && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Judul</th>
                  <th>Mata Pelajaran</th>
                  <th>Kelas</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs || []).map((log: any) => (
                  <tr key={`${log.type}-${log._id}`}>
                    <td>{log.type}</td>
                    <td className={styles.primaryText}>{log.title || '-'}</td>
                    <td>{log.subjectName || '-'}</td>
                    <td>{log.classCode || '-'}</td>
                    <td>{log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
