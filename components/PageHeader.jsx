/**
 * PageHeader — Shared Layout UI Kit Component
 *
 * Consistent page header used across all dashboard modules.
 * Provides title, optional subtitle, and actions slot.
 *
 * Usage:
 *   import PageHeader from '@/components/PageHeader';
 *
 *   <PageHeader title="Manajemen Akun">
 *     <button>Tambah Guru</button>
 *   </PageHeader>
 *
 *   <PageHeader title="Bank Ujian" subtitle="Kelola ujian untuk semua kelas Anda.">
 *     <button>Buat Ujian Baru</button>
 *   </PageHeader>
 *
 * Props:
 *   title     — Main heading (string or JSX)
 *   subtitle  — Optional secondary text
 *   children  — Action buttons placed on the right
 *   className — Additional custom class
 */

import styles from './PageHeader.module.css';

export default function PageHeader({
  title,
  subtitle,
  children,
  className = '',
}) {
  return (
    <div className={`${styles.pageHeader} ${className}`}>
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
