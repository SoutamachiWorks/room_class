'use client';

import { useRouter } from 'next/navigation';
import styles from '../../../admin/admin.module.css';

export default function ExamLockoutPage() {
  const router = useRouter();

  return (
    <div className={styles.lockoutWrapper}>
      <div className={`${styles.contentCard} ${styles.lockoutCard}`}>
        <div className={styles.lockoutIconCircle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.lockoutIcon}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 className={styles.lockoutTitle}>
          Sesi Ujian Terkunci
        </h1>

        <p className={styles.lockoutBody}>
          Anda telah dikeluarkan dari sesi ujian ini karena meninggalkan tab ujian lebih dari 2 kali.
        </p>

        <p className={styles.lockoutHint}>
          Sesi yang terkunci tidak dapat dilanjutkan. Silakan hubungi guru Anda untuk informasi lebih lanjut.
        </p>

        <button
          className={`${styles.btnPrimary} ${styles.lockoutBtn}`}
          onClick={() => router.push('/dashboard/student/exams')}
        >
          Kembali ke Daftar Ujian
        </button>
      </div>
    </div>
  );
}
