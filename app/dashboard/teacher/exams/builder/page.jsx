'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './exam-builder.module.css';

// Default empty question block
function createEmptyQuestion() {
  return {
    multipleChoice: null,
    essay: null,
    fileUpload: null,
    // Toggle state (local only, not persisted)
    _mcEnabled: false,
    _essayEnabled: false,
    _fileEnabled: false,
  };
}

export default function ExamBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  // Meta
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classCode, setClassCode] = useState('');
  const [isRandomized, setIsRandomized] = useState(false);

  // Dependencies
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);

  // Question blocks
  const [questions, setQuestions] = useState([createEmptyQuestion()]);

  // UI state
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!editId);

  // Load teacher subjects
  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/teacher/subjects');
        const data = await res.json();
        if (res.ok) setTeacherSubjects(data.subjects || []);
      } catch (e) {
        console.error('Failed to load subjects:', e);
      } finally {
        setDependenciesLoaded(true);
      }
    }
    loadSubjects();
  }, []);

  // Load existing exam for editing
  useEffect(() => {
    if (!editId || !dependenciesLoaded) return;

    async function loadExam() {
      try {
        const res = await fetch(`/api/teacher/exams/${editId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Gagal memuat ujian.');
          setInitialLoading(false);
          return;
        }

        const exam = data.exam;
        setTitle(exam.title || '');
        setSubjectId(exam.subjectId || '');
        setIsRandomized(!!exam.isRandomized);

        // Resolve class code from subject
        const targetSub = teacherSubjects.find(s => s._id === exam.subjectId);
        if (targetSub) setClassCode(targetSub.classCode);

        // Map questions with toggle state
        if (exam.questions && exam.questions.length > 0) {
          setQuestions(exam.questions.map(q => ({
            multipleChoice: q.multipleChoice || null,
            essay: q.essay || null,
            fileUpload: q.fileUpload || null,
            _mcEnabled: !!q.multipleChoice,
            _essayEnabled: !!q.essay,
            _fileEnabled: !!q.fileUpload,
          })));
        }
      } catch (e) {
        setError('Gagal memuat data ujian.');
      } finally {
        setInitialLoading(false);
      }
    }
    loadExam();
  }, [editId, dependenciesLoaded, teacherSubjects]);

  // Subject change handler
  const handleSubjectChange = (e) => {
    const sId = e.target.value;
    setSubjectId(sId);
    const targetSub = teacherSubjects.find(s => s._id === sId);
    setClassCode(targetSub ? targetSub.classCode : '');
  };

  // ====== Question Block Helpers ======

  const updateQuestion = useCallback((index, updater) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? updater(q) : q)));
  }, []);

  const addQuestion = () => {
    setQuestions(prev => [...prev, createEmptyQuestion()]);
  };

  const removeQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, direction) => {
    setQuestions(prev => {
      const arr = [...prev];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= arr.length) return arr;
      [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
      return arr;
    });
  };

  // ====== MC Helpers ======

  const addMCOption = (qIdx) => {
    updateQuestion(qIdx, q => ({
      ...q,
      multipleChoice: {
        ...q.multipleChoice,
        options: [...(q.multipleChoice?.options || []), ''],
      },
    }));
  };

  const removeMCOption = (qIdx, optIdx) => {
    updateQuestion(qIdx, q => {
      const newOptions = (q.multipleChoice?.options || []).filter((_, i) => i !== optIdx);
      let correctAnswer = q.multipleChoice?.correctAnswer;
      if (correctAnswer === optIdx) correctAnswer = null;
      else if (correctAnswer !== null && correctAnswer !== undefined && correctAnswer > optIdx) correctAnswer--;
      return {
        ...q,
        multipleChoice: { ...q.multipleChoice, options: newOptions, correctAnswer },
      };
    });
  };

  const updateMCOption = (qIdx, optIdx, value) => {
    updateQuestion(qIdx, q => {
      const newOptions = [...(q.multipleChoice?.options || [])];
      newOptions[optIdx] = value;
      return {
        ...q,
        multipleChoice: { ...q.multipleChoice, options: newOptions },
      };
    });
  };

  const setMCCorrect = (qIdx, optIdx) => {
    updateQuestion(qIdx, q => ({
      ...q,
      multipleChoice: { ...q.multipleChoice, correctAnswer: optIdx },
    }));
  };

  // ====== Toggle type on/off ======

  const toggleMC = (qIdx, enabled) => {
    updateQuestion(qIdx, q => ({
      ...q,
      _mcEnabled: enabled,
      multipleChoice: enabled
        ? (q.multipleChoice || { questionText: '', options: ['', ''], correctAnswer: null })
        : null,
    }));
  };

  const toggleEssay = (qIdx, enabled) => {
    updateQuestion(qIdx, q => ({
      ...q,
      _essayEnabled: enabled,
      essay: enabled
        ? (q.essay || { questionText: '' })
        : null,
    }));
  };

  const toggleFile = (qIdx, enabled) => {
    updateQuestion(qIdx, q => ({
      ...q,
      _fileEnabled: enabled,
      fileUpload: enabled
        ? (q.fileUpload || { questionText: '' })
        : null,
    }));
  };

  // ====== Submit ======

  const handleSave = async () => {
    setError('');

    if (!title.trim()) {
      setError('Judul ujian wajib diisi.');
      return;
    }
    if (!subjectId) {
      setError('Mata pelajaran wajib dipilih.');
      return;
    }
    if (questions.length === 0) {
      setError('Ujian harus memiliki minimal 1 soal.');
      return;
    }

    // Validate each question has at least one type
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.multipleChoice && !q.essay && !q.fileUpload) {
        setError(`Soal #${i + 1} harus memiliki minimal 1 tipe soal aktif.`);
        return;
      }
    }

    // Validation for questions is done

    setSaving(true);

    // Strip local toggle state before sending
    const cleanQuestions = questions.map(q => ({
      multipleChoice: q.multipleChoice || null,
      essay: q.essay || null,
      fileUpload: q.fileUpload || null,
    }));

    const payload = {
      title: title.trim(),
      subjectId,
      questions: cleanQuestions,
      isRandomized,
    };

    try {
      const url = editId ? `/api/teacher/exams/${editId}` : '/api/teacher/exams';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan ujian.');
      } else {
        router.push('/dashboard/teacher/exams');
      }
    } catch {
      setError('Koneksi ke server gagal.');
    } finally {
      setSaving(false);
    }
  };

  // ====== Render ======

  if (initialLoading) {
    return (
      <div className={styles.builderContainer}>
        <div className={styles.builderHeader}>
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-subtext)' }}>
            Memuat data ujian...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.builderContainer}>
      {/* Header / Meta */}
      <div className={styles.builderHeader}>
        <button className={styles.backLink} onClick={() => router.push('/dashboard/teacher/exams')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Kembali ke Daftar Ujian
        </button>

        <h1 className={styles.builderTitle}>
          {editId ? 'Edit Ujian' : 'Buat Ujian Baru'}
        </h1>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.fieldGroup} style={{ marginBottom: 16 }}>
          <label className={styles.fieldLabel}>Judul Ujian *</label>
          <input
            type="text"
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Ujian Tengah Semester - Matematika"
          />
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Integrasi Mata Pelajaran *</label>
            <select
              className={styles.input}
              value={subjectId}
              onChange={handleSubjectChange}
              disabled={!!editId}
              style={editId ? { background: '#F3F4F6', color: '#9CA3AF' } : { appearance: 'auto' }}
            >
              <option value="" disabled>Pilih Mata Pelajaran...</option>
              {teacherSubjects.map(sub => (
                <option key={sub._id} value={sub._id}>{sub.subjectName}</option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Kode Kelas (Otomatis)</label>
            <input
              type="text"
              className={styles.input}
              value={classCode ? `Terkunci: ${classCode}` : 'Pilih mata pelajaran'}
              disabled
              style={{ background: '#F3F4F6', fontWeight: 600, color: 'var(--color-primary)' }}
            />
          </div>
        </div>

        <div className={styles.metaGrid}>
          <div className={styles.fieldGroup} style={{ gridColumn: 'span 2' }}>
            <label className={styles.fieldLabel} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Acak Urutan Soal Ujian</span>
              <label className={styles.toggleSwitch} style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={isRandomized}
                  onChange={e => setIsRandomized(e.target.checked)}
                />
                <span className={styles.toggleSlider}/>
              </label>
            </label>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-subtext)', marginTop: '4px', display: 'block' }}>
              {isRandomized ? 'Ya, urutan soal akan diacak untuk setiap siswa.' : 'Tidak, urutan soal akan tetap sama untuk semua siswa.'}
            </span>
          </div>
        </div>
      </div>

      {/* Question Blocks */}
      {questions.map((q, qIdx) => (
        <div className={styles.questionBlock} key={qIdx}>
          <div className={styles.questionBlockHeader}>
            <span className={styles.questionNumber}>Soal #{qIdx + 1}</span>
            <div className={styles.questionActions}>
              <button
                className={styles.qActionBtn}
                title="Pindah ke atas"
                onClick={() => moveQuestion(qIdx, -1)}
                disabled={qIdx === 0}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
              <button
                className={styles.qActionBtn}
                title="Pindah ke bawah"
                onClick={() => moveQuestion(qIdx, 1)}
                disabled={qIdx === questions.length - 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <button
                className={`${styles.qActionBtn} ${styles.qActionBtnDanger}`}
                title="Hapus soal"
                onClick={() => removeQuestion(qIdx)}
                disabled={questions.length <= 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* 1. Multiple Choice */}
          <div className={styles.typeSection}>
            <div className={styles.typeHeader}>
              <span className={`${styles.typeLabel} ${styles.typeLabelMC}`}>Pilihan Ganda</span>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={q._mcEnabled}
                  onChange={e => toggleMC(qIdx, e.target.checked)}
                />
                <span className={styles.toggleSlider}/>
              </label>
            </div>
            {q._mcEnabled ? (
              <div className={styles.typeContent}>
                <textarea
                  placeholder="Tuliskan pertanyaan pilihan ganda..."
                  value={q.multipleChoice?.questionText || ''}
                  onChange={e => updateQuestion(qIdx, qq => ({
                    ...qq,
                    multipleChoice: { ...qq.multipleChoice, questionText: e.target.value },
                  }))}
                />
                <div style={{ marginTop: 12 }}>
                  {(q.multipleChoice?.options || []).map((opt, optIdx) => (
                    <div className={styles.optionRow} key={optIdx}>
                      <input
                        type="radio"
                        name={`mc-correct-${qIdx}`}
                        className={styles.optionRadio}
                        checked={q.multipleChoice?.correctAnswer === optIdx}
                        onChange={() => setMCCorrect(qIdx, optIdx)}
                        title="Tandai sebagai jawaban benar"
                      />
                      <input
                        type="text"
                        className={styles.optionInput}
                        placeholder={`Opsi ${String.fromCharCode(65 + optIdx)}`}
                        value={opt}
                        onChange={e => updateMCOption(qIdx, optIdx, e.target.value)}
                      />
                      {q.multipleChoice?.correctAnswer === optIdx && (
                        <span className={styles.correctLabel}>Benar</span>
                      )}
                      {(q.multipleChoice?.options || []).length > 2 && (
                        <button
                          type="button"
                          className={styles.optionRemoveBtn}
                          onClick={() => removeMCOption(qIdx, optIdx)}
                          title="Hapus opsi"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className={styles.addOptionBtn} onClick={() => addMCOption(qIdx)}>
                    + Tambah Opsi
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.typeContentDisabled}>Nonaktif — aktifkan toggle untuk menambahkan soal pilihan ganda.</div>
            )}
          </div>

          {/* 2. Essay */}
          <div className={styles.typeSection}>
            <div className={styles.typeHeader}>
              <span className={`${styles.typeLabel} ${styles.typeLabelEssay}`}>Esai</span>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={q._essayEnabled}
                  onChange={e => toggleEssay(qIdx, e.target.checked)}
                />
                <span className={styles.toggleSlider}/>
              </label>
            </div>
            {q._essayEnabled ? (
              <div className={styles.typeContent}>
                <textarea
                  placeholder="Tuliskan pertanyaan esai..."
                  value={q.essay?.questionText || ''}
                  onChange={e => updateQuestion(qIdx, qq => ({
                    ...qq,
                    essay: { ...qq.essay, questionText: e.target.value },
                  }))}
                />
              </div>
            ) : (
              <div className={styles.typeContentDisabled}>Nonaktif — aktifkan toggle untuk menambahkan soal esai.</div>
            )}
          </div>

          {/* 3. File Upload */}
          <div className={styles.typeSection}>
            <div className={styles.typeHeader}>
              <span className={`${styles.typeLabel} ${styles.typeLabelFile}`}>File Upload</span>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={q._fileEnabled}
                  onChange={e => toggleFile(qIdx, e.target.checked)}
                />
                <span className={styles.toggleSlider}/>
              </label>
            </div>
            {q._fileEnabled ? (
              <div className={styles.typeContent}>
                <textarea
                  placeholder="Tuliskan instruksi untuk file yang harus diupload siswa..."
                  value={q.fileUpload?.questionText || ''}
                  onChange={e => updateQuestion(qIdx, qq => ({
                    ...qq,
                    fileUpload: { ...qq.fileUpload, questionText: e.target.value },
                  }))}
                />
              </div>
            ) : (
              <div className={styles.typeContentDisabled}>Nonaktif — aktifkan toggle untuk menambahkan soal file upload.</div>
            )}
          </div>
        </div>
      ))}

      {/* Add Question */}
      <button type="button" className={styles.addQuestionBtn} onClick={addQuestion}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Tambah Soal Baru
      </button>

      {/* Footer */}
      <div className={styles.builderFooter}>
        <button
          className={styles.btnCancel}
          onClick={() => router.push('/dashboard/teacher/exams')}
          disabled={saving}
        >
          Batal
        </button>
        <button
          className={styles.btnSave}
          onClick={handleSave}
          disabled={saving || !dependenciesLoaded}
        >
          {saving ? 'Menyimpan...' : (editId ? 'Perbarui Draft' : 'Simpan Draft')}
        </button>
      </div>
    </div>
  );
}
