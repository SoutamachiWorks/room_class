'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './archive.module.css';

export default function ArchivePage() {
  const [enrolledYears, setEnrolledYears] = useState([]);
  const [currentYear, setCurrentYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchYears() {
      try {
        const res = await fetch('/api/student/materials');
        const data = await res.json();
        if (res.ok) {
          // Add a small delay to ensure smooth transition
          setEnrolledYears(data.enrolledYears || []);
          setCurrentYear(data.currentYear || null);
        }
      } catch (err) {
        console.error('Error fetching enrolled years:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchYears();
  }, []);

  // Now ALL entries in enrolledYears are actually archived history
  const archivedYears = enrolledYears;



  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className="spinner" aria-hidden="true" />
        <p>Memuat riwayat belajar...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </div>
        <div>
          <h1 className={styles.pageTitle}>Riwayat Belajar</h1>
          <p className={styles.pageSubtitle}>
            Akses arsip materi, tugas, dan nilai dari tahun ajaran sebelumnya.
            File unggahan tugas dibersihkan otomatis, namun nilai dan jawaban tetap tersimpan.
          </p>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className={styles.infoBanner}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bannerIcon} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <strong>Mode Baca-Saja:</strong> Data di halaman arsip tidak dapat diubah.
          File lampiran tugas dihapus otomatis saat kenaikan kelas untuk menghemat storage,
          namun <strong>nilai dan komentar guru tetap tersimpan</strong> secara permanen.
        </div>
      </div>

      {/* ── Current Year Card ── */}
      {currentYear && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Tahun Ajaran Aktif</h2>
          <div className={styles.currentCard}>
            <div className={styles.currentCardBadge}>Aktif</div>
            <div className={styles.currentCardInfo}>
              <div className={styles.currentCardYear}>{currentYear.label || currentYear.academicYear || currentYear.yearId}</div>
              <div className={styles.currentCardClass}>Kelas: <strong>{currentYear.classCode}</strong></div>
            </div>
            <Link href="/dashboard/student" className={styles.currentCardBtn}>
              Buka Dashboard →
            </Link>
          </div>
        </div>
      )}

      {/* ── Archived Years ── */}
      {archivedYears.length === 0 ? (
        <div className={styles.emptySection}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </div>
          <h3 className={styles.emptyTitle}>Belum Ada Arsip</h3>
          <p className={styles.emptyDesc}>
            Arsip tahun ajaran akan muncul di sini setelah Anda naik kelas.
          </p>
        </div>
      ) : (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Arsip Tahun Ajaran Lama</h2>
          <div className={styles.archiveGrid}>
            {archivedYears.slice().reverse().map((year) => (
              <div key={year.yearId} className={styles.archiveCard}>
                {/* Card Header */}
                <div className={styles.archiveCardHeader}>
                  <div className={styles.archiveCardYear}>
                    {year.label || year.academicYear || year.yearId}
                  </div>
                  <div className={styles.archiveCardClass}>
                    <span className={styles.classTag}>{year.classCode}</span>
                  </div>
                  {year.archivedAt && (
                    <div className={styles.archiveCardDate}>
                      Diarsipkan: {new Date(year.archivedAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.archiveAction}>
                  <Link 
                    href={`/dashboard/student/archive/${year.yearId}`} 
                    className={styles.openArchiveBtn}
                  >
                    Buka Detail Arsip &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
