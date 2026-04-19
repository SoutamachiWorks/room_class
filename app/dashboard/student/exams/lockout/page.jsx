'use client';

import { useRouter } from 'next/navigation';
import styles from '../../../admin/admin.module.css';

export default function ExamLockoutPage() {
  const router = useRouter();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <div className={styles.contentCard} style={{
        padding: '48px',
        textAlign: 'center',
        maxWidth: '520px',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: '#FEE2E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 36, height: 36 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#DC2626',
          marginBottom: '12px',
        }}>
          Sesi Ujian Terkunci
        </h1>

        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--color-text)',
          lineHeight: 1.7,
          marginBottom: '8px',
        }}>
          Anda telah dikeluarkan dari sesi ujian ini karena meninggalkan tab ujian lebih dari 2 kali.
        </p>

        <p style={{
          fontSize: '0.875rem',
          color: 'var(--color-subtext)',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}>
          Sesi yang terkunci tidak dapat dilanjutkan. Silakan hubungi guru Anda untuk informasi lebih lanjut.
        </p>

        <button
          className={styles.btnPrimary}
          style={{ padding: '12px 28px' }}
          onClick={() => router.push('/dashboard/student/exams')}
        >
          Kembali ke Daftar Ujian
        </button>
      </div>
    </div>
  );
}
