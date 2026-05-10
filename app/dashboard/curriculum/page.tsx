'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import AcademicFilterBar from '@/components/dashboard/shared/AcademicFilterBar';
import ViolationBarChart from '@/components/dashboard/curriculum/ViolationBarChart';
import AvgScoreChart from '@/components/dashboard/curriculum/AvgScoreChart';
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
    subjectId: 'all',
    status: 'all',
  };
}

export default function CurriculumDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState(defaultFilters);
  const params = useMemo(() => {
    const query = new URLSearchParams({
      academicYear: filters.academicYear,
    });
    return query.toString();
  }, [filters.academicYear]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (data?.user?.role !== 'curriculum') router.replace('/unauthorized');
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

  const violations = useSWR(`/api/dashboard/curriculum/violations?${params}`, fetcher);
  const scores = useSWR(`/api/dashboard/curriculum/avg-scores?${params}`, fetcher);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Kurikulum</div>
          <h1 className={styles.title}>Dashboard Analitik Kurikulum</h1>
          <p className={styles.subtitle}>Ringkasan statistik kurikulum. Detail siswa, nilai, dan validasi tersedia di modul sidebar.</p>
        </div>
      </div>

      <AcademicFilterBar filters={filters} onChange={setFilters} />

      <div className={styles.gridTwo}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Pelanggaran per Mata Pelajaran</h2>
              <p className={styles.cardSubtitle}>Diurutkan dari jumlah pelanggaran tertinggi.</p>
            </div>
          </div>
          <ViolationBarChart data={violations.data?.data} loading={violations.isLoading} error={violations.error?.message} />
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Rata-rata Nilai</h2>
              <p className={styles.cardSubtitle}>Batas kelulusan memakai KKM {scores.data?.kkm || 75}.</p>
            </div>
          </div>
          <AvgScoreChart data={scores.data?.data} kkm={scores.data?.kkm} loading={scores.isLoading} error={scores.error?.message} />
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Modul Kepala Kurikulum</h2>
            <p className={styles.cardSubtitle}>Akses cepat ke pekerjaan detail kurikulum.</p>
          </div>
        </div>
        <div className={styles.moduleGrid}>
          <Link href="/dashboard/curriculum/active-users" className={styles.moduleLink}>
            <div className={styles.primaryText}>Daftar Siswa dan Guru Aktif</div>
            <div className={styles.muted}>Pantau data aktif siswa dan guru.</div>
          </Link>
          <Link href="/dashboard/curriculum/scores" className={styles.moduleLink}>
            <div className={styles.primaryText}>Nilai per Mata Pelajaran</div>
            <div className={styles.muted}>Rata-rata nilai siswa per mapel.</div>
          </Link>
          <Link href="/dashboard/curriculum/question-bank" className={styles.moduleLink}>
            <div className={styles.primaryText}>Validasi Bank Soal</div>
            <div className={styles.muted}>Approve atau reject bank soal guru.</div>
          </Link>
        </div>
      </section>
    </div>
  );
}
