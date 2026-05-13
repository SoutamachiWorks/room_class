'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './exam-builder.module.css';

function createEmptyQuestion(type = 'multipleChoice', config = {}) {
  const multipleAnswers = !!config.multipleAnswers;
  const minSelections = Math.max(1, Number(config.minSelections || 1));
  return {
    type,
    required: true,
    imageUrl: null,
    imageSize: 0,
    multipleChoice: type === 'multipleChoice'
      ? { questionText: '', options: ['', ''], correctAnswer: multipleAnswers ? [] : null, multipleAnswers, minSelections, explanation: '' }
      : null,
    essay: type === 'essay' ? { questionText: '', explanation: '' } : null,
    fileUpload: null,
  };
}

function hasCorrectAnswer(multipleChoice) {
  const correctAnswer = multipleChoice?.correctAnswer;
  return Array.isArray(correctAnswer) ? correctAnswer.length > 0 : correctAnswer !== null && correctAnswer !== undefined;
}

function normalizeCorrectAnswerForMode(correctAnswer, multipleAnswers) {
  if (multipleAnswers) {
    if (Array.isArray(correctAnswer)) return correctAnswer;
    return correctAnswer === null || correctAnswer === undefined ? [] : [correctAnswer];
  }
  return Array.isArray(correctAnswer) ? (correctAnswer[0] ?? null) : (correctAnswer ?? null);
}

function stripHtml(value = '') {
  if (!value) return '';
  const div = document.createElement('div');
  div.innerHTML = value;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function removeLeadingPattern(html, text, pattern) {
  const match = text.match(pattern);
  if (!match) return html;
  return escapeHtml(text.slice(match[0].length).trim());
}

function normalizeOptionHtml(html, text) {
  return removeLeadingPattern(html, text, /^(?:[A-Z][.)]|[□☐☑☒])\s+/i);
}

function getWordBlocks(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const nodes = Array.from(doc.body.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6'));
  return nodes
    .map((node) => ({
      text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
      html: node.innerHTML || '',
    }))
    .filter((block) => block.text);
}

function getDirectListItems(list) {
  return Array.from(list.children).filter((child) => child.tagName?.toLowerCase() === 'li');
}

function getCleanListItemContent(item) {
  const clone = item.cloneNode(true);
  clone.querySelectorAll('ol, ul').forEach((list) => list.remove());
  const html = clone.innerHTML.trim();
  const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  return { html, text };
}

function getNestedOptions(item) {
  const nestedList = Array.from(item.children).find((child) => ['ol', 'ul'].includes(child.tagName?.toLowerCase()));
  if (!nestedList) return [];
  return getDirectListItems(nestedList)
    .map((option) => getCleanListItemContent(option))
    .filter((option) => option.text)
    .map((option) => normalizeOptionHtml(option.html || escapeHtml(option.text), option.text));
}

function getListOptions(list) {
  return getDirectListItems(list)
    .map((option) => getCleanListItemContent(option))
    .filter((option) => option.text)
    .map((option) => normalizeOptionHtml(option.html || escapeHtml(option.text), option.text));
}

function parseAnswerLetters(value = '') {
  return String(value)
    .split(/[,\s;]+/)
    .map((part) => part.trim().toUpperCase())
    .filter((part) => /^[A-Z]$/.test(part))
    .map((letter) => letter.charCodeAt(0) - 65);
}

function buildImportedQuestion(source) {
  const questionText = source.questionHtml.join('<br>').trim();
  const explanation = source.explanationHtml.join('<br>').trim();
  if (!questionText) return null;

  if (source.options.length > 0) {
    const validKeys = source.correctAnswer.filter((idx) => idx >= 0 && idx < source.options.length);
    const multipleAnswers = validKeys.length > 1;
    return {
      ...createEmptyQuestion('multipleChoice', {
        multipleAnswers,
        minSelections: multipleAnswers ? validKeys.length : 1,
      }),
      type: 'multipleChoice',
      multipleChoice: {
        questionText,
        options: source.options.map((option) => stripHtml(option) || option),
        correctAnswer: multipleAnswers ? validKeys : (validKeys[0] ?? null),
        multipleAnswers,
        minSelections: multipleAnswers ? validKeys.length : 1,
        explanation,
      },
    };
  }

  return {
    ...createEmptyQuestion('essay'),
    type: 'essay',
    essay: {
      questionText,
      explanation,
    },
  };
}

function parseStructuredWordQuestions(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const parsed = [];
  let current = null;
  let explanationMode = false;

  const pushCurrent = () => {
    const question = current ? buildImportedQuestion(current) : null;
    if (question) parsed.push(question);
    current = null;
    explanationMode = false;
  };

  const pushListQuestions = (list) => {
    const items = getDirectListItems(list);

    if (items.length > 1) {
      const first = getCleanListItemContent(items[0]);
      const rest = items.slice(1).map((item) => getCleanListItemContent(item)).filter((item) => item.text);
      const restLooksLikeOptions = rest.length >= 2 && rest.every((item) => !/^(?:soal\s*)?\d+[.)]\s+/i.test(item.text));
      if (first.text && restLooksLikeOptions) {
        pushCurrent();
        current = {
          questionHtml: [first.html || escapeHtml(first.text)],
          options: rest.map((option) => normalizeOptionHtml(option.html || escapeHtml(option.text), option.text)),
          correctAnswer: [],
          explanationHtml: [],
        };
        return;
      }
    }

    for (const item of items) {
      const content = getCleanListItemContent(item);
      const options = getNestedOptions(item);
      if (!content.text) continue;
      pushCurrent();
      current = {
        questionHtml: [content.html || escapeHtml(content.text)],
        options,
        correctAnswer: [],
        explanationHtml: [],
      };
    }
  };

  for (const node of Array.from(doc.body.children)) {
    const tag = node.tagName?.toLowerCase();
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    if (tag === 'ul' && current && current.options.length === 0) {
      current.options = getListOptions(node);
      continue;
    }

    if (tag === 'ol' || tag === 'ul') {
      pushListQuestions(node);
      continue;
    }

    const keyMatch = text.match(/^(?:kunci|jawaban|answer)\s*:\s*(.+)$/i);
    const explanationMatch = text.match(/^(?:pembahasan|penjelasan|explanation)\s*:\s*(.*)$/i);

    if (keyMatch && current) {
      current.correctAnswer = parseAnswerLetters(keyMatch[1]);
      explanationMode = false;
      continue;
    }

    if (explanationMatch && current) {
      explanationMode = true;
      const explanationText = explanationMatch[1]?.trim();
      if (explanationText) {
        current.explanationHtml.push(removeLeadingPattern(node.innerHTML, text, /^(?:pembahasan|penjelasan|explanation)\s*:\s*/i));
      }
      continue;
    }

    if (explanationMode && current) {
      current.explanationHtml.push(node.innerHTML || escapeHtml(text));
    }
  }

  pushCurrent();
  return parsed;
}

function parseLineBasedWordQuestions(html) {
  const blocks = getWordBlocks(html);
  const questions = [];
  let current = null;
  let explanationMode = false;

  const pushCurrent = () => {
    const question = current ? buildImportedQuestion(current) : null;
    if (question) questions.push(question);
  };

  for (const block of blocks) {
    const questionMatch = block.text.match(/^(?:soal\s*)?(\d+)[.)]\s+(.+)$/i);
    const optionMatch = block.text.match(/^(?:[A-Z][.)]|[□☐☑☒])\s+(.+)$/i);
    const keyMatch = block.text.match(/^(?:kunci|jawaban|answer)\s*:\s*(.+)$/i);
    const explanationMatch = block.text.match(/^(?:pembahasan|penjelasan|explanation)\s*:\s*(.*)$/i);

    if (questionMatch) {
      pushCurrent();
      current = {
        questionHtml: [removeLeadingPattern(block.html, block.text, /^(?:soal\s*)?\d+[.)]\s+/i)],
        options: [],
        correctAnswer: [],
        explanationHtml: [],
      };
      explanationMode = false;
      continue;
    }

    if (!current) continue;

    if (keyMatch) {
      current.correctAnswer = parseAnswerLetters(keyMatch[1]);
      explanationMode = false;
      continue;
    }

    if (explanationMatch) {
      explanationMode = true;
      const explanationText = explanationMatch[1]?.trim();
      if (explanationText) {
        current.explanationHtml.push(removeLeadingPattern(block.html, block.text, /^(?:pembahasan|penjelasan|explanation)\s*:\s*/i));
      }
      continue;
    }

    if (!explanationMode && optionMatch) {
      current.options.push(normalizeOptionHtml(block.html, block.text));
      continue;
    }

    if (explanationMode) {
      current.explanationHtml.push(block.html);
    } else {
      current.questionHtml.push(block.html);
    }
  }

  pushCurrent();
  return questions;
}

function parseWordQuestions(html) {
  const structuredQuestions = parseStructuredWordQuestions(html);
  if (structuredQuestions.length) return structuredQuestions;
  return parseLineBasedWordQuestions(html);
}

function isBlankQuestion(question) {
  if (!question) return true;
  if (question.type === 'multipleChoice') {
    const mc = question.multipleChoice || {};
    return !mc.questionText?.trim() &&
      (mc.options || []).every((option) => !option.trim()) &&
      !hasCorrectAnswer(mc);
  }
  return !question.essay?.questionText?.trim();
}

function getClassCodes(source) {
  return Array.isArray(source?.classCodes) && source.classCodes.length
    ? source.classCodes
    : [source?.classCode].filter(Boolean);
}

function RichTextEditor({ value, onChange, minHeight = 120 }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const runCommand = (command, commandValue = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || '');
  };

  return (
    <div className={styles.richTextBox}>
      <div className={styles.richTextToolbar}>
        <button type="button" onClick={() => runCommand('bold')}>B</button>
        <button type="button" onClick={() => runCommand('italic')}>I</button>
        <button type="button" onClick={() => runCommand('underline')}>U</button>
        <button type="button" onClick={() => runCommand('insertOrderedList')}>1.</button>
        <button type="button" onClick={() => runCommand('insertUnorderedList')}>•</button>
        <button type="button" onClick={() => runCommand('removeFormat')}>Clear</button>
      </div>
      <div
        ref={editorRef}
        className={styles.richTextEditor}
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight }}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}

const STEP_META = [
  { key: 1, title: 'Informasi Ujian', subtitle: 'Atur detail ujian' },
  { key: 2, title: 'Soal & Pengaturan', subtitle: 'Buat soal dan atur opsi' },
  { key: 3, title: 'Tinjau & Publikasi', subtitle: 'Periksa dan publikasikan' },
];

const DEFAULT_TYPE_SETTINGS = [
  { id: 'multipleChoice', label: 'Pilihan Ganda', desc: 'Siswa memilih satu jawaban yang benar', enabled: true, color: 'green' },
  { id: 'essay', label: 'Esai', desc: 'Siswa menjawab dengan uraian', enabled: false, color: 'orange' },
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
  const [importingWord, setImportingWord] = useState(false);
  const wordImportRef = useRef(null);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examCategory, setExamCategory] = useState('ulangan');
  const [duration, setDuration] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isRandomized, setIsRandomized] = useState(false);
  const [isOptionRandomized, setIsOptionRandomized] = useState(false);
  const [showExplanationToStudent, setShowExplanationToStudent] = useState(false);
  const [lockExamPro, setLockExamPro] = useState(false);

  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [questions, setQuestions] = useState([createEmptyQuestion('multipleChoice')]);
  const [typeSettings, setTypeSettings] = useState(DEFAULT_TYPE_SETTINGS);
  const [defaultMultipleAnswers, setDefaultMultipleAnswers] = useState(false);
  const [defaultMinSelections, setDefaultMinSelections] = useState(3);

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
                multipleAnswers: Array.isArray(q.multipleChoice.correctAnswer) || !!q.multipleChoice.multipleAnswers,
                minSelections: Math.max(1, Number(q.multipleChoice.minSelections || (Array.isArray(q.multipleChoice.correctAnswer) ? q.multipleChoice.correctAnswer.length : 1))),
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
            ...createEmptyQuestion('essay'),
            type: 'essay',
            imageUrl: q.imageUrl || null,
            imageSize: q.imageSize || 0,
            essay: {
              questionText: q.fileUpload?.questionText || '',
              explanation: q.fileUpload?.explanation || '',
            },
          };
        });
        if (mapped.length) {
          setQuestions(mapped);
          const firstMultiAnswer = mapped.find((q) => q.type === 'multipleChoice' && q.multipleChoice?.multipleAnswers);
          setDefaultMultipleAnswers(!!firstMultiAnswer);
          if (firstMultiAnswer) {
            setDefaultMinSelections(Math.max(1, Number(firstMultiAnswer.multipleChoice?.minSelections || 1)));
          }
        }
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
          };
          if (!detected.multipleChoice && !detected.essay) {
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

  const classCodes = useMemo(
    () => getClassCodes(teacherSubjects.find((s) => s._id === subjectId)),
    [subjectId, teacherSubjects]
  );
  const classCode = classCodes.join(', ');

  const selectedQuestion = questions[selectedQuestionIndex] || null;
  const enabledQuestionTypes = typeSettings.filter((t) => t.enabled);
  const enabledQuestionTypeIds = enabledQuestionTypes.map((t) => t.id);
  const typeCounts = useMemo(() => ({
    multipleChoice: questions.filter((q) => q.type === 'multipleChoice').length,
    essay: questions.filter((q) => q.type === 'essay').length,
  }), [questions]);

  const canGoStep2 = title.trim() && subjectId;
  const canGoStep3 = questions.length > 0 && questions.every((q) => {
    if (q.type === 'multipleChoice') {
      return q.multipleChoice?.questionText?.trim() && (q.multipleChoice.options || []).every((o) => o.trim()) && hasCorrectAnswer(q.multipleChoice);
    }
    if (q.type === 'essay') return q.essay?.questionText?.trim();
    return false;
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

  function applyMultipleAnswerMode(enabled) {
    setDefaultMultipleAnswers(enabled);
    setQuestions((prev) => prev.map((q) => {
      if (q.type !== 'multipleChoice') return q;
      const optionsLength = q.multipleChoice?.options?.length || 1;
      return {
        ...q,
        multipleChoice: {
          ...q.multipleChoice,
          multipleAnswers: enabled,
          correctAnswer: normalizeCorrectAnswerForMode(q.multipleChoice?.correctAnswer, enabled),
          minSelections: enabled ? Math.max(1, Math.min(optionsLength, Number(q.multipleChoice?.minSelections || defaultMinSelections || 1))) : 1,
        },
      };
    }));
  }

  function updateDefaultMinSelections(value) {
    const next = Math.max(1, Number(value || 1));
    setDefaultMinSelections(next);
    if (!defaultMultipleAnswers) return;
    setQuestions((prev) => prev.map((q) => {
      if (q.type !== 'multipleChoice') return q;
      return {
        ...q,
        multipleChoice: {
          ...q.multipleChoice,
          minSelections: Math.max(1, Math.min(q.multipleChoice?.options?.length || 1, next)),
        },
      };
    }));
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
    setQuestions((prev) => [...prev, createEmptyQuestion(type, {
      multipleAnswers: defaultMultipleAnswers,
      minSelections: defaultMinSelections,
    })]);
    setSelectedQuestionIndex(questions.length);
    setCurrentStep(2);
  }

  function getNextQuestionType() {
    const enabled = typeSettings.filter((t) => t.enabled).map((t) => t.id);
    if (enabled.includes('multipleChoice')) return 'multipleChoice';
    return 'essay';
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

  async function handleWordImport(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('File harus berformat .docx.');
      return;
    }

    setImportingWord(true);
    setError('');
    setStatusMessage('');
    try {
      const mammothModule = await import('mammoth/mammoth.browser.js');
      const mammoth = mammothModule.default || mammothModule;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const importedQuestions = parseWordQuestions(result.value);

      if (!importedQuestions.length) {
        const msg = 'Tidak ada soal yang terbaca. Gunakan format: 1. Teks soal, A. Opsi, B. Opsi, Kunci: A.';
        setError(msg);
        alert(msg);
        return;
      }

      setTypeSettings((prev) => prev.map((type) => ({
        ...type,
        enabled: type.id === 'multipleChoice'
          ? importedQuestions.some((q) => q.type === 'multipleChoice') || type.enabled
          : importedQuestions.some((q) => q.type === 'essay') || type.enabled,
      })));
      setQuestions((prev) => (
        prev.length === 1 && isBlankQuestion(prev[0])
          ? importedQuestions
          : [...prev, ...importedQuestions]
      ));
      setSelectedQuestionIndex((prev) => (
        questions.length === 1 && isBlankQuestion(questions[0])
          ? 0
          : prev
      ));
      setCurrentStep(2);
      setStatusMessage(`Berhasil import ${importedQuestions.length} soal dari Word.`);
    } catch (err) {
      console.error('Word import failed:', err);
      setError('Gagal membaca file Word. Pastikan file berformat .docx dan tidak rusak.');
    } finally {
      setImportingWord(false);
      if (wordImportRef.current) wordImportRef.current.value = '';
    }
  }

  function mapToPayload() {
    const cleanQuestions = questions.map((q, idx) => ({
      order: idx + 1,
      imageUrl: q.imageUrl || null,
      imageSize: q.imageSize || 0,
      multipleChoice: q.type === 'multipleChoice' ? {
        questionText: q.multipleChoice?.questionText || '',
        options: q.multipleChoice?.options || [],
        correctAnswer: normalizeCorrectAnswerForMode(q.multipleChoice?.correctAnswer, !!q.multipleChoice?.multipleAnswers),
        multipleAnswers: !!q.multipleChoice?.multipleAnswers,
        minSelections: q.multipleChoice?.multipleAnswers
          ? Math.max(1, normalizeCorrectAnswerForMode(q.multipleChoice?.correctAnswer, true).length)
          : 1,
        explanation: q.multipleChoice?.explanation || '',
      } : null,
      essay: q.type === 'essay' ? {
        questionText: q.essay?.questionText || '',
        explanation: q.essay?.explanation || '',
      } : null,
      fileUpload: null,
    }));

    return {
      title: title.trim(),
      subjectId,
      questions: cleanQuestions,
      typeSettings: {
        multipleChoice: !!typeSettings.find((t) => t.id === 'multipleChoice')?.enabled,
        essay: !!typeSettings.find((t) => t.id === 'essay')?.enabled,
        fileUpload: false,
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
        if (!hasCorrectAnswer(q.multipleChoice)) {
          const msg = `Soal #${i + 1}: Pilih minimal satu jawaban benar.`;
          setError(msg);
          alert(msg);
          return { ok: false };
        }
        if (q.multipleChoice?.multipleAnswers) {
          const correctCount = normalizeCorrectAnswerForMode(q.multipleChoice?.correctAnswer, true).length;
          if (correctCount < 2 || correctCount > opts.length) {
            const msg = `Soal #${i + 1}: Pilih minimal dua jawaban benar untuk mode multi-jawaban.`;
            setError(msg);
            alert(msg);
            return { ok: false };
          }
        }
      }
      if (q.type === 'essay' && !q.essay?.questionText?.trim()) {
        const msg = `Soal #${i + 1}: Teks soal esai wajib diisi.`;
        setError(msg);
        alert(msg);
        return { ok: false };
      }
      if (q.type !== 'multipleChoice' && q.type !== 'essay') {
        const msg = `Soal #${i + 1}: Jenis soal upload file dinonaktifkan untuk ujian anti-cheat. Gunakan pilihan ganda atau esai.`;
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
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => wordImportRef.current?.click()}
            disabled={importingWord || savingState === 'saving'}
          >
            {importingWord ? 'Mengimpor...' : 'Import Word'}
          </button>
          <input
            ref={wordImportRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(e) => handleWordImport(e.target.files?.[0])}
          />
          <button className={styles.btnGhost} onClick={handleSaveDraft} disabled={savingState === 'saving'}>Simpan Draft</button>
          <button className={styles.btnPrimary} onClick={handlePublishExam} disabled={savingState === 'saving'}>
            Publikasikan Ujian
          </button>
        </div>
      </div>

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
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
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
                  <option value="ulangan">Ulangan Biasa</option>
                  <option value="semester">Ujian Semester</option>
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
                    <strong>{q.type === 'multipleChoice' ? `Soal ${idx + 1}` : `Esai ${idx + 1}`}</strong>
                    <small>{q.type === 'multipleChoice' ? 'Pilihan Ganda' : 'Esai'}</small>
                  </div>
                </button>
              ))}
            </div>
            <div className={styles.inlineButtons}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => wordImportRef.current?.click()}
                disabled={importingWord}
              >
                {importingWord ? 'Mengimpor...' : 'Import Word'}
              </button>
              <button
                className={styles.btnDashed}
                onClick={() => addQuestionByType(getNextQuestionType())}
              >
                + Tambah Soal
              </button>
            </div>
            <details className={styles.importGuide}>
              <summary>Panduan format Word</summary>
              <div>
                <a className={styles.importGuideLink} href="/api/exams/import-word-template">
                  Download template Word
                </a>
                <p>Gunakan nomor soal, opsi, lalu baris kunci.</p>
                <pre>{`1. Teks soal
A. Opsi pertama
B. Opsi kedua
C. Opsi ketiga
Kunci: B
Pembahasan: Opsional`}</pre>
                <p>Multi-jawaban bisa memakai <strong>Kunci: A,C,E</strong>. Opsi checkbox dari Word juga didukung.</p>
                <pre>{`2. Jelaskan dampak teknologi digital terhadap interaksi sosial.
Pembahasan: Opsional`}</pre>
                <p>Untuk esai, cukup tulis nomor dan teks soal tanpa opsi A/B/C dan tanpa kunci.</p>
              </div>
            </details>
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
                    <RichTextEditor
                      value={selectedQuestion.multipleChoice?.questionText || ''}
                      onChange={(value) => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, multipleChoice: { ...q.multipleChoice, questionText: value } }))}
                      minHeight={120}
                    />
                  )}
                  {selectedQuestion.type === 'essay' && (
                    <RichTextEditor
                      value={selectedQuestion.essay?.questionText || ''}
                      onChange={(value) => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, essay: { ...q.essay, questionText: value } }))}
                      minHeight={120}
                    />
                  )}
                </div>

                {selectedQuestion.type === 'multipleChoice' && (
                  <div className={styles.formGroup}>
                    <label>Opsi Jawaban *</label>
                    {(selectedQuestion.multipleChoice?.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className={styles.optionRow}>
                        {selectedQuestion.multipleChoice?.multipleAnswers ? (
                          <input
                            type="checkbox"
                            checked={(selectedQuestion.multipleChoice?.correctAnswer || []).includes(optIdx)}
                            onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => {
                              const selected = Array.isArray(q.multipleChoice?.correctAnswer) ? [...q.multipleChoice.correctAnswer] : [];
                              const next = e.target.checked
                                ? [...selected, optIdx].sort((a, b) => a - b)
                                : selected.filter((idx) => idx !== optIdx);
                              return {
                                ...q,
                                multipleChoice: {
                                  ...q.multipleChoice,
                                  correctAnswer: next,
                                  minSelections: Math.max(1, next.length),
                                },
                              };
                            })}
                          />
                        ) : (
                          <input
                            type="radio"
                            checked={selectedQuestion.multipleChoice?.correctAnswer === optIdx}
                            onChange={() => updateQuestion(selectedQuestionIndex, (q) => ({ ...q, multipleChoice: { ...q.multipleChoice, correctAnswer: optIdx } }))}
                          />
                        )}
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
                              if (Array.isArray(correctAnswer)) {
                                correctAnswer = correctAnswer
                                  .filter((idx) => idx !== optIdx)
                                  .map((idx) => (idx > optIdx ? idx - 1 : idx));
                              } else if (correctAnswer === optIdx) correctAnswer = null;
                              else if (correctAnswer > optIdx) correctAnswer = correctAnswer - 1;
                              const minSelections = Math.min(Number(q.multipleChoice?.minSelections || 1), options.length);
                              return { ...q, multipleChoice: { ...q.multipleChoice, options, correctAnswer, minSelections } };
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
                  <RichTextEditor
                    value={
                      selectedQuestion.type === 'multipleChoice'
                        ? (selectedQuestion.multipleChoice?.explanation || '')
                        : (selectedQuestion.essay?.explanation || '')
                    }
                    onChange={(val) => {
                      if (selectedQuestion.type === 'multipleChoice') {
                        updateQuestion(selectedQuestionIndex, (q) => ({ ...q, multipleChoice: { ...q.multipleChoice, explanation: val } }));
                      } else {
                        updateQuestion(selectedQuestionIndex, (q) => ({ ...q, essay: { ...q.essay, explanation: val } }));
                      }
                    }}
                    minHeight={100}
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
                      onChange={(e) => updateQuestion(selectedQuestionIndex, () => createEmptyQuestion(e.target.value, {
                        multipleAnswers: defaultMultipleAnswers,
                        minSelections: defaultMinSelections,
                      }))}
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
                {selectedQuestion.type === 'multipleChoice' && (
                  <div className={styles.multiAnswerSettings}>
                    <label className={styles.checkField}>
                      <input
                        type="checkbox"
                        checked={!!selectedQuestion.multipleChoice?.multipleAnswers}
                        onChange={(e) => updateQuestion(selectedQuestionIndex, (q) => ({
                          ...q,
                          multipleChoice: {
                            ...q.multipleChoice,
                            multipleAnswers: e.target.checked,
                            correctAnswer: normalizeCorrectAnswerForMode(q.multipleChoice?.correctAnswer, e.target.checked),
                            minSelections: e.target.checked ? Math.max(1, Number(q.multipleChoice?.minSelections || 1)) : 1,
                          },
                        }))}
                      />
                      <span>Jawaban benar lebih dari satu</span>
                    </label>
                    {selectedQuestion.multipleChoice?.multipleAnswers && (
                      <label className={styles.minSelectField}>
                        Jumlah pilihan siswa
                        <input
                          type="number"
                          min="1"
                          max={(selectedQuestion.multipleChoice?.options || []).length}
                          value={normalizeCorrectAnswerForMode(selectedQuestion.multipleChoice?.correctAnswer, true).length || 1}
                          readOnly
                        />
                      </label>
                    )}
                  </div>
                )}
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
                Publikasikan Ujian
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
