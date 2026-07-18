'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { uploadWithProgress } from '@/lib/xhrUpload';
import { ACCEPT_STR, validateFiles } from '@/lib/fileValidation';
import styles from '../../../../admin/admin.module.css';
import ex from './exam-take.module.css';

const EXAM_DRAFT_DB = 'roomclass-exam-drafts';
const EXAM_DRAFT_STORE = 'drafts';
const LOCAL_DRAFT_INTERVAL_MS = 45_000;
const SERVER_SYNC_INTERVAL_MS = 90_000;
const HEARTBEAT_INTERVAL_MS = 15_000;

function openExamDraftDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia.'));
      return;
    }

    const request = indexedDB.open(EXAM_DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXAM_DRAFT_STORE)) {
        db.createObjectStore(EXAM_DRAFT_STORE, { keyPath: 'examId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getCryptoKey(sessionId) {
  const enc = new TextEncoder();
  const rawKey = enc.encode(String(sessionId || '').padEnd(32, '0').slice(0, 32));
  return window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data, sessionId) {
  try {
    if (!sessionId) return data;
    const key = await getCryptoKey(sessionId);
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    return {
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext))
    };
  } catch (err) {
    console.error('Encryption failed:', err);
    return data;
  }
}

async function decryptData(encryptedObj, sessionId) {
  try {
    if (!encryptedObj || !encryptedObj.iv || !encryptedObj.ciphertext || !sessionId) {
      return encryptedObj;
    }
    const key = await getCryptoKey(sessionId);
    const iv = new Uint8Array(encryptedObj.iv);
    const ciphertext = new Uint8Array(encryptedObj.ciphertext);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

async function readExamDraft(examId, sessionId) {
  try {
    const db = await openExamDraftDb();
    const rawResult = await new Promise((resolve, reject) => {
      const tx = db.transaction(EXAM_DRAFT_STORE, 'readonly');
      const request = tx.objectStore(EXAM_DRAFT_STORE).get(examId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });

    if (!rawResult) return null;
    if (rawResult.encryptedData && sessionId) {
      return await decryptData(rawResult.encryptedData, sessionId);
    }
    return rawResult;
  } catch {
    return null;
  }
}

async function writeExamDraft(draft) {
  try {
    const db = await openExamDraftDb();
    const { examId, sessionId } = draft;
    const encryptedPayload = await encryptData(draft, sessionId);

    await new Promise((resolve, reject) => {
      const tx = db.transaction(EXAM_DRAFT_STORE, 'readwrite');
      tx.objectStore(EXAM_DRAFT_STORE).put({
        examId,
        sessionId,
        encryptedData: encryptedPayload
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menyimpan draft lokal ujian:', err);
  }
}

async function deleteExamDraft(examId) {
  try {
    const db = await openExamDraftDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(EXAM_DRAFT_STORE, 'readwrite');
      tx.objectStore(EXAM_DRAFT_STORE).delete(examId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Gagal menghapus draft lokal ujian:', err);
  }
}

function buildAnswersFromSyncedDraft(questions, syncedAnswers) {
  if (!Array.isArray(questions) || !syncedAnswers) return {};

  const multipleChoice = Array.isArray(syncedAnswers.multipleChoice) ? syncedAnswers.multipleChoice : [];
  const essay = Array.isArray(syncedAnswers.essay) ? syncedAnswers.essay : [];

  return questions.reduce((acc, question, index) => {
    const questionOrder = question.displayOrder;
    const answer = { questionOrder };
    let hasAnswer = false;

    if (question.multipleChoice && multipleChoice[index] !== null && multipleChoice[index] !== undefined) {
      answer.mcAnswer = multipleChoice[index];
      hasAnswer = true;
    }

    if (question.essay && typeof essay[index] === 'string' && essay[index] !== '') {
      answer.essayAnswer = essay[index];
      hasAnswer = true;
    }

    if (hasAnswer) acc[questionOrder] = answer;
    return acc;
  }, {});
}

function normalizeSelectedAnswers(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => Number.isInteger(Number(item))).map((item) => Number(item)).sort((a, b) => a - b);
  }
  return value === null || value === undefined ? [] : [Number(value)];
}

export default function TakeExamPage() {
  const MAX_VIOLATIONS = 3;
  const FILE_UPLOAD_EXAMS_ENABLED = false;
  const LEAVE_VIOLATION_DELAY_MS = 5000;
  const FOCUS_LOSS_VIOLATION_DELAY_MS = 1200;
  const IMMEDIATE_VIOLATION_COOLDOWN_MS = 2500;
  const FILE_PICKER_SUSPICIOUS_AWAY_MS = 45_000;
  const FILE_PICKER_RETURN_WATCH_MS = 1500;
  const MOBILE_LEAVE_VIOLATION_DELAY_MS = 6000;
  const MOBILE_FOCUS_LOSS_VIOLATION_DELAY_MS = 3000;
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
  const [, setIsChoosingFile] = useState(false);

  // New states for Consent Gate and Violation Rules
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [dndChecked, setDndChecked] = useState(false);
  const [isMobileClient] = useState(() => {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.innerWidth < 768;
  });
  
  const [toastMessage, setToastMessage] = useState('');
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [strikeMessage, setStrikeMessage] = useState('');
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuestionShortcut, setShowQuestionShortcut] = useState(false);

  const violationTimerRef = useRef(null);
  const leftTabAtRef = useRef(null);
  const violationInFlightRef = useRef(false);
  const lastViolationAtRef = useRef(0);
  const isChoosingFileRef = useRef(false);
  const filePickerOpenedAtRef = useRef(null);
  const filePickerReturnTimerRef = useRef(null);
  const wakeLockRef = useRef(null);
  const mobileHiddenAtRef = useRef(null);
  const mobileSleepWarningRef = useRef(false);
  const activeViolationReasonRef = useRef(null);
  const activeViolationDelayRef = useRef(null);

  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const syncInFlightRef = useRef(false);
  const syncTerminatedRef = useRef(false);
  const [syncState, setSyncState] = useState('idle'); // idle | syncing | synced | error
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [localDraftStatus, setLocalDraftStatus] = useState('idle'); // idle | saved | restored | error
  const [needsManualSync, setNeedsManualSync] = useState(false);
  const offlineEventsRef = useRef([]);
  const offlineStartedAtRef = useRef(null);
  const lastWarningAtRef = useRef(null);
  const exitEventSentRef = useRef(false);

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

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (wakeLockRef.current || locked || showConsentModal) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch (err) {
      console.warn('Screen Wake Lock unavailable:', err);
    }
  }, [locked, showConsentModal]);

  useEffect(() => {
    if (!fullscreenGranted || showConsentModal || locked) return;

    void requestWakeLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [fullscreenGranted, locked, requestWakeLock, showConsentModal]);

  // Auto-submit ref to avoid closure issues
  const submittingRef = useRef(false);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  async function processSubmit(isLockout = false) {
    setError('');

    try {
      if (!isOnline) {
        await saveLocalDraft({ pendingSync: true });
        setError('Tidak bisa mengumpulkan jawaban saat offline. Sambungkan internet terlebih dahulu, lalu coba kumpulkan lagi.');
        setSubmitting(false);
        return;
      }

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

      syncTerminatedRef.current = true;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      await deleteExamDraft(examId);

      if (isLockout) {
        router.replace('/dashboard/student/exams/lockout?reason=locked');
      } else {
        router.replace('/dashboard/student/exams?submitted=1');
      }
    } catch (err) {
      if (err.payload && err.payload.locked) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams/lockout?reason=locked');
        return;
      }
      if (err.payload && err.payload.disqualified) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams/lockout?reason=disqualified');
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

  const saveLocalDraft = useCallback(async (extra = {}) => {
    if (!examId || !sessionId || questions.length === 0) return;

    await writeExamDraft({
      examId,
      sessionId,
      answers,
      redisAnswers: buildRedisAnswers(),
      questionCount: questions.length,
      offlineEvents: offlineEventsRef.current.slice(-20),
      updatedAt: new Date().toISOString(),
      ...extra,
    });
  }, [answers, buildRedisAnswers, examId, questions.length, sessionId]);
  const saveLocalDraftRef = useRef(saveLocalDraft);

  useEffect(() => {
    saveLocalDraftRef.current = saveLocalDraft;
  }, [saveLocalDraft]);

  const syncExamCache = useCallback(async (force = false, violationOverride = null) => {
    if (!sessionId || !examId) return;
    if (syncTerminatedRef.current || locked) return;
    if (!force && !isDirty) return;

    await saveLocalDraft({ pendingSync: true });
    const localDraft = await readExamDraft(examId, sessionId);
    const answersForSync =
      localDraft?.sessionId === sessionId && localDraft.redisAnswers
        ? localDraft.redisAnswers
        : buildRedisAnswers();

    if (!isOnline) {
      await saveLocalDraft({ pendingSync: true });
      setSyncState('offline');
      return;
    }
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncState('syncing');
    try {
      const res = await fetch('/api/exam/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          sessionId,
          answers: answersForSync,
          violationCount: violationOverride ?? exitCount,
          offlineEvents: offlineEventsRef.current.slice(-20),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error || 'Sinkronisasi ditolak server.';
        const isTerminalSessionError =
          res.status === 400 &&
          (message.includes('Sesi ujian tidak valid') || message.includes('sudah berakhir'));

        if (isTerminalSessionError || res.status === 403) {
          if (data.locked || data.disqualified) {
            syncTerminatedRef.current = true;
            setSyncState('idle');
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            router.replace(`/dashboard/student/exams/lockout?reason=${data.disqualified ? 'disqualified' : 'locked'}`);
            return;
          }
          syncTerminatedRef.current = true;
          setSyncState('idle');
          await saveLocalDraft({ pendingSync: false, lastSyncError: message });
          return;
        }

        throw new Error(data.error || 'Sinkronisasi ditolak server.');
      }
      const data = await res.json().catch(() => ({}));
      if (data.autoSubmitted) {
        syncTerminatedRef.current = true;
        setIsDirty(false);
        setSyncState('synced');
        await deleteExamDraft(examId);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams?submitted=1');
        return;
      }
      setIsDirty(false);
      setSyncState('synced');
      setLastSyncedAt(new Date());
      setNeedsManualSync(false);
      offlineEventsRef.current = [];
      await saveLocalDraft({ pendingSync: false });
    } catch (err) {
      console.error('Redis sync failed:', err);
      setSyncState('error');
      await saveLocalDraft({ pendingSync: true, lastSyncError: err.message || 'sync-error' });
    } finally {
      syncInFlightRef.current = false;
    }
  }, [sessionId, examId, locked, isOnline, isDirty, saveLocalDraft, buildRedisAnswers, exitCount, router]);
  const syncExamCacheRef = useRef(syncExamCache);

  useEffect(() => {
    syncExamCacheRef.current = syncExamCache;
  }, [syncExamCache]);

  const recordExamEvent = useCallback(async (type, reason = 'unknown') => {
    if (!sessionId || !examId || syncTerminatedRef.current) return null;

    try {
      const res = await fetch(`/api/student/exams/${examId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          type,
          reason,
          clientAt: new Date().toISOString(),
        }),
      });
      return await res.json().catch(() => ({}));
    } catch (err) {
      console.error('Gagal mencatat event ujian:', err);
      return null;
    }
  }, [examId, sessionId]);

  const startFilePickerMode = useCallback(() => {
    if (violationTimerRef.current) {
      clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
    }
    if (filePickerReturnTimerRef.current) {
      clearTimeout(filePickerReturnTimerRef.current);
      filePickerReturnTimerRef.current = null;
    }
    filePickerOpenedAtRef.current = Date.now();
    isChoosingFileRef.current = true;
    setIsChoosingFile(true);
  }, []);

  const finishFilePickerMode = useCallback(() => {
    isChoosingFileRef.current = false;
    filePickerOpenedAtRef.current = null;
    setIsChoosingFile(false);
  }, []);

  const ensureFullscreenBeforeFilePicker = useCallback(async () => {
    if (document.fullscreenElement) return true;

    try {
      await document.documentElement.requestFullscreen();
      setFullscreenGranted(true);
      setShowFullscreenOverlay(false);
      return true;
    } catch {
      setShowFullscreenOverlay(true);
      return false;
    }
  }, []);

  const triggerStrike = useCallback(async (reason = 'focus-loss') => {
    if (!sessionId || isChoosingFileRef.current || locked || showConsentModal) return;

    const now = Date.now();
    if (violationInFlightRef.current || now - lastViolationAtRef.current < IMMEDIATE_VIOLATION_COOLDOWN_MS) {
      return;
    }

    violationInFlightRef.current = true;
    lastViolationAtRef.current = now;

    try {
      await syncExamCache(true);

      const res = await fetch(`/api/student/exams/${examId}/violation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason }),
      });
      const data = await res.json();

      if (data.locked) {
        setLocked(true);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams/lockout?reason=locked');
        return;
      }

      setExitCount(data.exitCount);
      setStrikeMessage(`Pelanggaran ke-${data.exitCount} tercatat. Jika mencapai ${MAX_VIOLATIONS} pelanggaran, ujian otomatis dikunci.`);
      setShowStrikeModal(true);
      await syncExamCache(true, data.exitCount);
      
    } catch (err) {
      console.error('Failed to record violation:', err);
      if (typeof navigator !== 'undefined' && (!navigator.onLine || !isOnline)) {
        offlineEventsRef.current = [
          ...offlineEventsRef.current,
          {
            type: 'offline-tab-activity',
            at: new Date().toISOString(),
            durationMs: null,
            answerChanges: null,
            reason,
          },
        ].slice(-20);
        setNeedsManualSync(true);
        setSyncState('offline');
        setToastMessage('Aktivitas keluar tab terdeteksi saat offline. Catatan akan dikirim saat internet kembali.');
        setTimeout(() => setToastMessage(''), 6000);
        await saveLocalDraft({ pendingSync: true });
      }
    } finally {
      violationInFlightRef.current = false;
    }
  }, [sessionId, examId, router, locked, showConsentModal, syncExamCache, isOnline, saveLocalDraft]);

  const verifyFilePickerReturn = useCallback(async (selectedFileCount = 0) => {
    const openedAt = filePickerOpenedAtRef.current;
    const timeAway = openedAt ? Date.now() - openedAt : 0;

    if (filePickerReturnTimerRef.current) {
      clearTimeout(filePickerReturnTimerRef.current);
      filePickerReturnTimerRef.current = null;
    }

    finishFilePickerMode();

    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setFullscreenGranted(true);
        setShowFullscreenOverlay(false);
      } catch {
        setShowFullscreenOverlay(true);
      }
    }

    if (timeAway > FILE_PICKER_SUSPICIOUS_AWAY_MS) {
      void triggerStrike(selectedFileCount > 0 ? 'file-picker-open-too-long' : 'file-picker-open-too-long-without-file');
      return;
    }

    filePickerReturnTimerRef.current = setTimeout(() => {
      if (document.hidden || !document.hasFocus()) {
        void triggerStrike('file-picker-return-lost-focus');
      }
      filePickerReturnTimerRef.current = null;
    }, FILE_PICKER_RETURN_WATCH_MS);
  }, [finishFilePickerMode, triggerStrike]);

  const handleLeaveTab = useCallback((reason = 'focus-loss', delayMs = LEAVE_VIOLATION_DELAY_MS) => {
    if (locked || !fullscreenGranted || isChoosingFileRef.current || showConsentModal) return;
    
    if (isMobileClient && (reason === 'visibility-hidden' || reason === 'window-blur')) {
      mobileHiddenAtRef.current = Date.now();
      mobileSleepWarningRef.current = true;
    }
    
    if (!violationTimerRef.current) {
      leftTabAtRef.current = Date.now();
      activeViolationReasonRef.current = reason;
      activeViolationDelayRef.current = delayMs;
      
      violationTimerRef.current = setTimeout(() => {
        void triggerStrike(reason);
        violationTimerRef.current = null;
        activeViolationReasonRef.current = null;
        activeViolationDelayRef.current = null;
      }, delayMs);
    }
  }, [isMobileClient, locked, fullscreenGranted, showConsentModal, triggerStrike]);

  const handleReturnTab = useCallback(async () => {
    if (locked || !fullscreenGranted || showConsentModal) return;

    let triggeredStrikeNow = false;

    if (violationTimerRef.current) {
      clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
      
      const timeAway = Date.now() - leftTabAtRef.current;
      const allowedDelay = activeViolationDelayRef.current || LEAVE_VIOLATION_DELAY_MS;
      const reason = activeViolationReasonRef.current || 'focus-loss';
      
      activeViolationReasonRef.current = null;
      activeViolationDelayRef.current = null;

      if (timeAway < allowedDelay) {
        if (!isChoosingFileRef.current) {
          setToastMessage('Peringatan: Jangan keluar dari layar ujian!');
          setTimeout(() => setToastMessage(''), 4000);
        }
      } else {
        void triggerStrike(reason);
        triggeredStrikeNow = true;
      }
    }

    if (isMobileClient && mobileSleepWarningRef.current) {
      mobileSleepWarningRef.current = false;
      const sleepDuration = mobileHiddenAtRef.current ? Math.round((Date.now() - mobileHiddenAtRef.current) / 1000) : null;
      mobileHiddenAtRef.current = null;
      
      if (!triggeredStrikeNow) {
        setToastMessage(
          sleepDuration && sleepDuration > 3
            ? `Layar Anda sempat mati/terkunci sekitar ${sleepDuration} detik. Pastikan layar tetap aktif selama ujian!`
            : 'Layar Anda sempat mati/terkunci. Pastikan layar tetap aktif selama ujian!'
        );
        setTimeout(() => setToastMessage(''), 6000);
      }
      
      void requestWakeLock();
      if (!document.fullscreenElement) {
        setShowFullscreenOverlay(true);
      }
    }

  }, [isMobileClient, locked, fullscreenGranted, requestWakeLock, showConsentModal, triggerStrike]);

  const handleUnsafeShortcut = useCallback((event) => {
    if (locked || !fullscreenGranted || isChoosingFileRef.current || showConsentModal) return;

    const key = event.key || '';
    const code = event.code || '';
    const isAltTab = event.altKey && (key === 'Tab' || code === 'Tab');
    const isWindowsKey = key === 'Meta' || code === 'MetaLeft' || code === 'MetaRight' || event.metaKey;
    const isSystemMenuShortcut = event.ctrlKey && (key === 'Escape' || code === 'Escape');
    const lowerKey = key.toLowerCase();
    const isDevToolsShortcut =
      key === 'F12' ||
      (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(lowerKey)) ||
      (event.ctrlKey && ['u', 's', 'p'].includes(lowerKey));

    if (!isAltTab && !isWindowsKey && !isSystemMenuShortcut && !isDevToolsShortcut) return;

    event.preventDefault();
    event.stopPropagation();
    if (violationTimerRef.current) {
      clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
    }
    leftTabAtRef.current = Date.now();
    setToastMessage(isDevToolsShortcut
      ? 'Pelanggaran terdeteksi: shortcut browser/inspect tidak diperbolehkan.'
      : 'Pelanggaran terdeteksi: shortcut keluar dari ujian digunakan.');
    setTimeout(() => setToastMessage(''), 4000);
    void triggerStrike(isDevToolsShortcut ? 'blocked-browser-shortcut' : isAltTab ? 'alt-tab' : isWindowsKey ? 'windows-key' : 'system-menu-shortcut');
    void syncExamCache(true);
  }, [locked, fullscreenGranted, showConsentModal, triggerStrike, syncExamCache]);

  const handleFileInputClick = useCallback(async (event) => {
    if (locked || showConsentModal) {
      event.preventDefault();
      return;
    }

    if (!document.fullscreenElement) {
      event.preventDefault();
      const fullscreenReady = await ensureFullscreenBeforeFilePicker();
      if (fullscreenReady) {
        setToastMessage('Mode fullscreen aktif. Klik upload file sekali lagi untuk memilih file.');
        setTimeout(() => setToastMessage(''), 4000);
      } else {
        setToastMessage('Masuk fullscreen terlebih dahulu sebelum memilih file.');
        setTimeout(() => setToastMessage(''), 4000);
      }
      return;
    }

    startFilePickerMode();
  }, [ensureFullscreenBeforeFilePicker, locked, showConsentModal, startFilePickerMode]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        const delay = isMobileClient ? MOBILE_LEAVE_VIOLATION_DELAY_MS : LEAVE_VIOLATION_DELAY_MS;
        handleLeaveTab('visibility-hidden', delay);
        void syncExamCache(true);
      } else handleReturnTab();
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (isMobileClient && mobileSleepWarningRef.current) {
          setShowFullscreenOverlay(true);
          return;
        }
        const delay = isMobileClient ? MOBILE_LEAVE_VIOLATION_DELAY_MS : LEAVE_VIOLATION_DELAY_MS;
        handleLeaveTab('fullscreen-exit', delay);
      }
      else handleReturnTab();
    };

    const onBlur = () => {
      if (isChoosingFileRef.current) return;
      const delay = isMobileClient ? MOBILE_FOCUS_LOSS_VIOLATION_DELAY_MS : FOCUS_LOSS_VIOLATION_DELAY_MS;
      handleLeaveTab('window-blur', delay);
      void syncExamCache(true);
    };

    const onFocus = () => {
      if (isChoosingFileRef.current) {
        if (filePickerReturnTimerRef.current) {
          clearTimeout(filePickerReturnTimerRef.current);
        }
        filePickerReturnTimerRef.current = setTimeout(() => {
          if (isChoosingFileRef.current) {
            void verifyFilePickerReturn(0);
          }
        }, 500);
        return;
      }

      handleReturnTab();
    };

    const onContextMenu = (event) => {
      if (locked || !fullscreenGranted || isChoosingFileRef.current || showConsentModal) return;
      event.preventDefault();
      event.stopPropagation();
      setToastMessage('Klik kanan dinonaktifkan selama ujian.');
      setTimeout(() => setToastMessage(''), 4000);
    };

    const onBlockedMobileInteraction = (event) => {
      if (locked || !fullscreenGranted || isChoosingFileRef.current || showConsentModal) return;
      event.preventDefault();
      event.stopPropagation();
      setToastMessage('Aksi salin/tempel/seleksi dinonaktifkan selama ujian.');
      setTimeout(() => setToastMessage(''), 4000);
      void triggerStrike(`blocked-${event.type}`);
      void syncExamCache(true);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', handleUnsafeShortcut, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('selectstart', onBlockedMobileInteraction, true);
    document.addEventListener('dragstart', onBlockedMobileInteraction, true);
    document.addEventListener('copy', onBlockedMobileInteraction, true);
    document.addEventListener('cut', onBlockedMobileInteraction, true);
    document.addEventListener('paste', onBlockedMobileInteraction, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', handleUnsafeShortcut, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('selectstart', onBlockedMobileInteraction, true);
      document.removeEventListener('dragstart', onBlockedMobileInteraction, true);
      document.removeEventListener('copy', onBlockedMobileInteraction, true);
      document.removeEventListener('cut', onBlockedMobileInteraction, true);
      document.removeEventListener('paste', onBlockedMobileInteraction, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      if (filePickerReturnTimerRef.current) {
        clearTimeout(filePickerReturnTimerRef.current);
        filePickerReturnTimerRef.current = null;
      }
    };
  }, [handleLeaveTab, handleReturnTab, handleUnsafeShortcut, isMobileClient, locked, fullscreenGranted, showConsentModal, syncExamCache, triggerStrike, verifyFilePickerReturn]);

  useEffect(() => {
    if (!sessionId || questions.length === 0) return;
    const interval = setInterval(() => {
      syncExamCacheRef.current(false);
    }, SERVER_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [questions.length, sessionId]);

  useEffect(() => {
    if (!sessionId || questions.length === 0 || locked || showConsentModal) return;

    const sendHeartbeat = async () => {
      if (syncTerminatedRef.current || !navigator.onLine) return;
      try {
        const res = await fetch(`/api/student/exams/${examId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.locked || data.disqualified) {
            syncTerminatedRef.current = true;
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            router.replace(`/dashboard/student/exams/lockout?reason=${data.disqualified ? 'disqualified' : 'locked'}`);
          }
        }
      } catch (err) {
        console.error('Heartbeat ujian gagal:', err);
      }
    };

    void sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [examId, locked, questions.length, router, sessionId, showConsentModal]);

  useEffect(() => {
    if (!sessionId || questions.length === 0) return;
    const interval = setInterval(() => {
      if (!isDirty) return;
      void saveLocalDraftRef.current({ pendingSync: true }).then(() => setLocalDraftStatus('saved'));
    }, LOCAL_DRAFT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isDirty, questions.length, sessionId]);

  useEffect(() => {
    if (localDraftStatus === 'restored' && isOnline && sessionId) {
      const timer = setTimeout(() => {
        void syncExamCache(true).finally(() => setLocalDraftStatus('saved'));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOnline, localDraftStatus, sessionId, syncExamCache]);

  useEffect(() => {
    const markOffline = () => {
      setIsOnline(false);
      setNeedsManualSync(true);
      setSyncState('offline');
      offlineStartedAtRef.current = Date.now();
      setToastMessage('Koneksi terputus. Jawaban sementara disimpan lokal dan belum tersimpan ke server.');
      setTimeout(() => setToastMessage(''), 6000);
      void saveLocalDraft({ pendingSync: true });
    };

    const markOnline = () => {
      setIsOnline(true);
      const startedAt = offlineStartedAtRef.current;
      if (startedAt) {
        offlineEventsRef.current.push({
          type: 'offline-period',
          at: new Date(startedAt).toISOString(),
          durationMs: Date.now() - startedAt,
          answerChanges: null,
        });
      }
      offlineStartedAtRef.current = null;
      setNeedsManualSync(true);
      setToastMessage('Koneksi kembali aktif. Menyinkronkan jawaban ke server...');
      setTimeout(() => setToastMessage(''), 6000);
      void syncExamCache(true);
    };

    window.addEventListener('offline', markOffline);
    window.addEventListener('online', markOnline);
    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', markOnline);
    };
  }, [saveLocalDraft, syncExamCache]);

  useEffect(() => {
    if (!sessionId || questions.length === 0 || locked || showConsentModal) return;

    const timer = setTimeout(async () => {
      const result = await recordExamEvent('unexpected-exit-return', 'exam-page-resumed');
      if (!result || result.ignored) return;

      if (result.locked) {
        setLocked(true);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.replace('/dashboard/student/exams/lockout?reason=locked');
        return;
      }

      if (Number.isFinite(Number(result.exitCount))) {
        setExitCount(Number(result.exitCount));
      }

      if (result.countedAsViolation) {
        setStrikeMessage(`Anda sebelumnya keluar dari halaman ujian terlalu lama atau terlalu sering. Pelanggaran tercatat (${result.exitCount}/${MAX_VIOLATIONS}).`);
        setShowStrikeModal(true);
      } else if (Number.isFinite(Number(result.unexpectedExitCount))) {
        setToastMessage('Anda kembali ke ujian. Kejadian keluar sebelumnya tercatat sebagai audit teknis.');
        setTimeout(() => setToastMessage(''), 6000);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [locked, questions.length, recordExamEvent, router, sessionId, showConsentModal]);

  useEffect(() => {
    if (!sessionId || locked || showConsentModal) return;

    const pollWarning = async () => {
      try {
        const res = await fetch(`/api/student/exams/${examId}/warning`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const warning = data?.warning;
        if (!warning?.message || warning.sentAt === lastWarningAtRef.current) return;

        lastWarningAtRef.current = warning.sentAt || new Date().toISOString();
        setStrikeMessage(`${warning.message}${warning.from ? `\n\nDari: ${warning.from}` : ''}`);
        setShowStrikeModal(true);
      } catch (err) {
        console.error('Gagal mengambil peringatan pengawas:', err);
      }
    };

    void pollWarning();
    const interval = setInterval(pollWarning, 5_000);
    return () => clearInterval(interval);
  }, [examId, locked, sessionId, showConsentModal]);

  useEffect(() => {
    if (!sessionId || questions.length === 0) return;

    const persistBeforeExit = () => {
      if (syncTerminatedRef.current || locked) return;
      void saveLocalDraftRef.current({
        pendingSync: true,
        lastPageExitAt: new Date().toISOString(),
      });

      if (typeof navigator === 'undefined' || !navigator.onLine || !navigator.sendBeacon) return;

      const payload = JSON.stringify({
        examId,
        sessionId,
        answers: buildRedisAnswers(),
        violationCount: exitCount,
        offlineEvents: offlineEventsRef.current.slice(-20),
      });
      navigator.sendBeacon('/api/exam/sync', new Blob([payload], { type: 'application/json' }));

      if (!exitEventSentRef.current) {
        exitEventSentRef.current = true;
        const eventPayload = JSON.stringify({
          sessionId,
          type: 'unexpected-exit-start',
          reason: document.visibilityState === 'hidden' ? 'page-hidden-or-closed' : 'page-exit',
          clientAt: new Date().toISOString(),
        });
        navigator.sendBeacon(
          `/api/student/exams/${examId}/events`,
          new Blob([eventPayload], { type: 'application/json' })
        );
      }
    };

    const handleBeforeUnload = (event) => {
      if (!isDirty || syncTerminatedRef.current || locked) return;
      persistBeforeExit();
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('pagehide', persistBeforeExit);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', persistBeforeExit);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [buildRedisAnswers, examId, exitCount, isDirty, locked, questions.length, sessionId]);

  // Start exam session on mount (fetches questions)
  useEffect(() => {
    const startExam = async () => {
      try {
        const res = await fetch(`/api/student/exams/${examId}/start`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
          if (data.locked || data.disqualified) {
            router.replace(`/dashboard/student/exams/lockout?reason=${data.disqualified ? 'disqualified' : 'locked'}`);
            return;
          }
          setError(data.error || 'Gagal memulai ujian.');
          setLoading(false);
          return;
        }

        setSessionId(data.sessionId);
        syncTerminatedRef.current = false;
        setQuestions(data.questions || []);
        setExitCount(data.exitCount || 0);
        setExamTitle(data.examTitle || 'Ujian');
        setExamDuration(data.examDuration || null);
        setStartedAt(data.startedAt || null);

        const loadedQuestions = data.questions || [];
        const localDraft = await readExamDraft(examId, data.sessionId);
        if (localDraft?.sessionId === data.sessionId && localDraft.answers && typeof localDraft.answers === 'object') {
          setAnswers(localDraft.answers);
          setIsDirty(!!localDraft.pendingSync);
          setNeedsManualSync(!!localDraft.pendingSync);
          offlineEventsRef.current = Array.isArray(localDraft.offlineEvents) ? localDraft.offlineEvents : [];
          setLocalDraftStatus('restored');
        } else if (data.draftAnswers) {
          const restoredAnswers = buildAnswersFromSyncedDraft(loadedQuestions, data.draftAnswers);
          if (Object.keys(restoredAnswers).length > 0) {
            setAnswers(restoredAnswers);
            setIsDirty(false);
            setLocalDraftStatus('restored');
            void writeExamDraft({
              examId,
              sessionId: data.sessionId,
              answers: restoredAnswers,
              redisAnswers: data.draftAnswers,
              questionCount: loadedQuestions.length,
              offlineEvents: Array.isArray(data.offlineEvents) ? data.offlineEvents : [],
              pendingSync: false,
              updatedAt: data.draftUpdatedAt || new Date().toISOString(),
            });
          }
        }

        if (data.examDuration && data.startedAt) {
          const start = new Date(data.startedAt).getTime();
          const durationMs = data.examDuration * 60 * 1000;
          const end = start + durationMs;
          const now = Date.now();
          const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));
          setTimeLeft(remainingSeconds);
        }

        if (data.exitCount >= MAX_VIOLATIONS) {
          router.replace('/dashboard/student/exams/lockout?reason=locked');
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
        setSubmitting(true);
        void processSubmit();
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
  }, [timeLeft, locked, fullscreenGranted, processSubmit]);

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
    setIsDirty(true);
  };

  const toggleMultipleChoiceAnswer = (questionOrder, optionIndex, requiredSelections = null) => {
    setAnswers(prev => {
      const current = normalizeSelectedAnswers(prev[questionOrder]?.mcAnswer);
      const exists = current.includes(optionIndex);
      const maxSelections = Number.isFinite(Number(requiredSelections)) ? Number(requiredSelections) : null;
      if (!exists && maxSelections && current.length >= maxSelections) {
        setToastMessage(`Soal ${questionOrder}: maksimal pilih ${maxSelections} jawaban.`);
        setTimeout(() => setToastMessage(''), 4000);
        return prev;
      }
      const next = exists
        ? current.filter((idx) => idx !== optionIndex)
        : [...current, optionIndex].sort((a, b) => a - b);
      return {
        ...prev,
        [questionOrder]: { ...prev[questionOrder], questionOrder, mcAnswer: next },
      };
    });
    setIsDirty(true);
  };

  const updateFileAnswer = useCallback((questionOrder, files) => {
    setFileAnswers(prev => ({ ...prev, [questionOrder]: files }));
    setIsDirty(true);
  }, []);

  const handleFileInputChange = useCallback(async (event, questionOrder) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) {
      await verifyFilePickerReturn(0);
      return;
    }

    const validation = validateFiles(files);
    
    if (!validation.valid) {
      alert(`Kesalahan Upload:\n${validation.errors.join('\n')}\n\nPastikan format file sesuai dan ukuran maksimal 50MB per file.`);
      event.target.value = '';
      await verifyFilePickerReturn(files.length);
      return;
    }

    updateFileAnswer(questionOrder, files);
    await verifyFilePickerReturn(files.length);
  }, [updateFileAnswer, verifyFilePickerReturn]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!isOnline) {
      await saveLocalDraft({ pendingSync: true });
      setError('Tidak bisa mengumpulkan jawaban saat offline. Sambungkan internet terlebih dahulu, lalu coba kumpulkan lagi.');
      return;
    }

    const confirmed = window.confirm('Anda yakin ingin mengumpulkan jawaban? Tindakan ini tidak dapat dibatalkan.');
    if (!confirmed) return;

    setSubmitting(true);
    await syncExamCache(true);
    await processSubmit();
  };

  const hasPendingLocalDraft = needsManualSync || syncState === 'offline' || localDraftStatus === 'restored';
  const canManualSync = isOnline && hasPendingLocalDraft && syncState !== 'syncing';
  const isQuestionAnswered = useCallback((question) => {
    if (!question) return false;
    const answer = answers[question.displayOrder] || {};

    if (question.multipleChoice) {
      if (Array.isArray(answer.mcAnswer)) return answer.mcAnswer.length > 0;
      if (answer.mcAnswer !== null && answer.mcAnswer !== undefined) return true;
    }

    if (question.essay && typeof answer.essayAnswer === 'string' && answer.essayAnswer.trim() !== '') {
      return true;
    }

    if (question.fileUpload && Array.isArray(fileAnswers[question.displayOrder]) && fileAnswers[question.displayOrder].length > 0) {
      return true;
    }

    return false;
  }, [answers, fileAnswers]);

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
            Untuk menjaga integritas, ujian ini diwajibkan dalam mode <strong>Layar Penuh (Fullscreen)</strong>. Jika Anda terdeteksi pindah tab, membuka aplikasi lain, menekan shortcut sistem seperti Alt+Tab atau tombol Windows, atau keluar dari layar penuh, sistem akan mencatat pelanggaran.<br /><br />
            Pada perangkat mobile, sistem akan mencoba menjaga layar tetap menyala. Jika layar sempat mati/terkunci, Anda akan diminta kembali ke fullscreen dan pastikan layar tetap aktif selama ujian.<br /><br />
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
                  void requestWakeLock();
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
                void requestWakeLock();
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
                try {
                  await document.documentElement.requestFullscreen();
                  setFullscreenGranted(true);
                  void requestWakeLock();
                } catch(e){}
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
            {syncState === 'offline' && '⚠ Offline: jawaban tersimpan lokal, belum tersimpan ke server'}
            {syncState === 'idle' && '• Auto-save siap'}
            {localDraftStatus === 'restored' && ' • Draft lokal dipulihkan'}
          </p>
        </div>
        <div className={ex.examHeaderActions}>
          {hasPendingLocalDraft && (
            <button
              type="button"
              className={ex.examSyncBtn}
              disabled={!canManualSync}
              onClick={() => { void syncExamCache(true); }}
            >
              {syncState === 'syncing' ? 'Menyinkronkan...' : isOnline ? 'Sinkronkan Jawaban' : 'Menunggu Internet'}
            </button>
          )}
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
      {!isOnline && (
        <div className={ex.examOfflineInstruction} role="status" aria-live="polite">
          <strong>Koneksi internet terputus</strong>
          <p>
            Jangan tutup tab, jangan refresh halaman, dan jangan keluar dari mode layar penuh. Tetap kerjakan soal; jawaban disimpan di perangkat ini dan akan disinkronkan otomatis saat internet kembali.
          </p>
          <p>
            Deteksi aktivitas tab tetap berjalan di browser, tetapi pencatatan ke server baru dikirim setelah koneksi aktif lagi.
          </p>
        </div>
      )}
      {questions.length > 1 && (
        <nav className={ex.examQuestionShortcut} aria-label="Navigasi nomor soal">
          <div className={ex.examQuestionShortcutHead}>
            <strong>Nomor Soal</strong>
            <span>Klik nomor untuk pindah soal</span>
            <button
              type="button"
              className={ex.examQuestionShortcutToggle}
              onClick={() => setShowQuestionShortcut((prev) => !prev)}
              aria-expanded={showQuestionShortcut}
              aria-controls="exam-question-shortcut-grid"
            >
              Soal {questions[currentQuestionIndex]?.displayOrder || currentQuestionIndex + 1}
              <span>{showQuestionShortcut ? 'Tutup' : 'Buka'}</span>
            </button>
          </div>
          <div
            id="exam-question-shortcut-grid"
            className={`${ex.examQuestionShortcutGrid} ${!showQuestionShortcut ? ex.examQuestionShortcutGridCollapsed : ''}`}
          >
            {questions.map((question, index) => {
              const isCurrent = index === currentQuestionIndex;
              const isAnswered = isQuestionAnswered(question);
              return (
                <button
                  key={`${question.displayOrder}-${index}`}
                  type="button"
                  className={`${ex.examQuestionShortcutBtn} ${isCurrent ? ex.examQuestionShortcutActive : ''} ${isAnswered ? ex.examQuestionShortcutAnswered : ''}`}
                  onClick={() => {
                    setCurrentQuestionIndex(index);
                    setShowQuestionShortcut(false);
                  }}
                  disabled={submitting}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Buka soal ${question.displayOrder}${isAnswered ? ', sudah dijawab' : ', belum dijawab'}`}
                >
                  {question.displayOrder}
                </button>
              );
            })}
          </div>
        </nav>
      )}

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
                <div className={q.essay ? ex.examSectionSpaced : undefined}>
                  <div
                    className={ex.examQuestionText}
                    dangerouslySetInnerHTML={{ __html: q.multipleChoice.questionText }}
                  />
                  {q.multipleChoice.multipleAnswers && (
                    <p className={ex.examQuestionHint}>
                      Pilih maksimal {q.multipleChoice.minSelections || 1} jawaban yang paling tepat. Jawaban kurang dari itu tetap dinilai parsial jika sesuai kunci.
                    </p>
                  )}
                  <div className={ex.examOptionsList}>
                    {q.multipleChoice.options.map((opt, idx) => {
                      const isMulti = !!q.multipleChoice.multipleAnswers;
                      const isSelected = isMulti
                        ? normalizeSelectedAnswers(answers[q.displayOrder]?.mcAnswer).includes(idx)
                        : answers[q.displayOrder]?.mcAnswer === idx;
                      return (
                        <label key={idx} className={`${ex.examOption} ${isSelected ? ex.examOptionSelected : ''}`}>
                          <input
                            type={isMulti ? 'checkbox' : 'radio'}
                            name={`mc-${q.displayOrder}`}
                            checked={isSelected}
                            onChange={() => {
                              if (isMulti) toggleMultipleChoiceAnswer(q.displayOrder, idx, q.multipleChoice.minSelections || 1);
                              else updateAnswer(q.displayOrder, 'mcAnswer', idx);
                            }}
                            className={ex.examOptionRadio}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {q.essay && (
                <div>
                  <div
                    className={`${ex.examQuestionText} ${ex.examQuestionTextSmall}`}
                    dangerouslySetInnerHTML={{ __html: q.essay.questionText }}
                  />
                  <textarea className={`${styles.input} ${ex.examEssayInput}`} placeholder="Tuliskan jawaban Anda di sini..." value={answers[q.displayOrder]?.essayAnswer || ''} onChange={(e) => updateAnswer(q.displayOrder, 'essayAnswer', e.target.value)} />
                </div>
              )}

              {FILE_UPLOAD_EXAMS_ENABLED && q.fileUpload && (
                <div>
                  <p className={`${ex.examQuestionText} ${ex.examQuestionTextSmall}`}>{q.fileUpload.questionText}</p>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT_STR}
                    className={`${styles.input} ${ex.examFileInput}`}
                    onClick={handleFileInputClick}
                    onCancel={() => { void verifyFilePickerReturn(0); }}
                    onChange={(e) => handleFileInputChange(e, q.displayOrder)}
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

