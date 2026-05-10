'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EmptyState from '@/components/EmptyState';
import styles from '../dashboard-analytics.module.css';

type Row = {
  subjectName: string;
  averageScore: number;
  participants: number;
  passRate: number;
  kkm: number;
};

export default function AvgScoreChart({ data = [], kkm = 75, loading, error }: { data?: Row[]; kkm?: number; loading?: boolean; error?: string }) {
  if (loading) return <div className={styles.skeleton} />;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!data.length) return <EmptyState compact icon={null} action={null} title="Belum ada data untuk periode ini" description="Rata-rata nilai akan muncul setelah ujian dinilai." />;

  return (
    <div className={styles.chartBox}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="subjectName" stroke="var(--color-subtext)" />
          <YAxis domain={[0, 100]} stroke="var(--color-subtext)" />
          <Tooltip
            formatter={(value, name, props) => [
              name === 'averageScore'
                ? `${value} (${props.payload.passRate}% lulus, ${props.payload.participants} peserta)`
                : value,
              'Rata-rata nilai',
            ]}
          />
          <ReferenceLine y={kkm} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `KKM ${kkm}`, fill: '#f59e0b', fontSize: 12 }} />
          <Bar dataKey="averageScore" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.subjectName} fill={entry.averageScore >= kkm ? '#198754' : '#dc3545'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
