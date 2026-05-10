'use client';

import EmptyState from '@/components/EmptyState';
import styles from '../dashboard-analytics.module.css';

export default function ActivityLog({ activities = [], loading, error }: { activities?: any[]; loading?: boolean; error?: string }) {
  if (loading) return <div className={styles.skeleton} />;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!activities.length) return <EmptyState compact icon={null} action={null} title="Belum ada data untuk periode ini" description="Aktivitas ujian terbaru akan tampil otomatis." />;

  return (
    <div className={styles.activityList}>
      {activities.map((activity, index) => (
        <div key={`${activity.timestamp}-${index}`} className={styles.activityItem}>
          <span className={styles.activityDot} />
          <div>
            <div className={styles.primaryText}>{activity.title}</div>
            <div className={styles.muted}>{activity.detail}</div>
            <div className={styles.muted}>
              {activity.timestamp ? new Date(activity.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
