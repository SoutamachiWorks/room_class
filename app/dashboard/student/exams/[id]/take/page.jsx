'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { uploadWithProgress } from '@/lib/xhrUpload';
import { ACCEPT_STR, validateFiles } from '@/lib/fileValidation';
import styles from '../../../../admin/admin.module.css';
import ex from './exam-take.module.css';

export default function TakeExamPage() {
  const MAX_VIOLATIONS = 3;
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
  const [isChoosingFile, setIsChoosingFile] = useState(false);

  // New states for Consent Gate and Violation Rules
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [dndChecked, setDndChecked] = useState(false);
  const [isMobileClient, setIsMobileClient] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [strikeMessage, setStrikeMessage] = useState('');
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const violationTimerRef = useRef(null);
  const leftTabAtRef = useRef(null);

  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const isDirty = useRef(false);
  const syncInFlightRef = useRef(false);
  const [syncState, setSyncState] = useState('idle'); // idle | syncing | synced | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (typeof window !== 'undefined' && window.innerWidth < 768);
    setIsMobileClient(mobile);
  }, []);

  useEffect(() => {
    const checkFullscreen = () => {
      if (!document.fullscreenElement && fullscreenGranted && !showConsentModal && !locked) {
        setShowFullscreenOverlay(true);
      } else {
        setShowFullscreenOverlay(false);
      }
    };
    
    document.addEventListener('fullscreenchange', checkFullscreen);
    window.addEventListener('focus', checkFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      window.removeEventListener('focus', checkFullscreen);
    };
  }, [fullscreenGranted, showConsentModal, locked]);

  // Auto-submit ref to avoid closure issues
  const submittingRef = useRef(false);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  async function processSubmit(isLockout = false) {
    setError('');

    try {
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
      if (isLockout) formData.append('isLockout', 'true');
      await uploadWithProgress(url, formData, 'POST', (val) => setUploadProgress(val));

      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

      if (isLockout) {
        router.replace('/dashboard/student/exams/lockout');
      } else {
        router.replace('/dashboard/student/exams?submitted=1');
      }
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
  }

  const buildRedisAnswers = useCallback(() => {
    const multipleChoice = questions.map((q) => {
      if (!q.multipleChoice) return null;
      return answers[q.displayOrder]?.mcAnswer ?? null;
    });
    const essay = questions.map((q) => {
      if (!q.essay) return '';
      return answers[q.displayOrder]?.essayAnswer ?? '';
    });
    return { multipleChoice, essay };
  }, [questions, answers]);

  const syncExamCache = useCallback(async (force = false, violationOverride = null) => {
    if (!sessionId || !examId) return;
    if (!force && !isDirty.current) return;
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncState('syncing');
    try {
      await fetch('/api/exam/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          sessionId,
          answers: buildRedisAnswers(),
          violationCount: violationOverride ?? exitCount,
        }),
      });
      isDirty.current = false;
      setSyncState('synced');
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Redis sync failed:', err);
      setSyncState('error');
    } finally {
      syncInFlightRef.current = false;
    }
  }, [sessionId, examId, buildRedisAnswers, exitCount]);

  async function handleSubmitAuto() {
    if (submittingRef.current) return;
    setSubmitting(true);
    await processSubmit();
  }

  const triggerStrike = useCallback(async () => {
    if (!sessionId || isChoosingFile) return;

    try {
      const res = await fetch(`/api/student/exams/${examId}/violation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (data.locked) {
        setLocked(true);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams/lockout');
        return;
      }

      setExitCount(data.exitCount);
      setStrikeMessage(`Pelanggaran ke-${data.exitCount} tercatat. Jika mencapai ${MAX_VIOLATIONS} pelanggaran, ujian otomatis dikunci.`);
      setShowStrikeModal(true);
      await syncExamCache(true, data.exitCount);
      
    } catch (err) {
      console.error('Failed to record violation:', err);
    }
  }, [sessionId, examId, router, isChoosingFile, syncExamCache]);

  const handleLeaveTab = useCallback(() => {
    if (locked || !fullscreenGranted || isChoosingFile || showConsentModal) return;
    
    if (!violationTimerRef.current) {
      leftTabAtRef.current = Date.now();
      violationTimerRef.current = setTimeout(() => {
        triggerStrike();
        violationTimerRef.current = null;
      }, 5000);
    }
  }, [locked, fullscreenGranted, isChoosingFile, showConsentModal, triggerStrike]);

  const handleReturnTab = useCallback(async () => {
    if (locked || !fullscreenGranted || showConsentModal) return;

    if (violationTimerRef.current) {
      clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
      
      const timeAway = Date.now() - leftTabAtRef.current;
      if (timeAway < 5000 && !isChoosingFile) {
        setToastMessage("⚠️ Peringatan: Jangan keluar dari layar ujian!");
        setTimeout(() => setToastMessage(''), 4000);
      }
    }
    
    // File choosing fallback focus recovery
    setTimeout(async () => {
       if (isChoosingFile && !document.fullscreenElement) {
          try {
             await document.documentElement.requestFullscreen();
             setFullscreenGranted(true);
          } catch(e) {}
       }
       setIsChoosingFile(false);
    }, 500);

  }, [locked, fullscreenGranted, isChoosingFile, showConsentModal]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        handleLeaveTab();
        void syncExamCache(true);
      } else handleReturnTab();
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) handleLeaveTab();
      else handleReturnTab();
    };

    const onFocus = () => {
      // If we're supposed to be in fullscreen but aren't, handleReturnTab will show the overlay/logic
      if (isChoosingFile) {
        // Small delay to ensure browser focus state is updated
        setTimeout(handleReturnTab, 100);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [handleLeaveTab, handleReturnTab, isChoosingFile, syncExamCache]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncExamCache(false);
    }, 90_000);
    return () => clearInterval(interval);
  }, [syncExamCache]);

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

        if (data.exitCount >= MAX_VIOLATIONS) {
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
    isDirty.current = true;
  };

  const updateFileAnswer = (questionOrder, files) => {
    setFileAnswers(prev => ({ ...prev, [questionOrder]: files }));
    isDirty.current = true;
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const confirmed = window.confirm('Anda yakin ingin mengumpulkan jawaban? Tindakan ini tidak dapat dibatalkan.');
    if (!confirmed) return;

    setSubmitting(true);
    await syncExamCache(true);
    await processSubmit();
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`${styles.loadingBox} ${ex.examLoadingBox}`}>
        <div className="spinner"></div>
        Memuat ujian...
      </div>
    );
  }

  // ── Error state (before session starts) ────────────────────────────────
  if (error && !sessionId) {
    return (
      <div className={`${styles.contentCard} ${ex.examErrorState}`}>
        <div className={ex.examErrorEmoji}>❌</div>
        <h2 className={ex.examErrorTitle}>Gagal Memuat Ujian</h2>
        <p className={ex.examErrorMessage}>{error}</p>
        <button
          className={`${styles.btnPrimary} ${ex.examErrorBtn}`}
          onClick={() => router.push('/dashboard/student/exams')}
        >
          Kembali ke Daftar Ujian
        </button>
      </div>
    );
  }

  // ── Consent Gate Modal ─────────────────────────────────────────────────
  if (showConsentModal) {
    return (
      <div className={ex.examConsentWrapper}>
        <div className={`${styles.contentCard} ${ex.examConsentCard}`}>
          <div className={ex.examConsentHeader}>
            <div className={ex.examConsentEmoji}>📜</div>
            <h2 className={ex.examConsentTitle}>Persetujuan Ujian</h2>
          </div>
          <p className={ex.examConsentWarning}>
            <strong>PERHATIAN:</strong><br />
            Untuk menjaga integritas, ujian ini diwajibkan dalam mode <strong>Layar Penuh (Fullscreen)</strong>. Jika Anda terdeteksi pindah tab, membuka aplikasi lain, atau keluar dari layar penuh lebih dari 5 detik, sistem akan mencatat pelanggaran.<br /><br />
            Anda akan mendapat <strong>2 kali peringatan</strong>. Pada pelanggaran ke-<strong>{MAX_VIOLATIONS}</strong>, ujian akan otomatis <strong>terkunci</strong> dan disubmit secara paksa.
          </p>
          <label className={ex.examConsentLabel}>
            <input 
               type="checkbox" 
               checked={consentChecked} 
               onChange={(e) => setConsentChecked(e.target.checked)}
               className={ex.examConsentCheckbox}
            />
            <span className={ex.examConsentText}>
              Saya mengerti bahwa pada pelanggaran ke-{MAX_VIOLATIONS}, ujian saya akan terkunci otomatis.
            </span>
          </label>
          {isMobileClient && (
            <>
              <label className={ex.examConsentLabel}>
                <input
                  type="checkbox"
                  checked={dndChecked}
                  onChange={(e) => setDndChecked(e.target.checked)}
                  className={ex.examConsentCheckbox}
                />
                <span className={ex.examConsentText}>
                  Saya sudah mengaktifkan mode Jangan Ganggu (Do Not Disturb) di perangkat mobile.
                </span>
              </label>
              <div className={ex.examConsentWarning} style={{ marginTop: 8 }}>
                <strong>Panduan cepat DND:</strong><br />
                Android: Tarik Quick Settings → pilih <strong>Do Not Disturb</strong>.<br />
                iPhone: Control Center → aktifkan <strong>Focus / Do Not Disturb</strong>.
              </div>
            </>
          )}
          <button 
             className={`${styles.btnPrimary} ${ex.examConsentBtn} ${(!consentChecked || (isMobileClient && !dndChecked)) ? ex.examConsentBtnDisabled : ''}`}
             disabled={!consentChecked || (isMobileClient && !dndChecked)}
             onClick={async () => {
                try {
                  if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                  }
                  setFullscreenGranted(true);
                  setShowConsentModal(false);
                } catch (e) {
                  alert('Browser menolak akses Layar Penuh. Pastikan Anda memberikan izin.');
                }
             }}
          >
            Mulai Ujian & Masuk Layar Penuh
          </button>
        </div>
      </div>
    );
  }

  // ── Main Exam UI ───────────────────────────────────────────────────────
  return (
    <div className={ex.examTakePage}>
      {/* Fullscreen Recovery Overlay */}
      {showFullscreenOverlay && (
        <div className={ex.examFullscreenOverlay}>
          <div className={ex.examOverlayEmoji}>🖥️</div>
          <h2 className={ex.examOverlayTitle}>Mode Layar Penuh Diperlukan</h2>
          <p className={ex.examOverlayText}>Anda keluar dari mode layar penuh. Klik tombol di bawah untuk kembali mengerjakan ujian.</p>
          <button 
            className={`${styles.btnPrimary} ${ex.examOverlayBtn}`}
            onClick={async () => {
              try {
                await document.documentElement.requestFullscreen();
                setShowFullscreenOverlay(false);
                setIsChoosingFile(false);
              } catch (e) {
                alert('Gagal masuk mode layar penuh. Pastikan Anda tidak sedang membuka tab lain.');
              }
            }}
          >
            Masuk Layar Penuh & Lanjutkan
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={ex.examToast}>
          {toastMessage}
        </div>
      )}

      {/* Strike Modal */}
      {showStrikeModal && (
        <div className={ex.examStrikeOverlay}>
          <div className={`${styles.contentCard} ${ex.examStrikeCard}`}>
            <div className={ex.examStrikeEmoji}>⚠️</div>
            <h3 className={ex.examStrikeTitle}>Pelanggaran Terdeteksi</h3>
            <p className={ex.examStrikeBody}>
              {strikeMessage}
            </p>
            <button className={`${styles.btnPrimary} ${ex.examStrikeBtn}`} onClick={async () => {
              setShowStrikeModal(false);
              if (!document.fullscreenElement) {
                try { await document.documentElement.requestFullscreen(); setFullscreenGranted(true); } catch(e){}
              }
            }}>
              Saya Mengerti, Kembali ke Ujian
            </button>
          </div>
        </div>
      )}

      {/* Sticky exam header with timer */}
      <div className={ex.examStickyHeader}>
        <div className={ex.examHeaderInfo}>
          <h1 className={ex.examHeaderTitle}>{examTitle}</h1>
          <p className={ex.examHeaderMeta}>
            Soal {currentQuestionIndex + 1} dari {questions.length} • Pelanggaran: {exitCount}/{MAX_VIOLATIONS}
          </p>
          <p className={ex.examHeaderMeta} style={{ marginTop: 4 }}>
            {syncState === 'syncing' && '⟳ Auto-save berjalan...'}
            {syncState === 'synced' && `✓ Auto-save tersimpan${lastSyncedAt ? ` (${lastSyncedAt.toLocaleTimeString('id-ID')})` : ''}`}
            {syncState === 'error' && '⚠ Auto-save gagal, akan dicoba lagi otomatis'}
            {syncState === 'idle' && '• Auto-save siap'}
          </p>
        </div>
        <div className={ex.examHeaderActions}>
          {timeLeft !== null && (
            <div className={`${ex.examTimerBadge} ${timeLeft < 60 ? ex.examTimerUrgent : ex.examTimerNormal}`}>
              ⏱️ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          )}
          {exitCount > 0 && (
            <div className={ex.examViolationBadge}>
              ⚠️ {exitCount} pelanggaran
            </div>
          )}
        </div>
      </div>

      {error && <div className={`${styles.formError} ${ex.examErrorBar}`}>{error}</div>}

      {/* Question cards */}
      <div className={ex.examQuestionList}>
        {questions.length > 0 && (() => {
          const q = questions[currentQuestionIndex];
          return (
            <div key={`${q.displayOrder}-${currentQuestionIndex}`} className={`${styles.contentCard} ${ex.examQuestionCard} ${ex.examFadeIn}`}>
              <div className={ex.examQuestionHeader}>
                <div className={ex.examQuestionNumber}>
                  {q.displayOrder}
                </div>
                <span className={ex.examQuestionLabel}>Soal {q.displayOrder}</span>
              </div>

              {q.imageUrl && (
                <img
                  src={q.imageUrl}
                  alt="Ilustrasi Soal"
                  className={ex.examQuestionImage}
                />
              )}

              {q.multipleChoice && (
                <div className={q.essay || q.fileUpload ? ex.examSectionSpaced : undefined}>
                  <p className={ex.examQuestionText}>{q.multipleChoice.questionText}</p>
                  <div className={ex.examOptionsList}>
                    {q.multipleChoice.options.map((opt, idx) => {
                      const isSelected = answers[q.displayOrder]?.mcAnswer === idx;
                      return (
                        <label key={idx} className={`${ex.examOption} ${isSelected ? ex.examOptionSelected : ''}`}>
                          <input type="radio" name={`mc-${q.displayOrder}`} checked={isSelected} onChange={() => updateAnswer(q.displayOrder, 'mcAnswer', idx)} className={ex.examOptionRadio} />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {q.essay && (
                <div className={q.fileUpload ? ex.examSectionSpaced : undefined}>
                  <p className={`${ex.examQuestionText} ${ex.examQuestionTextSmall}`}>{q.essay.questionText}</p>
                  <textarea className={`${styles.input} ${ex.examEssayInput}`} placeholder="Tuliskan jawaban Anda di sini..." value={answers[q.displayOrder]?.essayAnswer || ''} onChange={(e) => updateAnswer(q.displayOrder, 'essayAnswer', e.target.value)} />
                </div>
              )}

              {q.fileUpload && (
                <div>
                  <p className={`${ex.examQuestionText} ${ex.examQuestionTextSmall}`}>{q.fileUpload.questionText}</p>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT_STR}
                    className={`${styles.input} ${ex.examFileInput}`}
                    onClick={() => setIsChoosingFile(true)}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files);
                      const validation = validateFiles(files);
                      
                      if (!validation.valid) {
                        alert(`Kesalahan Upload:\n${validation.errors.join('\n')}\n\nPastikan format file sesuai dan ukuran maksimal 50MB per file.`);
                        e.target.value = ''; // Reset
                        setIsChoosingFile(false);
                        return;
                      }

                      updateFileAnswer(q.displayOrder, files);
                      
                      // Try to re-enter fullscreen immediately after selection (user gesture)
                      try {
                        if (!document.fullscreenElement) {
                          await document.documentElement.requestFullscreen();
                          setFullscreenGranted(true);
                        }
                      } catch (err) {
                        console.log('Fullscreen re-entry failed, user must click manual button.');
                      } finally {
                        setIsChoosingFile(false);
                      }
                    }}
                  />
                  {fileAnswers[q.displayOrder] && fileAnswers[q.displayOrder].length > 0 && (
                    <div className={ex.examFilePreview}>
                      {fileAnswers[q.displayOrder].map((f, i) => (
                        <span key={i} className={ex.examFileTag}>📄 {f.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Sticky Bottom Bar ─────────────────────────────────────────────── */}
      <div className={ex.examStickyBottom}>
        {submitting && uploadProgress > 0 && (
          <span className={ex.examStickyProgress}>Terkirim... {uploadProgress}%</span>
        )}
        <div className={ex.examStickyNav}>
          <button 
            className={`${ex.examBtnSecondary} ${currentQuestionIndex === 0 ? ex.examBtnHidden : ''}`}
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={submitting || currentQuestionIndex === 0}
          >
            Sebelumnya
          </button>
          
          {currentQuestionIndex < questions.length - 1 ? (
            <button 
              className={`${styles.btnPrimary} ${ex.examStickyBtn}`}
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
            >
              Selanjutnya
            </button>
          ) : (
            <button 
              className={`${styles.btnPrimary} ${ex.examStickyBtn}`} 
              onClick={handleSubmit} 
              disabled={submitting}
            >
              {submitting ? 'Mengirim Jawaban...' : 'Kumpulkan Jawaban'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
