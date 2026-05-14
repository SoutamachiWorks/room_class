'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../../../admin/admin.module.css';

export default function ExamLockoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const isDisqualified = reason === 'disqualified';

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
          {isDisqualified ? 'Siswa Didiskualifikasi' : 'Sesi Ujian Terkunci'}
        </h1>

        <p className={styles.lockoutBody}>
          {isDisqualified
            ? 'Anda didiskualifikasi dari ujian ini oleh guru atau pengawas.'
            : 'Anda telah dikeluarkan dari sesi ujian ini karena sesi dikunci oleh sistem, guru, atau pengawas.'}
        </p>

        <p className={styles.lockoutHint}>
          {isDisqualified
            ? 'Status diskualifikasi bersifat final. Silakan hubungi guru Anda untuk informasi lebih lanjut.'
            : 'Sesi yang terkunci tidak dapat dilanjutkan sampai guru membuka akses kembali.'}
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
