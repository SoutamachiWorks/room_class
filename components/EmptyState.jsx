/**
 * EmptyState — Shared UI Kit Component
 *
 * A visually consistent placeholder shown when a list or area has no data.
 * Used across Admin, Teacher, and Student dashboards (25+ instances).
 *
 * Usage:
 *   import EmptyState from '@/components/EmptyState';
 *
 *   // Simple text-only
 *   <EmptyState description="Belum ada data." />
 *
 *   // With icon and title
 *   <EmptyState
 *     icon={<svg>...</svg>}
 *     title="Belum Ada Materi"
 *     description="Klik tombol di atas untuk menambahkan materi baru."
 *   />
 *
 *   // Compact (for inline use inside cards)
 *   <EmptyState compact description="Tidak ada siswa ditemukan." />
 *
 *   // With action button
 *   <EmptyState
 *     title="Belum Ada Ujian"
 *     description="Buat ujian pertama Anda."
 *     action={<button className={styles.btnPrimary}>Buat Ujian Baru</button>}
 *   />
 *
 * Props:
 *   icon        — JSX element (SVG recommended)
 *   title       — Heading text
 *   description — Body text
 *   action      — JSX element (button, link, etc.)
 *   compact     — boolean, smaller padding for inline areas
 *   className   — additional custom class
 */

import styles from './EmptyState.module.css';

// Default placeholder icon (inbox)
const DefaultIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className = '',
}) {
  const wrapperClasses = [
    styles.emptyState,
    compact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses}>
      {(icon !== undefined || !compact) && (
        <div className={styles.icon}>
          {icon || <DefaultIcon />}
        </div>
      )}

      {title && <p className={styles.title}>{title}</p>}
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
