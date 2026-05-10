'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import AcademicFilterBar from '@/components/dashboard/shared/AcademicFilterBar';
import ActivityLog from '@/components/dashboard/principal/ActivityLog';
import SummaryCards from '@/components/dashboard/principal/SummaryCards';
import styles from '@/components/dashboard/dashboard-analytics.module.css';

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

export default function PrincipalDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState(defaultFilters);
  const params = useMemo(() => {
    const query = new URLSearchParams({
      academicYear: filters.academicYear,
    });
    return query.toString();
  }, [filters]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (data?.user?.role !== 'principal') router.replace('/unauthorized');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

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

  const summary = useSWR(`/api/dashboard/principal/summary?${params}`, fetcher);
  const activity = useSWR(`/api/dashboard/principal/activity-log?${params}`, fetcher, {
    refreshInterval: 60000,
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Sekolah</div>
          <h1 className={styles.title}>Executive Dashboard</h1>
          <p className={styles.subtitle}>Ringkasan performa ujian dan aktivitas terbaru. Detail tersedia di modul sidebar.</p>
        </div>
      </div>

      <AcademicFilterBar filters={filters} onChange={setFilters} />

      <SummaryCards cards={summary.data?.cards} loading={summary.isLoading} error={summary.error?.message} />

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Modul Kepala Sekolah</h2>
            <p className={styles.cardSubtitle}>Akses cepat ke data operasional yang lebih detail.</p>
          </div>
        </div>
        <div className={styles.moduleGrid}>
          <Link href="/dashboard/principal/active-users" className={styles.moduleLink}>
            <div className={styles.primaryText}>Daftar Siswa dan Guru Aktif</div>
            <div className={styles.muted}>Pantau akun aktif siswa dan guru.</div>
          </Link>
          <Link href="/dashboard/principal/scores" className={styles.moduleLink}>
            <div className={styles.primaryText}>Nilai Siswa per Ujian</div>
            <div className={styles.muted}>Lihat nilai ujian dan export laporan.</div>
          </Link>
          <Link href="/dashboard/principal/activity" className={styles.moduleLink}>
            <div className={styles.primaryText}>Log Aktivitas RoomClass</div>
            <div className={styles.muted}>Ujian, tugas, dan materi terbaru.</div>
          </Link>
        </div>
      </section>

      <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Log Aktivitas Kecil</h2>
              <p className={styles.cardSubtitle}>10 aktivitas ujian terbaru, refresh otomatis setiap 60 detik.</p>
            </div>
          </div>
          <div className={styles.compactList}>
            <ActivityLog activities={activity.data?.activities} loading={activity.isLoading} error={activity.error?.message} />
          </div>
      </section>
    </div>
  );
}
