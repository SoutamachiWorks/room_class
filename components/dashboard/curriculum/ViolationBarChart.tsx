'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EmptyState from '@/components/EmptyState';
import styles from '../dashboard-analytics.module.css';

type Row = {
  subjectName: string;
  classCode: string;
  totalViolations: number;
  totalExams: number;
  violationRate: number;
};

export default function ViolationBarChart({ data = [], loading, error }: { data?: Row[]; loading?: boolean; error?: string }) {
  if (loading) return <div className={styles.skeleton} />;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data.length) return <EmptyState compact icon={null} action={null} title="Belum ada data untuk periode ini" description="Pelanggaran ujian akan muncul setelah siswa mengikuti ujian." />;

  const max = Math.max(...data.map((item) => item.totalViolations), 1);

  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 12, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" allowDecimals={false} stroke="var(--color-subtext)" />
          <YAxis type="category" dataKey="subjectName" width={120} stroke="var(--color-subtext)" />
          <Tooltip
            formatter={(value, name, props) => [
              `${value} pelanggaran (${props.payload.violationRate}%)`,
              'Total',
            ]}
            labelFormatter={(label) => `Mata pelajaran: ${label}`}
          />
          <Bar dataKey="totalViolations" radius={[0, 8, 8, 0]}>
            {data.map((entry) => {
              const ratio = entry.totalViolations / max;
              const color = ratio > 0.66 ? '#dc3545' : ratio > 0.33 ? '#f59e0b' : '#facc15';
              return <Cell key={entry.subjectName} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
