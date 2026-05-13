'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '../../../../../admin/admin.module.css';

function normalizeAnswerSet(value) {
  if (Array.isArray(value)) return value.map((item) => Number(item)).sort((a, b) => a - b);
  return value === null || value === undefined ? [] : [Number(value)];
}

function isSameAnswerSet(answer, correctAnswer) {
  const selected = normalizeAnswerSet(answer);
  const correct = normalizeAnswerSet(correctAnswer);
  return selected.length === correct.length && selected.every((value, index) => value === correct[index]);
}

function formatOptions(value, options = []) {
  const selected = normalizeAnswerSet(value);
  if (!selected.length) return 'Tidak Menjawab';
  return selected
    .map((idx) => `Opsi ${String.fromCharCode(65 + idx)}${options[idx] ? ` - ${options[idx]}` : ''}`)
    .join(', ');
}

export default function GradingPage() {
  const { id: examId, sessionId } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/exams/${examId}/sessions/${sessionId}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        const initialScores = {};
        json.session.answers.forEach(ans => {
          initialScores[ans.questionOrder] = ans.score ?? 0;
        });
        setScores(initialScores);
      } else {
        alert(json.error || 'Server error');
      }
    } catch {
      alert('Koneksi gagal');
    } finally {
      setLoading(false);
    }
  }, [examId, sessionId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
  }, [fetchData]);

  const handleScoreChange = (order, val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setScores(prev => ({ ...prev, [order]: num }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = Object.keys(scores).map(order => ({
      questionOrder: Number(order),
      score: scores[order]
    }));

    try {
      const res = await fetch(`/api/teacher/exams/${examId}/sessions/${sessionId}/grade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: payload })
      });
      const result = await res.json();
      if (res.ok) {
        alert('Koreksi berhasil disimpan!');
        router.push(`/dashboard/teacher/exams/${examId}/results`);
      } else {
        alert(result.error || 'Gagal menyimpan nilai');
      }
    } catch {
      alert('Koneksi gagal');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={`${styles.loadingBox} ${styles.loadingBoxFull}`}><div className="spinner"></div>Memuat Lembar Ujian...</div>;
  if (!data) return <div className={styles.emptyState}>Data tidak ditemukan.</div>;

  const { session, examTitle } = data;
  const currentTotal = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalQuestions = session.answers.length;
  const avgScore = totalQuestions > 0 ? (currentTotal / totalQuestions).toFixed(1) : 0;

  return (
    <div className={styles.gradingPage}>
      <div className={styles.pageHeader}>
        <div>
          <button
            onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results`)}
            className={styles.btnBack}
          >
            ← Kembali ke Tabel Pemantauan
          </button>
          <h1 className={styles.pageTitle}>Lembar Koreksi: {session.studentName}</h1>
          <p className={styles.cardSubtitle}>Kalkulasi Sementara: <strong>{avgScore} / 100</strong></p>
        </div>
      </div>

      <div className={styles.gradingList}>
        {session.answers.map((ans, idx) => {
          const qd = ans.questionDetails;
          if (!qd) return null;

          return (
            <div key={idx} className={styles.gradingCard}>
              <div className={styles.gradingCardHeader}>
                <span className={styles.questionNumber}>Soal #{ans.questionOrder}</span>
                <div className={styles.scoreBox}>
                  <span className={styles.scoreLabel}>Skor Soal (0-100):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scores[ans.questionOrder] === 0 ? '' : scores[ans.questionOrder]}
                    onChange={(e) => handleScoreChange(ans.questionOrder, e.target.value)}
                    placeholder="0"
                    className={`${styles.scoreInput} ${scores[ans.questionOrder] > 0 ? styles.scoreInputGood : styles.scoreInputBad}`}
                  />
                </div>
              </div>

              <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: qd.multipleChoice?.questionText || qd.essay?.questionText || qd.fileUpload?.questionText }} />

              <div className={styles.answerBox}>
                <div className={styles.answerLabel}>Jawaban Siswa:</div>
                
                {qd.multipleChoice && (
                  <div>
                    <div className={isSameAnswerSet(ans.mcAnswer, qd.multipleChoice.correctAnswer) ? styles.answerCorrect : styles.answerWrong}>
                      {formatOptions(ans.mcAnswer, qd.multipleChoice?.options || [])}
                    </div>
                    {!isSameAnswerSet(ans.mcAnswer, qd.multipleChoice.correctAnswer) && qd.multipleChoice.correctAnswer !== null && qd.multipleChoice.correctAnswer !== undefined && (
                      <div className={styles.correctKey}>
                        Kunci Jawaban Benar: {formatOptions(qd.multipleChoice.correctAnswer, qd.multipleChoice?.options || [])}
                      </div>
                    )}
                  </div>
                )}

                {qd.essay && (
                  <div className={styles.essayAnswer}>
                    {ans.essayAnswer || <span className={styles.noAnswer}>Tidak ada jawaban teks.</span>}
                  </div>
                )}

                {qd.fileUpload && (
                  <div>
                    {ans.uploadedFiles?.length > 0 ? (
                      <div className={styles.uploadedFilesList}>
                        {ans.uploadedFiles.map((file, i) => (
                          <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className={styles.uploadedFileLink}>
                            📁 {file.originalName}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.noAnswer}>Tidak ada file terlampir.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.gradingFooter}>
        <div className={styles.gradingFooterScore}>
          <div className={styles.cardSubtitle}>Kalkulasi Nilai Akhir</div>
          <div className={styles.gradingFinalScore}>{avgScore} / 100</div>
        </div>
        <button 
          className={`${styles.btnPrimary} ${styles.btnLarge}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Menyimpan...' : 'Simpan & Selesai Koreksi'}
        </button>
      </div>
    </div>
  );
}
