/**
 * StatusBadge — Shared UI Kit Component
 *
 * A versatile badge component used across Admin, Teacher, and Student dashboards.
 * Consumes CSS variables from the global design system for automatic dark mode support.
 *
 * Usage:
 *   import StatusBadge from '@/components/StatusBadge';
 *
 *   <StatusBadge variant="admin">Admin</StatusBadge>
 *   <StatusBadge variant="success" size="lg">Aktif</StatusBadge>
 *   <StatusBadge variant="hadir" pill>Hadir</StatusBadge>
 *   <StatusBadge variant="danger" outlined>Gagal</StatusBadge>
 *
 * Props:
 *   variant  — 'admin' | 'teacher' | 'student' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'
 *              | 'hadir' | 'sakit' | 'izin' | 'alpa'
 *   size     — 'sm' | 'md' (default) | 'lg'
 *   pill     — boolean, fully rounded corners
 *   outlined — boolean, transparent bg with border
 *   className — additional custom class
 *   children — badge text content
 */

import styles from './StatusBadge.module.css';

export default function StatusBadge({
  variant = 'neutral',
  size,
  pill = false,
  outlined = false,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    styles.badge,
    styles[variant],
    size && styles[size],
    pill && styles.pill,
    outlined && styles.outlined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
