import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { deleteFromR2, generatePresignedUrl } from '@/lib/s3Client';

function hasCorrectAnswer(multipleChoice) {
  const correctAnswer = multipleChoice?.correctAnswer;
  return Array.isArray(correctAnswer) ? correctAnswer.length > 0 : correctAnswer !== null && correctAnswer !== undefined;
}

function sanitizeRichText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\s(href|src)=["']javascript:[^"']*["']/gi, '')
    .replace(/<(?!\/?(b|strong|i|em|u|p|br|div|span|ol|ul|li|sub|sup)\b)[^>]*>/gi, '');
}

function normalizeMultipleChoice(multipleChoice) {
  if (!multipleChoice) return null;
  const options = Array.isArray(multipleChoice.options) ? multipleChoice.options : [];
  const multipleAnswers = !!multipleChoice.multipleAnswers || Array.isArray(multipleChoice.correctAnswer);
  let correctAnswer = multipleAnswers
    ? (Array.isArray(multipleChoice.correctAnswer) ? multipleChoice.correctAnswer : [multipleChoice.correctAnswer])
        .filter((value) => Number.isInteger(Number(value)))
        .map((value) => Number(value))
        .filter((value, index, arr) => value >= 0 && value < options.length && arr.indexOf(value) === index)
        .sort((a, b) => a - b)
    : Number(multipleChoice.correctAnswer);
  if (!multipleAnswers && (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length)) {
    correctAnswer = null;
  }

  return {
    ...multipleChoice,
    questionText: sanitizeRichText(multipleChoice.questionText),
    options,
    correctAnswer,
    multipleAnswers,
    minSelections: multipleAnswers ? Math.max(1, correctAnswer.length) : 1,
    explanation: sanitizeRichText(multipleChoice.explanation),
  };
}

function normalizeEssay(essay) {
  if (!essay) return null;
  return {
    ...essay,
    questionText: sanitizeRichText(essay.questionText),
    explanation: sanitizeRichText(essay.explanation),
  };
}

/**
 * GET /api/teacher/exams/[id]
 * Retrieves a single exam by ID for the edit form.
 */
export async function GET(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const { id } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(id), teacherId });

    if (!exam) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    // Resolve question images for preview
    if (exam.questions && Array.isArray(exam.questions)) {
      exam.questions = await Promise.all(exam.questions.map(async (q) => {
        if (q.imageUrl) {
          try {
            q.previewUrl = await generatePresignedUrl(q.imageUrl);
          } catch (e) {
            console.error(`Failed to generate preview URL for ${q.imageUrl}:`, e);
          }
        }
        return q;
      }));
    }

    return NextResponse.json({ exam });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * PUT /api/teacher/exams/[id]
 * Updates an exam — only allowed if status is 'draft'.
 */
export async function PUT(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const { id } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    // Verify exam exists and belongs to this teacher
    const existing = await db.collection('exams').findOne({ _id: new ObjectId(id), teacherId });
    if (!existing) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Ujian yang sudah dipublikasi tidak dapat diedit. Tarik publikasi terlebih dahulu.' }, { status: 400 });
    }

    const body = await request.json();
    const { title, subjectId, questions, typeSettings, isRandomized, isOptionRandomized, duration, deadline, examCategory, showExplanation } = body;

    if (!title) {
      return NextResponse.json({ error: 'Judul ujian wajib diisi.' }, { status: 400 });
    }
    if (!subjectId) {
      return NextResponse.json({ error: 'Mata pelajaran wajib dipilih.' }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Ujian harus memiliki minimal 1 soal.' }, { status: 400 });
    }

    // Validate each question block
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.fileUpload) {
        return NextResponse.json({ error: `Soal #${i + 1}: Upload file dinonaktifkan untuk ujian anti-cheat. Gunakan pilihan ganda atau esai.` }, { status: 400 });
      }
      const hasType = q.multipleChoice || q.essay;
      if (!hasType) {
        return NextResponse.json({ error: `Soal #${i + 1} harus memiliki minimal 1 tipe soal aktif.` }, { status: 400 });
      }
      if (q.multipleChoice) {
        if (!q.multipleChoice.questionText) {
          return NextResponse.json({ error: `Soal #${i + 1}: Teks soal pilihan ganda wajib diisi.` }, { status: 400 });
        }
        if (!q.multipleChoice.options || q.multipleChoice.options.length < 2) {
          return NextResponse.json({ error: `Soal #${i + 1}: Pilihan ganda harus memiliki minimal 2 opsi.` }, { status: 400 });
        }
        if (!hasCorrectAnswer(q.multipleChoice)) {
          return NextResponse.json({ error: `Soal #${i + 1}: Jawaban benar pilihan ganda harus dipilih.` }, { status: 400 });
        }
        const normalizedMc = normalizeMultipleChoice(q.multipleChoice);
        if (!hasCorrectAnswer(normalizedMc)) {
          return NextResponse.json({ error: `Soal #${i + 1}: Jawaban benar tidak sesuai dengan opsi yang tersedia.` }, { status: 400 });
        }
      }
      if (q.essay && !q.essay.questionText) {
        return NextResponse.json({ error: `Soal #${i + 1}: Teks soal esai wajib diisi.` }, { status: 400 });
      }
    }

    const normalizedTypeSettings = {
      multipleChoice: typeSettings?.multipleChoice !== false,
      essay: !!typeSettings?.essay,
      fileUpload: false,
    };
    if (!normalizedTypeSettings.multipleChoice && !normalizedTypeSettings.essay) {
      return NextResponse.json({ error: 'Minimal satu jenis soal harus aktif.' }, { status: 400 });
    }

    const verifySubject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId), teacherId });
    if (!verifySubject) {
      return NextResponse.json({ error: 'Mata pelajaran tidak valid untuk akun Anda.' }, { status: 403 });
    }
    const subjectClassCodes = Array.isArray(verifySubject.classCodes) && verifySubject.classCodes.length
      ? verifySubject.classCodes
      : [verifySubject.classCode].filter(Boolean);

    const normalizedQuestions = questions.map((q, idx) => ({
      order: idx + 1,
      imageUrl: q.imageUrl || null,
      imageSize: Number(q.imageSize || 0),
      multipleChoice: normalizeMultipleChoice(q.multipleChoice),
      essay: normalizeEssay(q.essay),
      fileUpload: null,
    }));
    const normalizedExamCategory = examCategory === 'semester' ? 'semester' : 'ulangan';
    const requiresCurriculumApproval = false;
    const activeAcademicYear = await db.collection('academicYears').findOne({ isActive: true });

    await db.collection('exams').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          subjectId,
          academicYearId: activeAcademicYear?.label || existing.academicYearId || null,
          classCodeSnapshot: subjectClassCodes[0] || existing.classCodeSnapshot || null,
          classCodesSnapshot: subjectClassCodes,
          subjectNameSnapshot: verifySubject.subjectName || existing.subjectNameSnapshot || null,
          examCategory: normalizedExamCategory,
          requiresCurriculumApproval,
          validationStatus: 'NotRequired',
          revisionRequired: false,
          revisionNote: null,
          validationUpdatedAt: new Date(),
          questions: normalizedQuestions,
          typeSettings: normalizedTypeSettings,
          isRandomized: !!isRandomized,
          isOptionRandomized: !!isOptionRandomized,
          duration: duration ? parseInt(duration, 10) : null,
          deadline: deadline ? new Date(deadline) : null,
          showResults: true,
          showExplanation: !!showExplanation,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Exam update error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * DELETE /api/teacher/exams/[id]
 * Deletes an exam and all associated examSessions (cascade).
 */
export async function DELETE(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const { id } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const existing = await db.collection('exams').findOne({ _id: new ObjectId(id), teacherId });
    if (!existing) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    // Cascade: fetch all sessions to properly trash physical cloud files
    const sessions = await db.collection('examSessions').find({ examId: id }).toArray();
    for (const session of sessions) {
       if (session.answers && Array.isArray(session.answers)) {
          for (const ans of session.answers) {
             if (ans.uploadedFiles && Array.isArray(ans.uploadedFiles)) {
                for (const file of ans.uploadedFiles) {
                   if (file.fileKey) {
                      await deleteFromR2(file.fileKey);
                   }
                }
             }
          }
       }
    }

    // Drop the collection relational footprints natively
    if (sessions.length > 0) {
       await db.collection('examSessions').deleteMany({ examId: id });
    }

    // Delete the exam itself
    await db.collection('exams').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true, message: 'Ujian dan seluruh sesi terkait telah dihapus.' });
  } catch (err) {
    console.error('Exam deletion error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
