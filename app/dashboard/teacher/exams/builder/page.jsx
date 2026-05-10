'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './exam-builder.module.css';

function createEmptyQuestion(type = 'multipleChoice') {
  return {
    type,
    required: true,
    imageUrl: null,
    imageSize: 0,
    multipleChoice: type === 'multipleChoice' ? { questionText: '', options: ['', ''], correctAnswer: null, explanation: '' } : null,
    essay: type === 'essay' ? { questionText: '', explanation: '' } : null,
    fileUpload: type === 'fileUpload' ? { questionText: '', explanation: '' } : null,
  };
}

const STEP_META = [
  { key: 1, title: 'Informasi Ujian', subtitle: 'Atur detail ujian' },
  { key: 2, title: 'Soal & Pengaturan', subtitle: 'Buat soal dan atur opsi' },
  { key: 3, title: 'Tinjau & Publikasi', subtitle: 'Periksa dan publikasikan' },
];

const DEFAULT_TYPE_SETTINGS = [
  { id: 'multipleChoice', label: 'Pilihan Ganda', desc: 'Siswa memilih satu jawaban yang benar', enabled: true, color: 'green' },
  { id: 'essay', label: 'Esai', desc: 'Siswa menjawab dengan uraian', enabled: false, color: 'orange' },
  { id: 'fileUpload', label: 'File Upload', desc: 'Siswa mengunggah file sebagai jawaban', enabled: false, color: 'blue' },
];

export default function ExamBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [currentStep, setCurrentStep] = useState(1);
  const [savingState, setSavingState] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(!!editId);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classCode, setClassCode] = useState('');
  const [examCategory, setExamCategory] = useState('ulangan');
  const [validationStatus, setValidationStatus] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [duration, setDuration] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isRandomized, setIsRandomized] = useState(false);
  const [isOptionRandomized, setIsOptionRandomized] = useState(false);
  const [showExplanationToStudent, setShowExplanationToStudent] = useState(false);
  const [lockExamPro, setLockExamPro] = useState(false);

  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [questions, setQuestions] = useState([createEmptyQuestion('multipleChoice')]);
  const [typeSettings, setTypeSettings] = useState(DEFAULT_TYPE_SETTINGS);

  useEffect(() => {
    async function loadDependencies() {
      try {
        const res = await fetch('/api/teacher/subjects');
        const data = await res.json();
        if (res.ok) setTeacherSubjects(data.subjects || []);
      } catch (e) {
        console.error('Failed loading dependencies:', e);
      }
    }
    loadDependencies();
  }, []);

  useEffect(() => {
    if (!editId) return;
    async function loadExam() {
      try {
        const res = await fetch(`/api/teacher/exams/${editId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Gagal memuat ujian.');
          return;
        }
        const exam = data.exam;
        setTitle(exam.title || '');
        setSubjectId(exam.subjectId || '');
        setExamCategory(exam.examCategory === 'semester' ? 'semester' : 'ulangan');
        setValidationStatus(exam.validationStatus || '');
        setRevisionNote(exam.revisionNote || '');
        setIsRandomized(!!exam.isRandomized);
        setIsOptionRandomized(!!exam.isOptionRandomized);
        setShowExplanationToStudent(!!exam.showExplanation);
        setDuration(exam.duration ? exam.duration.toString() : '');
        if (exam.deadline) {
          const d = new Date(exam.deadline);
          const tzOffset = d.getTimezoneOffset() * 60000;
          setDeadline(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
        }
        const mapped = (exam.questions || []).map((q) => {
          if (q.multipleChoice) {
            return {
              ...createEmptyQuestion('multipleChoice'),
              type: 'multipleChoice',
              imageUrl: q.imageUrl || null,
              imageSize: q.imageSize || 0,
              multipleChoice: {
                questionText: q.multipleChoice.questionText || '',
                options: q.multipleChoice.options?.length ? q.multipleChoice.options : ['', ''],
                correctAnswer: q.multipleChoice.correctAnswer ?? null,
                explanation: q.multipleChoice.explanation || '',
              },
            };
          }
          if (q.essay) {
            return {
              ...createEmptyQuestion('essay'),
              type: 'essay',
              imageUrl: q.imageUrl || null,
              imageSize: q.imageSize || 0,
              essay: {
                questionText: q.essay.questionText || '',
                explanation: q.essay.explanation || '',
              },
            };
          }
          return {
            ...createEmptyQuestion('fileUpload'),
            type: 'fileUpload',
            imageUrl: q.imageUrl || null,
            imageSize: q.imageSize || 0,
            fileUpload: {
              questionText: q.fileUpload?.questionText || '',
              explanation: q.fileUpload?.explanation || '',
            },
          };
        });
        if (mapped.length) setQuestions(mapped);
        const savedTypeSettings = exam.typeSettings;
        if (savedTypeSettings && typeof savedTypeSettings === 'object') {
          setTypeSettings((prev) =>
            prev.map((t) => ({
              ...t,
              enabled: Boolean(savedTypeSettings[t.id]),
            }))
          );
        } else {
          const detected = {
            multipleChoice: mapped.some((q) => q.type === 'multipleChoice'),
            essay: mapped.some((q) => q.type === 'essay'),
            fileUpload: mapped.some((q) => q.type === 'fileUpload'),
          };
          if (!detected.multipleChoice && !detected.essay && !detected.fileUpload) {
            detected.multipleChoice = true;
          }
          setTypeSettings((prev) =>
            prev.map((t) => ({
              ...t,
              enabled: Boolean(detected[t.id]),
            }))
          );
        }
      } catch {
        setError('Gagal memuat data ujian.');
      } finally {
        setInitialLoading(false);
      }
    }
    loadExam();
  }, [editId]);

  useEffect(() => {
    if (!editId) {
      setInitialLoading(false);
      return;
    }
  }, [editId]);

  useEffect(() => {
    const selected = teacherSubjects.find((s) => s._id === subjectId);
    setClassCode(selected?.classCode || '');
  }, [subjectId, teacherSubjects]);

  const selectedQuestion = questions[selectedQuestionIndex] || null;
  const enabledQuestionTypes = typeSettings.filter((t) => t.enabled);
  const enabledQuestionTypeIds = enabledQuestionTypes.map((t) => t.id);
  const typeCounts = useMemo(() => ({
    multipleChoice: questions.filter((q) => q.type === 'multipleChoice').length,
    essay: questions.filter((q) => q.type === 'essay').length,
    fileUpload: questions.filter((q) => q.type === 'fileUpload').length,
  }), [questions]);

  const canGoStep2 = title.trim() && subjectId;
  const canGoStep3 = questions.length > 0 && questions.every((q) => {
    if (q.type === 'multipleChoice') {
      return q.multipleChoice?.questionText?.trim() && (q.multipleChoice.options || []).every((o) => o.trim()) && q.multipleChoice.correctAnswer !== null;
    }
    if (q.type === 'essay') return q.essay?.questionText?.trim();
    return q.fileUpload?.questionText?.trim();
  });

  const examSummary = {
    title: title || '-',
    subject: teacherSubjects.find((s) => s._id === subjectId)?.subjectName || '-',
    classCode: classCode || '-',
    duration: duration ? `${duration} menit` : 'Tanpa batas waktu',
    deadline: deadline ? new Date(deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Tidak ada batas akhir',
  };

  function updateQuestion(index, updater) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? updater(q) : q)));
  }

  async function handleImageUpload(index, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar.');
      return;
    }
    setUploadingImageIndex(index);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/teacher/exams/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal mengunggah gambar.');
        return;
      }
      updateQuestion(index, (q) => ({ ...q, imageUrl: data.imageUrl, imageSize: data.imageSize || 0 }));
    } catch {
      alert('Koneksi server gagal saat upload gambar.');
    } finally {
      setUploadingImageIndex(null);
    }
  }

  function removeImage(index) {
    updateQuestion(index, (q) => ({ ...q, imageUrl: null, imageSize: 0 }));
  }

  function handleToggleType(typeId, checked) {
    const enabledCount = typeSettings.filter((t) => t.enabled).length;
    if (!checked && enabledCount <= 1) {
      alert('Minimal satu jenis soal harus aktif.');
      return;
    }
    setTypeSettings((prev) => prev.map((t) => (t.id === typeId ? { ...t, enabled: checked } : t)));
  }

  function goToNextStep() {
    if (currentStep === 1) {
      if (!title.trim()) {
        const msg = 'Judul ujian wajib diisi.';
        setError(msg);
        alert(msg);
        return;
      }
      if (!subjectId) {
        const msg = 'Mata pelajaran wajib dipilih.';
        setError(msg);
        alert(msg);
        return;
      }
      setError('');
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (!canGoStep3) {
        const msg = 'Masih ada soal yang belum lengkap.';
        setError(msg);
        alert(msg);
        return;
      }
      setError('');
      setCurrentStep(3);
    }
  }

  function addQuestionByType(type) {
    setQuestions((prev) => [...prev, createEmptyQuestion(type)]);
    setSelectedQuestionIndex(questions.length);
    setCurrentStep(2);
  }

  function getNextQuestionType() {
    const enabled = typeSettings.filter((t) => t.enabled).map((t) => t.id);
    if (enabled.includes('multipleChoice')) return 'multipleChoice';
    if (enabled.includes('essay')) return 'essay';
    return 'fileUpload';
  }

  function removeQuestion(index) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    setSelectedQuestionIndex((prev) => Math.max(0, Math.min(prev, questions.length - 2)));
  }

  function moveQuestion(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const arr = [...prev];
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
    setSelectedQuestionIndex(target);
  }

  function duplicateQuestion(index) {
    const copy = JSON.parse(JSON.stringify(questions[index]));
    setQuestions((prev) => {
      const arr = [...prev];
      arr.splice(index + 1, 0, copy);
      return arr;
    });
    setSelectedQuestionIndex(index + 1);
  }

  function mapToPayload() {
    const cleanQuestions = questions.map((q, idx) => ({
      order: idx + 1,
      imageUrl: q.imageUrl || null,
      imageSize: q.imageSize || 0,
      multipleChoice: q.type === 'multipleChoice' ? {
        questionText: q.multipleChoice?.questionText || '',
        options: q.multipleChoice?.options || [],
        correctAnswer: q.multipleChoice?.correctAnswer ?? null,
        explanation: q.multipleChoice?.explanation || '',
      } : null,
      essay: q.type === 'essay' ? {
        questionText: q.essay?.questionText || '',
        explanation: q.essay?.explanation || '',
      } : null,
      fileUpload: q.type === 'fileUpload' ? {
        questionText: q.fileUpload?.questionText || '',
        explanation: q.fileUpload?.explanation || '',
      } : null,
    }));

    return {
      title: title.trim(),
      subjectId,
      questions: cleanQuestions,
      typeSettings: {
        multipleChoice: !!typeSettings.find((t) => t.id === 'multipleChoice')?.enabled,
        essay: !!typeSettings.find((t) => t.id === 'essay')?.enabled,
        fileUpload: !!typeSettings.find((t) => t.id === 'fileUpload')?.enabled,
      },
      isRandomized,
      isOptionRandomized,
      duration: duration ? parseInt(duration, 10) : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      examCategory,
      showExplanation: showExplanationToStudent,
    };
  }

  async function saveExam() {
    setError('');
    if (!title.trim()) {
      setError('Judul ujian wajib diisi.');
      return { ok: false };
    }
    if (!subjectId) {
      setError('Mata pelajaran wajib dipilih.');
      return { ok: false };
    }
    if (!questions.length) {
      setError('Minimal harus ada satu soal.');
      alert('Minimal harus ada satu soal.');
      return { ok: false };
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type === 'multipleChoice') {
        const text = q.multipleChoice?.questionText?.trim();
        const opts = q.multipleChoice?.options || [];
        if (!text) {
          const msg = `Soal #${i + 1}: Teks soal pilihan ganda wajib diisi.`;
          setError(msg);
          alert(msg);
          return { ok: false };
        }
        if (opts.length < 2) {
          const msg = `Soal #${i + 1}: Minimal harus ada 2 opsi jawaban.`;
          setError(msg);
          alert(msg);
          return { ok: false };
        }
        if (opts.some((o) => !o.trim())) {
          const msg = `Soal #${i + 1}: Semua opsi jawaban wajib diisi.`;
          setError(msg);
          alert(msg);
          return { ok: false };
        }
        if (q.multipleChoice?.correctAnswer === null || q.multipleChoice?.correctAnswer === undefined) {
          const msg = `Soal #${i + 1}: Pilih satu jawaban benar.`;
          setError(msg);
          alert(msg);
          return { ok: false };
        }
      }
      if (q.type === 'essay' && !q.essay?.questionText?.trim()) {
        const msg = `Soal #${i + 1}: Teks soal esai wajib diisi.`;
        setError(msg);
        alert(msg);
        return { ok: false };
      }
      if (q.type === 'fileUpload' && !q.fileUpload?.questionText?.trim()) {
        const msg = `Soal #${i + 1}: Teks instruksi file upload wajib diisi.`;
        setError(msg);
        alert(msg);
        return { ok: false };
      }
    }

    const payload = mapToPayload();
    try {
      const url = editId ? `/api/teacher/exams/${editId}` : '/api/teacher/exams';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan ujian.');
        return { ok: false };
      }
      return { ok: true, id: data.id || editId };
    } catch {
      setError('Koneksi ke server gagal.');
      return { ok: false };
    }
  }

  async function handleSaveDraft() {
    setStatusMessage('');
    setSavingState('saving');
    const result = await saveExam();
    setSavingState(result.ok ? 'saved' : 'idle');
    if (result.ok && !editId && result.id) {
      router.replace(`/dashboard/teacher/exams/builder?id=${result.id}`);
    }
    if (result.ok) {
      setStatusMessage('Draft ujian berhasil disimpan.');
    }
  }

  async function handlePublishExam() {
    setStatusMessage('');
    setSavingState('saving');
    const result = await saveExam();
    if (!result.ok || !result.id) {
      setSavingState('idle');
      return;
    }
    if (examCategory === 'semester') {
      setSavingState('saved');
      setStatusMessage('Ujian semester dikirim ke kurikulum untuk proses approval.');
      router.push('/dashboard/teacher/exams');
      return;
    }
    try {
      const res = await fetch(`/api/teacher/exams/${result.id}/publish`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mempublikasikan ujian.');
        setSavingState('idle');
        return;
      }
      setSavingState('published');
      router.push('/dashboard/teacher/exams');
    } catch {
      setError('Koneksi ke server gagal saat publikasi.');
      setSavingState('idle');
    }
  }

  if (initialLoading) {
    return <div className={styles.loadingState}>Memuat data ujian...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
        <div className={styles.breadcrumb}>Ujian &gt; Buat Ujian Baru</div>
        <div className={styles.pageTitleRow}>
          <div className={styles.pageIcon}>▦</div>
          <div>
            <h1 className={styles.pageTitle}>Buat Ujian Baru</h1>
            <p className={styles.pageSubtitle}>Buat dan atur ujian untuk siswa Anda</p>
          </div>
        </div>
        <button className={styles.btnBack} onClick={() => router.push('/dashboard/teacher/exams')}>
          ← Kembali ke Bank Ujian
        </button>
      </div>
        <div className={styles.topActions}>
          <button className={styles.btnGhost} onClick={handleSaveDraft} disabled={savingState === 'saving'}>Simpan Draft</button>
          <button className={styles.btnPrimary} onClick={handlePublishExam} disabled={savingState === 'saving'}>
            {examCategory === 'semester' ? 'Kirim ke Kurikulum' : 'Publikasikan Ujian'}
          </button>
        </div>
      </div>

      {validationStatus === 'NeedsRevision' && (
        <div className={styles.errorBanner}>
          Ujian ini diminta revisi oleh kurikulum. Catatan: {revisionNote || 'Periksa kembali kualitas soal.'}
        </div>
      )}

      <div className={styles.stepper}>
        {STEP_META.map((step, idx) => {
          const isDone = currentStep > step.key;
          const isActive = currentStep === step.key;
          const canNavigate = step.key < currentStep;
          return (
            <div key={step.key} className={styles.stepItem}>
              <button className={`${styles.stepCircle} ${isDone ? styles.stepDone : ''} ${isActive ? styles.stepActive : ''}`} onClick={() => canNavigate && setCurrentStep(step.key)}>
                {isDone ? '✓' : step.key}
              </button>
              <div className={styles.stepLabel}>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepSub}>{step.subtitle}</div>
              </div>
              {idx < STEP_META.length - 1 && <div className={styles.stepLine} />}
            </div>
          );
        })}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {statusMessage && <div className={styles.successBanner}>{statusMessage}</div>}

      {currentStep === 1 && (
        <div className={styles.grid2}>
          <div className={styles.colLeft}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Informasi Ujian</h3>
              <div className={styles.formGroup}>
                <label>Judul Ujian *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Ujian Tengah Semester - Matematika" />
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.formGroup}>
                  <label>Integrasi Mata Pelajaran *</label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!!editId}>
                    <option value="">Pilih mata pelajaran</option>
                    {teacherSubjects.map((s) => <option key={s._id} value={s._id}>{s.subjectName}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Kelas (Otomatis)</label>
                  <input value={classCode || ''} disabled placeholder="Pilih kelas" />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Kategori Ujian *</label>
                <select value={examCategory} onChange={(e) => setExamCategory(e.target.value)}>
                  <option value="ulangan">Ulangan Biasa (tanpa approval kurikulum)</option>
                  <option value="semester">Ujian Semester (wajib approval kurikulum)</option>
                </select>
              </div>
              <div className={styles.formGrid2}>
                <div className={styles.switchField}>
                  <div>
                    <div className={styles.switchTitle}>Acak Urutan Soal</div>
                    <div className={styles.switchSub}>Soal akan ditampilkan secara acak</div>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" checked={isRandomized} onChange={(e) => setIsRandomized(e.target.checked)} />
                    <span />
                  </label>
                </div>
                <div className={styles.formGroup}>
                  <label>Durasi Pengerjaan (Menit)</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Contoh: 90" />
                </div>
              </div>
              <div className={styles.switchField}>
                <div>
                  <div className={styles.switchTitle}>Acak Opsi Pilihan Ganda</div>
                  <div className={styles.switchSub}>Urutan opsi A/B/C/D diacak berbeda untuk tiap siswa</div>
                </div>
                <label className={styles.switch}>
                  <input type="checkbox" checked={isOptionRandomized} onChange={(e) => setIsOptionRandomized(e.target.checked)} />
                  <span />
                </label>
              </div>
              <div className={styles.formGroup}>
                <label>Batas Akhir Pengerjaan (Deadline)</label>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                <small>Kosongkan jika tidak ada batas akhir</small>
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Opsi Tambahan</h3>
              {[
                { label: 'Tampilkan Pembahasan', sub: 'Siswa dapat melihat pembahasan setelah ujian selesai', val: showExplanationToStudent, set: setShowExplanationToStudent },
              ].map((row) => (
                <div key={row.label} className={styles.switchField}>
                  <div>
                    <div className={styles.switchTitle}>{row.label}</div>
                    <div className={styles.switchSub}>{row.sub}</div>
                  </div>
                  <label className={styles.switch}>
                    <input type="checkbox" checked={row.val} onChange={(e) => row.set(e.target.checked)} />
                    <span />
                  </label>
                </div>
              ))}
            </section>
          </div>

          <div className={styles.colRight}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Pengaturan Soal</h3>
              <p className={styles.cardDesc}>Atur preferensi untuk soal dalam ujian</p>
              <div className={styles.typeList}>
                {typeSettings.map((t) => (
                  <div key={t.id} className={styles.typeRow}>
                    <div className={`${styles.typeIcon} ${styles[`type${t.color}`]}`}>✓</div>
                    <div className={styles.typeInfo}>
                      <div>{t.label}</div>
                      <small>{t.desc}</small>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={t.enabled}
                        onChange={(e) => handleToggleType(t.id, e.target.checked)}
                      />
                      <span />
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Ringkasan Ujian</h3>
              <div className={styles.summaryList}>
                <div><span>Judul</span><strong>{examSummary.title}</strong></div>
                <div><span>Mata Pelajaran</span><strong>{examSummary.subject}</strong></div>
                <div><span>Kelas</span><strong>{examSummary.classCode}</strong></div>
                <div><span>Durasi</span><strong>{examSummary.duration}</strong></div>
                <div><span>Deadline</span><strong>{examSummary.deadline}</strong></div>
              </div>
            </section>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className={styles.grid3}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Daftar Soal</h3>
            <div className={styles.questionList}>
              {questions.map((q, idx) => (
                <button key={`${q.type}-${idx}`} className={`${styles.questionItem} ${idx === selectedQuestionIndex ? styles.questionItemActive : ''}`} onClick={() => setSelectedQuestionIndex(idx)}>
                  <div className={styles.questionItemMain}>
                    <strong>{q.type === 'multipleChoice' ? `Soal ${idx + 1}` : q.type === 'essay' ? `Esai ${idx + 1}` : `File Upload ${idx + 1}`}</strong>
                    <small>{q.type === 'multipleChoice' ? 'Pilihan Ganda' : q.type === 'essay' ? 'Esai' : 'File Upload'}</small>
                  </div>
                </button>
              ))}
            </div>
            <div className={styles.inlineButtons}>
              <button
                className={styles.btnDashed}
                onClick={() => addQuestionByType(getNextQuestionType())}
              >
                + Tambah Soal
              </button>
            </div>
            <div className={styles.totalText}>Total: {questions.length} soal</div>

            <div className={styles.cardSubBlock}>
              <h4>Pengaturan Ujian</h4>
              {[
                { label: 'Acak Urutan Soal', val: isRandomized, set: setIsRandomized },
                { label: 'Acak Opsi Pilihan Ganda', val: isOptionRandomized, set: setIsOptionRandomized },
                { label: 'Kunci Ujian', val: lockExamPro, set: setLockExamPro },
              ].map((row) => (
                <div key={row.label} className={styles.switchField}>
                  <div className={styles.switchTitle}>{row.label}</div>
                  <label className={styles.switch}>
                    <input type="checkbox" checked={row.val} onChange={(e) => row.set(e.target.checked)} />
                    <span />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            {selectedQuestion && (
              <>
                <div className={styles.editorTop}>
                  <h3>Soal {selectedQuestionIndex + 1}</h3>
                  <div className={styles.editorActions}>
                    <button className={styles.btnGhost} onClick={() => duplicateQuestion(selectedQuestionIndex)}>Duplikat</button>
                    <button className={styles.btnGhost} onClick={() => moveQuestion(selectedQuestionIndex, -1)}>↑</button>
                    <button className={styles.btnGhost} onClick={() => moveQuestion(selectedQuestionIndex, 1)}>↓</button>
                    <button className={styles.btnDanger} onClick={() => removeQuestion(selectedQuestionIndex)}>Hapus</button>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Teks Soal *</label>
                  <div className={styles.imageTools}>
                    <label className={styles.imageUploadBtn}>
                      {uploadingImageIndex === selectedQuestionIndex ? 'Mengunggah...' : 'Upload Gambar Soal'}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => handleImageUpload(selectedQuestionIndex, e.target.files?.[0])}
                      />
                    </label>
                    {selectedQuestion.imageUrl && (
                      <button type="button" className={styles.btnDanger} onClick={() => removeImage(selectedQuestionIndex)}>
                        Hapus Gambar
                      </button>
                    )}
                  </div>
                  {selectedQuestion.imageUrl && (
                    <div className={styles.imageInfo}>Gambar terpasang untuk soal ini.</div>
                  )}
                  {selectedQuestion.type === 'multipleChoice' && (
                    <textarea
                      value={selectedQuestion.multipleChoice?.questionText || ''}
                      onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, multipleChoice: { ...q.multipleChoice, questionText: e.target.value } }))}
                      rows={5}
                    />
                  )}
                  {selectedQuestion.type === 'essay' && (
                    <textarea
                      value={selectedQuestion.essay?.questionText || ''}
                      onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, essay: { ...q.essay, questionText: e.target.value } }))}
                      rows={5}
                    />
                  )}
                  {selectedQuestion.type === 'fileUpload' && (
                    <textarea
                      value={selectedQuestion.fileUpload?.questionText || ''}
                      onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, fileUpload: { ...q.fileUpload, questionText: e.target.value } }))}
                      rows={5}
                    />
                  )}
                </div>

                {selectedQuestion.type === 'multipleChoice' && (
                  <div className={styles.formGroup}>
                    <label>Opsi Jawaban *</label>
                    {(selectedQuestion.multipleChoice?.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className={styles.optionRow}>
                        <input
                          type="radio"
                          checked={selectedQuestion.multipleChoice?.correctAnswer === optIdx}
                          onChange={() => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, multipleChoice: { ...q.multipleChoice, correctAnswer: optIdx } }))}
                        />
                        <input
                          value={opt}
                          onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => {
                            const options = [...(q.multipleChoice?.options || [])];
                            options[optIdx] = e.target.value;
                            return { ...q, multipleChoice: { ...q.multipleChoice, options } };
                          })}
                          placeholder={`Opsi ${optIdx + 1}`}
                        />
                        {(selectedQuestion.multipleChoice?.options || []).length > 2 && (
                          <button
                            type="button"
                            className={styles.optionDeleteBtn}
                            onClick={() => updateQuestion(selectedQuestionIndex, (q) => {
                              const options = [...(q.multipleChoice?.options || [])];
                              options.splice(optIdx, 1);
                              let correctAnswer = q.multipleChoice?.correctAnswer;
                              if (correctAnswer === optIdx) correctAnswer = null;
                              else if (correctAnswer > optIdx) correctAnswer = correctAnswer - 1;
                              return { ...q, multipleChoice: { ...q.multipleChoice, options, correctAnswer } };
                            })}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => updateQuestion(selectedQuestionIndex, (q) => ({
                        ...q,
                        multipleChoice: {
                          ...q.multipleChoice,
                          options: [...(q.multipleChoice?.options || []), ''],
                        },
                      }))}
                    >
                      + Tambah Opsi
                    </button>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>Pembahasan (Opsional)</label>
                  <textarea
                    value={
                      selectedQuestion.type === 'multipleChoice'
                        ? (selectedQuestion.multipleChoice?.explanation || '')
                        : selectedQuestion.type === 'essay'
                          ? (selectedQuestion.essay?.explanation || '')
                          : (selectedQuestion.fileUpload?.explanation || '')
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedQuestion.type === 'multipleChoice') {
                        updateQuestion(selectedQuestionIndex, (q) => ({ ...q, multipleChoice: { ...q.multipleChoice, explanation: val } }));
                      } else if (selectedQuestion.type === 'essay') {
                        updateQuestion(selectedQuestionIndex, (q) => ({ ...q, essay: { ...q.essay, explanation: val } }));
                      } else {
                        updateQuestion(selectedQuestionIndex, (q) => ({ ...q, fileUpload: { ...q.fileUpload, explanation: val } }));
                      }
                    }}
                    rows={4}
                  />
                </div>
              </>
            )}
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Pengaturan Soal</h3>
            {selectedQuestion && (
              <>
                <div className={styles.formGroup}>
                  <label>Jenis Soal</label>
                  {enabledQuestionTypeIds.length <= 1 ? (
                    <input
                      value={enabledQuestionTypes[0]?.label || '-'}
                      readOnly
                      disabled
                    />
                  ) : (
                    <select
                      value={selectedQuestion.type}
                      onChange={(e) => updateQuestion(selectedQuestionIndex, () => createEmptyQuestion(e.target.value))}
                    >
                      {enabledQuestionTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className={styles.switchField}>
                  <div className={styles.switchTitle}>Wajibkan semua soal diisi</div>
                  <label className={styles.switch}>
                    <input type="checkbox" checked={selectedQuestion.required} onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, required: e.target.checked }))} />
                    <span />
                  </label>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {currentStep === 3 && (
        <div className={styles.gridReview}>
          <div className={styles.colLeft}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Ringkasan Ujian</h3>
              <div className={styles.summaryList}>
                <div><span>Judul Ujian</span><strong>{examSummary.title}</strong></div>
                <div><span>Mata Pelajaran</span><strong>{examSummary.subject}</strong></div>
                <div><span>Kelas</span><strong>{examSummary.classCode}</strong></div>
                <div><span>Durasi</span><strong>{examSummary.duration}</strong></div>
                <div><span>Deadline</span><strong>{examSummary.deadline}</strong></div>
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Ringkasan Soal</h3>
              <div className={styles.summaryList}>
                <div><span>Total Soal</span><strong>{questions.length} soal</strong></div>
                <div><span>Pilihan Ganda</span><strong>{typeCounts.multipleChoice} soal</strong></div>
                <div><span>Esai</span><strong>{typeCounts.essay} soal</strong></div>
                <div><span>File Upload</span><strong>{typeCounts.fileUpload} soal</strong></div>
              </div>
            </section>
          </div>

          <div className={styles.colRight}>
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>Siap Dipublikasikan</h3>
              <p className={styles.cardDesc}>Periksa kembali semua informasi. Jika sudah benar, publikasikan ujian sekarang.</p>
              <div className={styles.publishHint}>
                Ujian akan aktif sesuai pengaturan deadline yang Anda tentukan.
              </div>
            </section>
          </div>
        </div>
      )}

      <div className={styles.footerBar}>
        <div className={styles.footerLeft}>
          {currentStep > 1 && (
            <button className={styles.btnGhost} onClick={() => setCurrentStep((s) => s - 1)}>
              ← Kembali
            </button>
          )}
        </div>
        <div className={styles.footerRight}>
          {currentStep < 3 && (
            <button
              className={styles.btnPrimary}
              onClick={goToNextStep}
            >
              Lanjut →
            </button>
          )}
          {currentStep === 3 && (
            <>
              <button className={styles.btnGhost} onClick={handleSaveDraft} disabled={savingState === 'saving'}>Simpan Perubahan</button>
              <button className={styles.btnPrimary} onClick={handlePublishExam} disabled={savingState === 'saving'}>
                {examCategory === 'semester' ? 'Kirim ke Kurikulum' : 'Publikasikan Ujian'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
