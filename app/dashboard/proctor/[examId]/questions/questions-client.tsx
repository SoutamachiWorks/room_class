'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import styles from './questions.module.css';

type QuestionItem = {
  order: number;
  imageUrl: string | null;
  multipleChoice: { questionText: string; options: string[] } | null;
  essay: { questionText: string } | null;
  fileUpload: { questionText: string } | null;
};

function getTypes(question: QuestionItem) {
  return [
    question.multipleChoice ? 'Pilihan Ganda' : null,
    question.essay ? 'Esai' : null,
    question.fileUpload ? 'File Upload' : null,
  ].filter(Boolean) as string[];
}

export default function QuestionsClient({ examId }: { examId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examTitle, setExamTitle] = useState('Ujian');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/proctor/exams/${examId}/questions`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat soal ujian');

        setExamTitle(data?.exam?.title || 'Ujian');
        setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat soal ujian');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [examId]);

  const summary = useMemo(() => {
    const multipleChoice = questions.filter((q) => q.multipleChoice).length;
    const essay = questions.filter((q) => q.essay).length;
    const fileUpload = questions.filter((q) => q.fileUpload).length;
    return { multipleChoice, essay, fileUpload };
  }, [questions]);

  return (
    <section className={styles.wrapper}>
      <PageHeader title={`${examTitle} - Soal Ujian`} subtitle="Tampilan read-only untuk verifikasi soal oleh pengawas.">
        <div className={styles.headerActions}>
          <Link href={`/dashboard/proctor/${examId}/monitoring`} className={styles.backBtn}>Kembali ke Monitoring</Link>
          <Link href="/dashboard/proctor" className={styles.backBtn}>Daftar Pengawasan</Link>
        </div>
      </PageHeader>

      {loading && <p className={styles.muted}>Memuat soal ujian...</p>}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && questions.length === 0 && <p className={styles.muted}>Belum ada soal pada ujian ini.</p>}

      {!loading && !error && questions.length > 0 && (
        <>
          <div className={styles.summaryGrid}>
            <article><span>Total Soal</span><strong>{questions.length}</strong></article>
            <article><span>Pilihan Ganda</span><strong>{summary.multipleChoice}</strong></article>
            <article><span>Esai</span><strong>{summary.essay}</strong></article>
            <article><span>File Upload</span><strong>{summary.fileUpload}</strong></article>
          </div>

          <div className={styles.auditLayout}>
            <aside className={styles.indexPanel}>
              <h3>Navigasi Soal</h3>
              <div className={styles.indexList}>
                {questions.map((q) => (
                  <a key={q.order} href={`#question-${q.order}`}>Soal {q.order}</a>
                ))}
              </div>
            </aside>

            <div className={styles.list}>
              {questions.map((q) => {
                const types = getTypes(q);
                return (
                  <article id={`question-${q.order}`} key={q.order} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div>
                        <span className={styles.questionNumber}>Soal {q.order}</span>
                        <h3>{types.length > 1 ? 'Soal Campuran' : types[0] || 'Soal'}</h3>
                      </div>
                      <div className={styles.typeRow}>
                        {types.map((type) => <span key={type}>{type}</span>)}
                      </div>
                    </div>

                    {q.imageUrl && <img src={q.imageUrl} alt={`Soal ${q.order}`} className={styles.image} />}

                    {q.multipleChoice && (
                      <section className={styles.questionBlock}>
                        <p className={styles.questionText}>{q.multipleChoice.questionText}</p>
                        <ol className={styles.options}>
                          {q.multipleChoice.options.map((opt, idx) => (
                            <li key={idx}>{opt}</li>
                          ))}
                        </ol>
                      </section>
                    )}

                    {q.essay && (
                      <section className={styles.questionBlock}>
                        <span className={styles.label}>Esai</span>
                        <p className={styles.questionText}>{q.essay.questionText}</p>
                      </section>
                    )}

                    {q.fileUpload && (
                      <section className={styles.questionBlock}>
                        <span className={styles.label}>File Upload</span>
                        <p className={styles.questionText}>{q.fileUpload.questionText}</p>
                      </section>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
