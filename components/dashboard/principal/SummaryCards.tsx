'use client';

import styles from '../dashboard-analytics.module.css';

const icons = {
  students: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  completed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  passRate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
};

export default function SummaryCards({ cards = [], loading, error }: { cards?: any[]; loading?: boolean; error?: string }) {
  if (loading) {
    return (
      <div className={styles.gridThree}>
        {[0, 1, 2].map((item) => <div key={item} className={`${styles.card} ${styles.skeleton}`} />)}
      </div>
    );
  }

  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.gridThree}>
      {cards.map((card) => (
        <article key={card.key} className={`${styles.card} ${styles.summaryCard}`}>
          <div className={styles.summaryIcon}>{icons[card.key as keyof typeof icons]}</div>
          <div>
            <div className={styles.summaryValue}>{card.value?.toLocaleString('id-ID')}{card.suffix || ''}</div>
            <div className={styles.primaryText}>{card.label}</div>
            <div className={card.delta >= 0 ? styles.deltaUp : styles.deltaDown}>
              {card.delta >= 0 ? '+' : ''}{card.delta}% vs semester lalu
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
