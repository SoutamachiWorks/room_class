'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '../../../../admin/admin.module.css';

export default function TakeExamPage() {
  const { id: examId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [exitCount, setExitCount] = useState(0);
  const [answers, setAnswers] = useState({});
  const [fileAnswers, setFileAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);

  // New state to enforce user gesture for Fullscreen
  const [fullscreenGranted, setFullscreenGranted] = useState(false);

  // Tab visibility tracking
  const handleViolation = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/student/exams/${examId}/violation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (data.locked) {
        setLocked(true);
        if (Notification.permission === 'granted') {
          new Notification('⚠️ Sesi Ujian Dikunci', {
            body: 'Anda telah dikeluarkan dari ujian karena mencoba pindah tab/aplikasi.',
            icon: '/favicon.ico',
          });
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        router.replace('/dashboard/student/exams/lockout');
        return;
      }

      setExitCount(data.exitCount);

      if (Notification.permission === 'granted') {
        new Notification('⚠️ Peringatan Ujian', {
          body: `Anda mencoba pindah tab. Pelanggaran ke-${data.exitCount} tercatat. (Maks: 2)`,
          icon: '/favicon.ico',
        });
      }
      
      // Fallback local alert when they return
      alert(`PERINGATAN! Anda terdeteksi pindah tab atau aplikasi.\n\nPelanggaran ke-${data.exitCount} telah dicatat. Jika mencapai 2 pelanggaran, ujian Anda akan otomatis dikunci.`);
      
    } catch (err) {
      console.error('Failed to record violation:', err);
    }
  }, [sessionId, examId, router]);

  useEffect(() => {
    if (!sessionId || locked || !fullscreenGranted) return;

    const onVisibilityChange = () => {
      // Immediate violation when hidden (no more 15-second grace period)
      if (document.hidden) {
        handleViolation();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sessionId, locked, fullscreenGranted, handleViolation]);

  // Enforce fullscreen
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenGranted && !locked) {
        alert('PERINGATAN: Anda keluar dari mode Layar Penuh! Harap kembali masuk mode layar penuh untuk mencegah pelanggaran.');
        setFullscreenGranted(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [fullscreenGranted, locked]);

  // Start exam session on mount (fetches questions)
  useEffect(() => {
    const startExam = async () => {
      try {
        const res = await fetch(`/api/student/exams/${examId}/start`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          if (data.locked) {
            router.replace('/dashboard/student/exams/lockout');
            return;
          }
          setError(data.error || 'Gagal memulai ujian.');
          setLoading(false);
          return;
        }

        setSessionId(data.sessionId);
        setQuestions(data.questions || []);
        setExitCount(data.exitCount || 0);
        setExamTitle(data.examTitle || 'Ujian');

        if (data.exitCount >= 2) {
          router.replace('/dashboard/student/exams/lockout');
          return;
        }
      } catch {
        setError('Koneksi ke server gagal.');
      } finally {
        setLoading(false);
      }
    };

    startExam();
  }, [examId, router]);

  const requestFullscreenAndContinue = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenGranted(true);
    } catch (e) {
      alert('Browser Anda menolak akses Layar Penuh. Silakan coba lagi.');
    }
  };

  const updateAnswer = (questionOrder, field, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionOrder]: { ...prev[questionOrder], questionOrder, [field]: value },
    }));
  };

  const updateFileAnswer = (questionOrder, files) => {
    setFileAnswers(prev => ({ ...prev, [questionOrder]: files }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const confirmed = window.confirm('Anda yakin ingin mengumpulkan jawaban? Tindakan ini tidak dapat dibatalkan.');
    if (!confirmed) return;

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);

      const answersArray = questions.map(q => {
        const ans = answers[q.displayOrder] || {};
        return {
          questionOrder: q.displayOrder,
          originalOrder: q.order,
          mcAnswer: ans.mcAnswer ?? null,
          essayAnswer: ans.essayAnswer ?? '',
        };
      });

      formData.append('answers', JSON.stringify(answersArray));

      for (const q of questions) {
        const files = fileAnswers[q.displayOrder];
        if (files && files.length > 0) {
          for (const file of files) {
            formData.append(`file-${q.displayOrder}`, file);
          }
        }
      }

      const res = await fetch(`/api/student/exams/${examId}/submit`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          router.replace('/dashboard/student/exams/lockout');
          return;
        }
        setError(data.error || 'Gagal mengumpulkan jawaban.');
      } else {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams?submitted=1');
      }
    } catch {
      setError('Koneksi ke server gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingBox} style={{ minHeight: '60vh' }}>
        <div className="spinner"></div>
        Memuat ujian...
      </div>
    );
  }

  if (error && !sessionId) {
    return (
      <div className={styles.contentCard} style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
        <h2 style={{ color: 'var(--color-heading)', marginBottom: '8px' }}>Gagal Memuat Ujian</h2>
        <p style={{ color: '#DC3545' }}>{error}</p>
        <button
          className={styles.btnPrimary}
          style={{ marginTop: '24px' }}
          onClick={() => router.push('/dashboard/student/exams')}
        >
          Kembali ke Daftar Ujian
        </button>
      </div>
    );
  }

  // Pre-exam Fullscreen Gate
  if (!fullscreenGranted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className={styles.contentCard} style={{ padding: '48px', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🖥️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>Mode Layar Penuh Diperlukan</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-subtext)', lineHeight: 1.6, marginBottom: '24px' }}>
            Untuk menjaga integritas ujian, Anda wajib menggunakan mode Layar Penuh (Fullscreen). 
            Jika Anda mencoba keluar dari mode ini atau memindahkan tab, sistem akan langsung mencatat pelanggaran.
          </p>
          <button className={styles.btnPrimary} style={{ width: '100%', justifyContent: 'center', padding: '14px' }} onClick={requestFullscreenAndContinue}>
            Masuk Layar Penuh & Kerjakan Soal
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-heading)' }}>{examTitle}</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)', marginTop: '4px' }}>
            {questions.length} soal • Pelanggaran: {exitCount}/2
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {exitCount > 0 && (
            <div style={{ padding: '6px 14px', background: '#FEF3C7', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, color: '#92400E', border: '1px solid #FDE68A' }}>
              ⚠️ {exitCount} pelanggaran
            </div>
          )}
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Mengirim...' : 'Kumpulkan Jawaban'}
          </button>
        </div>
      </div>

      {error && <div className={styles.formError} style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {questions.map((q) => (
          <div key={q.displayOrder} className={styles.contentCard} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #5B8BF5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                {q.displayOrder}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', fontWeight: 600, textTransform: 'uppercase' }}>Soal {q.displayOrder}</span>
            </div>

            {q.multipleChoice && (
              <div style={{ marginBottom: q.essay || q.fileUpload ? '20px' : '0' }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '12px', lineHeight: 1.6 }}>{q.multipleChoice.questionText}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.multipleChoice.options.map((opt, idx) => {
                    const isSelected = answers[q.displayOrder]?.mcAnswer === idx;
                    return (
                      <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', border: `2px solid ${isSelected ? 'var(--color-primary)' : '#E5E7EB'}`, background: isSelected ? '#F0F7FF' : '#FAFAFA', cursor: 'pointer', transition: 'all 0.15s', fontSize: '0.875rem' }}>
                        <input type="radio" name={`mc-${q.displayOrder}`} checked={isSelected} onChange={() => updateAnswer(q.displayOrder, 'mcAnswer', idx)} style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }} />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {q.essay && (
              <div style={{ marginBottom: q.fileUpload ? '20px' : '0' }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '10px', lineHeight: 1.6 }}>{q.essay.questionText}</p>
                <textarea className={styles.input} style={{ height: '120px', paddingTop: '12px', resize: 'vertical' }} placeholder="Tuliskan jawaban Anda di sini..." value={answers[q.displayOrder]?.essayAnswer || ''} onChange={(e) => updateAnswer(q.displayOrder, 'essayAnswer', e.target.value)} />
              </div>
            )}

            {q.fileUpload && (
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '10px', lineHeight: 1.6 }}>{q.fileUpload.questionText}</p>
                <input type="file" multiple className={styles.input} style={{ paddingTop: '10px' }} onChange={(e) => updateFileAnswer(q.displayOrder, Array.from(e.target.files))} />
                {fileAnswers[q.displayOrder] && fileAnswers[q.displayOrder].length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {fileAnswers[q.displayOrder].map((f, i) => (
                      <span key={i} style={{ padding: '4px 10px', background: '#EFF6FF', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #BFDBFE', color: 'var(--color-primary)' }}>📄 {f.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
        <button className={styles.btnPrimary} style={{ padding: '14px 40px', fontSize: '0.9375rem' }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Mengirim Jawaban...' : 'Kumpulkan Jawaban'}
        </button>
      </div>
    </>
  );
}
