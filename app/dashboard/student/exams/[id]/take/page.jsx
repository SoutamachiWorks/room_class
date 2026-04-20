'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { uploadWithProgress } from '@/lib/xhrUpload';
import styles from '../../../../admin/admin.module.css';

export default function TakeExamPage() {
  const { id: examId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [exitCount, setExitCount] = useState(0);
  const [answers, setAnswers] = useState({});
  const [fileAnswers, setFileAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null); // in seconds
  const [locked, setLocked] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // New state to enforce user gesture for Fullscreen
  const [fullscreenGranted, setFullscreenGranted] = useState(false);

  // Auto-submit ref to avoid closure issues
  const submittingRef = useRef(false);
  submittingRef.current = submitting;

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
        setExamDuration(data.examDuration || null);
        setStartedAt(data.startedAt || null);

        if (data.examDuration && data.startedAt) {
          const start = new Date(data.startedAt).getTime();
          const durationMs = data.examDuration * 60 * 1000;
          const end = start + durationMs;
          const now = Date.now();
          const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
          setTimeLeft(remainingSeconds);
        }

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

  // Timer effect
  useEffect(() => {
    if (timeLeft === null || locked || !fullscreenGranted) return;

    if (timeLeft <= 0) {
      // Time is up, auto submit
      if (!submittingRef.current) {
        alert('Waktu ujian telah habis! Jawaban Anda akan otomatis dikumpulkan.');
        handleSubmitAuto();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, locked, fullscreenGranted]);

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

  const handleSubmitAuto = async () => {
    if (submittingRef.current) return;
    setSubmitting(true);
    await processSubmit();
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const confirmed = window.confirm('Anda yakin ingin mengumpulkan jawaban? Tindakan ini tidak dapat dibatalkan.');
    if (!confirmed) return;

    setSubmitting(true);
    await processSubmit();
  };

  const processSubmit = async () => {
    setError('');

    try {
      // 10MB limit enforcement across ALL file inputs organically globally.
      const MAX_SIZE = 10 * 1024 * 1024;
      let totalSize = 0;
      for (const q of questions) {
        const files = fileAnswers[q.displayOrder];
        if (files) {
           for (const f of files) totalSize += f.size;
        }
      }

      if (totalSize > MAX_SIZE) {
         setError('Gagal. Total lampiran berkas ujian melampaui batas maksimal sebesar 10 MB.');
         setSubmitting(false);
         return;
      }

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

      const url = `/api/student/exams/${examId}/submit`;
      setUploadProgress(0);
      const data = await uploadWithProgress(url, formData, 'POST', (val) => setUploadProgress(val));

      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace('/dashboard/student/exams?submitted=1');
    } catch (err) {
      if (err.payload && err.payload.locked) {
         if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
         router.replace('/dashboard/student/exams/lockout');
         return;
      }
      setError(err.message || 'Koneksi ke server gagal.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
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
      {/* Sticky exam header with timer */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--color-border)',
        padding: '14px 20px',
        margin: '-28px -32px 24px -32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-heading)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{examTitle}</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', marginTop: '2px', margin: '2px 0 0' }}>
            {questions.length} soal • Pelanggaran: {exitCount}/2
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {timeLeft !== null && (
            <div style={{
              padding: '8px 16px',
              background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-app)',
              borderRadius: '10px',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: timeLeft < 60 ? 'var(--color-danger)' : 'var(--color-primary)',
              border: `1px solid ${timeLeft < 60 ? 'rgba(239, 68, 68, 0.4)' : 'var(--color-border)'}`,
              fontVariantNumeric: 'tabular-nums',
              minWidth: '80px',
              textAlign: 'center',
            }}>
              ⏱️ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          )}
          {exitCount > 0 && (
            <div style={{ padding: '6px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              ⚠️ {exitCount} pelanggaran
            </div>
          )}
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting} style={{ minHeight: '44px' }}>
            {submitting ? 'Mengirim...' : 'Kumpulkan'}
          </button>
        </div>
      </div>

      {error && <div className={styles.formError} style={{ marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {questions.map((q) => (
          <div key={q.displayOrder} className={styles.contentCard} style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #5B8BF5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                {q.displayOrder}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', fontWeight: 600, textTransform: 'uppercase' }}>Soal {q.displayOrder}</span>
            </div>

            {q.multipleChoice && (
              <div style={{ marginBottom: q.essay || q.fileUpload ? '20px' : '0' }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '12px', lineHeight: 1.6, wordBreak: 'break-word' }}>{q.multipleChoice.questionText}</p>
                {q.multipleChoice.imageUrl && (
                  <img
                    src={q.multipleChoice.imageUrl}
                    alt="Gambar soal"
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px', marginBottom: '12px', border: '1px solid var(--color-border)' }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {q.multipleChoice.options.map((opt, idx) => {
                    const isSelected = answers[q.displayOrder]?.mcAnswer === idx;
                    return (
                      <label key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isSelected ? 'rgba(120, 163, 255, 0.15)' : 'var(--bg-app)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontSize: '0.875rem',
                        minHeight: '44px',
                        wordBreak: 'break-word',
                      }}>
                        <input type="radio" name={`mc-${q.displayOrder}`} checked={isSelected} onChange={() => updateAnswer(q.displayOrder, 'mcAnswer', idx)} style={{ accentColor: 'var(--color-primary)', width: '18px', height: '18px', flexShrink: 0 }} />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {q.essay && (
              <div style={{ marginBottom: q.fileUpload ? '20px' : '0' }}>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '10px', lineHeight: 1.6, wordBreak: 'break-word' }}>{q.essay.questionText}</p>
                <textarea className={styles.input} style={{ height: '120px', paddingTop: '12px', resize: 'vertical', fontSize: '1rem' }} placeholder="Tuliskan jawaban Anda di sini..." value={answers[q.displayOrder]?.essayAnswer || ''} onChange={(e) => updateAnswer(q.displayOrder, 'essayAnswer', e.target.value)} />
              </div>
            )}

            {q.fileUpload && (
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '10px', lineHeight: 1.6, wordBreak: 'break-word' }}>{q.fileUpload.questionText}</p>
                <input type="file" multiple className={styles.input} style={{ paddingTop: '10px' }} onChange={(e) => updateFileAnswer(q.displayOrder, Array.from(e.target.files))} />
                {fileAnswers[q.displayOrder] && fileAnswers[q.displayOrder].length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {fileAnswers[q.displayOrder].map((f, i) => (
                      <span key={i} style={{ padding: '4px 10px', background: 'var(--bg-input)', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>📄 {f.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        {submitting && uploadProgress > 0 && <span style={{ color: '#10B981', fontSize: '0.875rem', fontWeight: 600 }}>Terkirim... {uploadProgress}%</span>}
        <button className={styles.btnPrimary} style={{ padding: '14px 40px', fontSize: '0.9375rem', minHeight: '52px', width: '100%', maxWidth: '400px', justifyContent: 'center' }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Mengirim Jawaban...' : 'Kumpulkan Jawaban'}
        </button>
      </div>
    </>
  );
}
