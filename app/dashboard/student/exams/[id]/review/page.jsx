'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './review.module.css';

function normalizeAnswerSet(value) {
  if (Array.isArray(value)) return value.map((item) => Number(item)).sort((a, b) => a - b);
  return value === null || value === undefined ? [] : [Number(value)];
}

function formatOptionKeys(value) {
  const selected = normalizeAnswerSet(value);
  return selected.length ? selected.map((idx) => String.fromCharCode(65 + idx)).join(', ') : '-';
}

export default function StudentExamReviewPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    async function fetchReview() {
      try {
        const res = await fetch(`/api/student/exams/${examId}/review`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Gagal memuat evaluasi ujian.');
          return;
        }
        setPayload(data);
      } catch {
        setError('Koneksi ke server gagal.');
      } finally {
        setLoading(false);
      }
    }

    if (examId) fetchReview();
  }, [examId]);

  if (loading) {
    return <div className={styles.loading}>Memuat evaluasi ujian...</div>;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error}</div>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/student/exams')}>Kembali</button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Evaluasi Ujian</div>
          <h1 className={styles.title}>{payload?.exam?.title || 'Evaluasi Ujian'}</h1>
          <p className={styles.subtitle}>
            Lihat jawaban Anda, kunci jawaban benar, dan pembahasan untuk bahan evaluasi.
          </p>
        </div>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard/student/exams')}>Kembali</button>
      </div>

      <div className={styles.list}>
        {(payload?.review || []).map((row) => {
          const mc = row.multipleChoice;
          const yourMc = row.answer?.mcAnswer;
          const correctMc = mc?.correctAnswer;
          const isCorrect = mc && normalizeAnswerSet(yourMc).join(',') === normalizeAnswerSet(correctMc).join(',');

          return (
            <section key={row.questionOrder} className={styles.card}>
              <h3 className={styles.cardTitle}>Soal {row.questionOrder}</h3>
              {row.imageUrl && <img src={row.imageUrl} alt={`Gambar soal ${row.questionOrder}`} className={styles.questionImage} />}

              {mc && (
                <>
                  <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: mc.questionText }} />
                  <ul className={styles.options}>
                    {(mc.options || []).map((opt, idx) => {
                      const isYourAnswer = normalizeAnswerSet(yourMc).includes(idx);
                      const isRightAnswer = normalizeAnswerSet(correctMc).includes(idx);
                      return (
                        <li key={idx} className={`${styles.option} ${isRightAnswer ? styles.correct : ''} ${isYourAnswer && !isRightAnswer ? styles.wrong : ''}`}>
                          <span className={styles.optionKey}>{String.fromCharCode(65 + idx)}</span>
                          <span>{opt}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className={styles.meta}>
                    Jawaban Anda: {formatOptionKeys(yourMc)}
                    {' | '}
                    Kunci benar: {formatOptionKeys(correctMc)}
                    {' | '}
                    Hasil: {isCorrect ? 'Benar' : 'Salah'}
                  </p>
                  {mc.explanation && (
                    <div className={styles.explanation}>
                      <strong>Pembahasan:</strong>
                      <div dangerouslySetInnerHTML={{ __html: mc.explanation }} />
                    </div>
                  )}
                </>
              )}

              {row.essay && (
                <>
                  <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: row.essay.questionText }} />
                  <div className={styles.answerBox}>
                    <strong>Jawaban Anda:</strong>
                    <p>{row.answer?.essayAnswer || '-'}</p>
                  </div>
                  {row.essay.explanation && (
                    <div className={styles.explanation}>
                      <strong>Pembahasan:</strong>
                      <div dangerouslySetInnerHTML={{ __html: row.essay.explanation }} />
                    </div>
                  )}
                </>
              )}

              {row.fileUpload && (
                <>
                  <p className={styles.questionText}>{row.fileUpload.questionText}</p>
                  <p className={styles.meta}>Soal tipe upload file. Lihat umpan balik dari guru pada hasil penilaian.</p>
                  {row.fileUpload.explanation && (
                    <div className={styles.explanation}>
                      <strong>Pembahasan:</strong> {row.fileUpload.explanation}
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
