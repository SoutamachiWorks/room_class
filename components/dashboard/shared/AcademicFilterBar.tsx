'use client';

import { useEffect, useState } from 'react';
import styles from '../dashboard-analytics.module.css';

type Props = {
  filters: {
    academicYear: string;
    subjectId?: string;
    status?: string;
  };
  onChange: (next: any) => void;
  subjects?: Array<{ subjectId?: string; _id?: string; subjectName: string }>;
  showSubject?: boolean;
  showStatus?: boolean;
};

function fallbackAcademicYearOptions() {
  const year = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => {
    const start = year - 2 + index;
    return `${start}/${start + 1}`;
  });
}

export default function AcademicFilterBar({
  filters,
  onChange,
  subjects = [],
  showSubject = false,
  showStatus = false,
}: Props) {
  const [yearOptions, setYearOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/academic-years')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const next = Array.isArray(data?.academicYears) ? data.academicYears.filter(Boolean) : [];
        setYearOptions(next);
      })
      .catch(() => {
        if (cancelled) return;
        setYearOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const options = yearOptions.length ? yearOptions : fallbackAcademicYearOptions();

  const update = (key: keyof Props['filters'], value: string | number) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className={styles.filterBar}>
      <label className={styles.field}>
        <span className={styles.label}>Tahun Ajaran</span>
        <select className={styles.select} value={filters.academicYear} onChange={(e) => update('academicYear', e.target.value)}>
          {options.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </label>
      {showSubject && (
        <label className={styles.field}>
          <span className={styles.label}>Mata Pelajaran</span>
          <select className={styles.select} value={filters.subjectId || 'all'} onChange={(e) => update('subjectId', e.target.value)}>
            <option value="all">Semua</option>
            {subjects.map((subject) => {
              const id = subject.subjectId || subject._id || subject.subjectName;
              return <option key={id} value={id}>{subject.subjectName}</option>;
            })}
          </select>
        </label>
      )}

      {showStatus && (
        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select className={styles.select} value={filters.status || 'all'} onChange={(e) => update('status', e.target.value)}>
            <option value="all">Semua</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="NeedsRevision">Needs Revision</option>
            <option value="NotRequired">Tanpa Approval</option>
          </select>
        </label>
      )}
    </div>
  );
}
