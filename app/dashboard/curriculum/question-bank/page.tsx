'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import AcademicFilterBar from '@/components/dashboard/shared/AcademicFilterBar';
import QuestionBankTable from '@/components/dashboard/curriculum/QuestionBankTable';
import styles from '@/components/dashboard/dashboard-analytics.module.css';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Gagal memuat data.');
  return data;
};

function defaultFilters() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    academicYear: month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`,
    subjectId: 'all',
    status: 'all',
  };
}

export default function CurriculumQuestionBankPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [updatingId, setUpdatingId] = useState('');
  const params = useMemo(() => new URLSearchParams({
    academicYear: filters.academicYear,
    subjectId: filters.subjectId,
    status: filters.status,
  }).toString(), [filters]);

  const questionBank = useSWR(`/api/dashboard/curriculum/question-bank?${params}`, fetcher);
  const subjects = useMemo(() => {
    const map = new Map<string, { subjectId: string; subjectName: string }>();
    for (const row of questionBank.data?.data || []) {
      if (row.subjectId) map.set(row.subjectId, { subjectId: row.subjectId, subjectName: row.subjectName });
    }
    return Array.from(map.values());
  }, [questionBank.data]);

  const updateStatus = async (id: string, action: 'approve' | 'revision', revisionNote = '') => {
    setUpdatingId(id);
    const previous = questionBank.data;
    questionBank.mutate({
      ...previous,
      data: (previous?.data || []).map((row: any) => row._id === id ? {
        ...row,
        status: action === 'approve' ? 'Approved' : 'NeedsRevision',
        revisionNote: action === 'revision' ? revisionNote : null,
      } : row),
    }, false);

    try {
      const res = await fetch(`/api/dashboard/curriculum/question-bank/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, revisionNote }),
      });
      if (!res.ok) throw new Error('Update status gagal.');
      await questionBank.mutate();
    } catch {
      questionBank.mutate(previous, false);
      alert('Gagal memperbarui status bank soal.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Kepala Kurikulum</div>
          <h1 className={styles.title}>Validasi Bank Soal</h1>
          <p className={styles.subtitle}>Approve atau reject bank soal yang dibuat guru.</p>
        </div>
      </div>

      <section className={styles.card}>
        <AcademicFilterBar filters={filters} onChange={setFilters} subjects={subjects} showSubject showStatus />
        <div className={styles.sectionGap} />
        <QuestionBankTable
          data={questionBank.data?.data}
          loading={questionBank.isLoading}
          error={questionBank.error?.message}
          updatingId={updatingId}
          onApprove={(id) => updateStatus(id, 'approve')}
          onRevision={(id) => {
            const note = window.prompt('Masukkan catatan revisi soal (wajib):', '');
            if (!note || !note.trim()) return;
            updateStatus(id, 'revision', note.trim());
          }}
        />
      </section>
    </div>
  );
}
