'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '../../../../../admin/admin.module.css';

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
    fetchData();
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

  if (loading) return <div className={styles.loadingBox} style={{ minHeight: '60vh' }}><div className="spinner"></div>Memuat Lembar Ujian...</div>;
  if (!data) return <div className={styles.emptyState}>Data tidak ditemukan.</div>;

  const { session, examTitle } = data;
  const currentTotal = Object.values(scores).reduce((a, b) => a + b, 0);
  const totalQuestions = session.answers.length;
  const avgScore = totalQuestions > 0 ? (currentTotal / totalQuestions).toFixed(1) : 0;

  return (
    <div style={{ paddingBottom: '100px' }}>
      <div className={styles.pageHeader}>
        <div>
          <button 
            onClick={() => router.push(`/dashboard/teacher/exams/${examId}/results`)}
            style={{ background: 'none', border: 'none', color: 'var(--color-subtext)', cursor: 'pointer', marginBottom: '8px', fontSize: '0.875rem' }}
          >
            ← Kembali ke Tabel Pemantauan
          </button>
          <h1 className={styles.pageTitle}>Lembar Koreksi: {session.studentName}</h1>
          <p style={{ color: 'var(--color-subtext)' }}>Kalkulasi Sementara: <strong>{avgScore} / 100</strong></p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {session.answers.map((ans, idx) => {
          const qd = ans.questionDetails;
          if (!qd) return null;

          return (
            <div key={idx} className={styles.contentCard} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--color-primary)' }}>Soal #{ans.questionOrder}</span>
                <div style={{ background: 'var(--bg-app)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Skor Soal (0-100):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scores[ans.questionOrder] === 0 ? '' : scores[ans.questionOrder]}
                    onChange={(e) => handleScoreChange(ans.questionOrder, e.target.value)}
                    placeholder="0"
                    style={{
                      width: '70px',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: scores[ans.questionOrder] > 0 ? 'var(--color-success-text)' : 'var(--color-failed-text)',
                      background: 'var(--bg-card)'
                    }}
                  />
                </div>
              </div>

              <div style={{ fontSize: '1rem', marginBottom: '20px', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: qd.multipleChoice?.questionText || qd.essay?.questionText || qd.fileUpload?.questionText }} />

              <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--color-subtext)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-subtext)', marginBottom: '8px' }}>Jawaban Siswa:</div>
                
                {qd.multipleChoice && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', color: ans.mcAnswer === qd.multipleChoice.correctAnswer ? 'var(--color-success-text)' : 'var(--color-failed-text)' }}>
                      {ans.mcAnswer ? `Opsi ${String(ans.mcAnswer).toUpperCase()}` : 'Tidak Menjawab'}
                    </div>
                    {ans.mcAnswer !== qd.multipleChoice.correctAnswer && qd.multipleChoice.correctAnswer && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-success-text)', marginTop: '4px' }}>
                        Kunci Jawaban Benar: Opsi {String(qd.multipleChoice.correctAnswer).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {qd.essay && (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {ans.essayAnswer || <span style={{ color: 'var(--color-subtext)', fontStyle: 'italic' }}>Tidak ada jawaban teks.</span>}
                  </div>
                )}

                {qd.fileUpload && (
                  <div>
                    {ans.uploadedFiles?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ans.uploadedFiles.map((file, i) => (
                          <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.875rem', background: 'var(--color-primary-light)', padding: '6px 12px', borderRadius: '4px', width: 'fit-content' }}>
                            📁 {file.originalName}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-subtext)', fontStyle: 'italic' }}>Tidak ada file terlampir.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)', zIndex: 100 }}>
        <div style={{ marginRight: '24px', textAlign: 'right' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-subtext)' }}>Kalkulasi Nilai Akhir</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>{avgScore} / 100</div>
        </div>
        <button 
          className={styles.btnPrimary} 
          style={{ padding: '12px 32px', fontSize: '1.1rem' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Menyimpan...' : 'Simpan & Selesai Koreksi'}
        </button>
      </div>
    </div>
  );
}
