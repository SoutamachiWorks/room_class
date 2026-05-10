'use client';

import styles from '../dashboard-analytics.module.css';

type Filters = {
  academicYear: string;
};

export default function ExportCenter({ filters }: { filters: Filters }) {
  const download = async (format: 'excel' | 'pdf') => {
    const params = new URLSearchParams({
      format,
      academicYear: filters.academicYear,
    });
    const res = await fetch(`/api/dashboard/principal/export?${params}`);
    if (!res.ok) throw new Error('Export gagal.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rekap-nilai-${filters.academicYear.replace('/', '-')}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.exportPanel}>
      <div className={styles.exportFilters}>
        <label className={styles.field}>
          <span className={styles.label}>Tahun Ajaran</span>
          <input className={styles.select} value={filters.academicYear} readOnly />
        </label>
      </div>
      <div className={styles.exportActions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => download('excel')}>Download Excel</button>
        <button className={styles.button} onClick={() => download('pdf')}>Download PDF</button>
      </div>
    </div>
  );
}
