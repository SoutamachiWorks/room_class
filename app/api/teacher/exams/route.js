import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { createNotificationsForClass } from '@/lib/notification';

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
    minSelections: multipleAnswers
      ? Math.max(1, Math.min(options.length, Number(multipleChoice.minSelections || 1)))
      : 1,
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
 * GET /api/teacher/exams
 * Retrieves all exams created by the logged-in teacher, joined with subject info.
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const pipeline = [
      { $match: { teacherId } },
      {
        $addFields: {
          subjectObjectId: { $toObjectId: '$subjectId' },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectObjectId',
          foreignField: '_id',
          as: 'subjectDetails',
        },
      },
      {
        $lookup: {
          from: 'examSessions',
          let: { examIdStr: { $toString: '$_id' } },
          pipeline: [
            { $match: { $expr: { $eq: ['$examId', '$$examIdStr'] } } },
            { $count: 'total' },
          ],
          as: 'usageStats',
        },
      },
      {
        $unwind: {
          path: '$subjectDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          usedCount: {
            $ifNull: [{ $arrayElemAt: ['$usageStats.total', 0] }, 0],
          },
        },
      },
      {
        $project: {
          usageStats: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const exams = await db.collection('exams').aggregate(pipeline).toArray();

    return NextResponse.json({ exams });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * POST /api/teacher/exams
 * Creates a new exam form. Accepts JSON body.
 */
export async function POST(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const body = await request.json();
    const { title, subjectId, questions, typeSettings, isRandomized, isOptionRandomized, duration, deadline, examCategory, showExplanation } = body;

    // Validation
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Judul ujian wajib diisi.' }, { status: 400 });
    }
    if (!subjectId) {
      return NextResponse.json({ error: 'Mata pelajaran wajib dipilih.' }, { status: 400 });
    }
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Ujian harus memiliki minimal 1 soal.' }, { status: 400 });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.fileUpload) {
        return NextResponse.json({ error: `Soal #${i + 1}: Upload file dinonaktifkan untuk ujian anti-cheat. Gunakan pilihan ganda atau esai.` }, { status: 400 });
      }
      if (!q.multipleChoice && !q.essay) {
        return NextResponse.json({ error: `Soal #${i + 1}: Minimal harus ada 1 tipe pertanyaan.` }, { status: 400 });
      }
      if (q.multipleChoice) {
        if (!q.multipleChoice.questionText) {
          return NextResponse.json({ error: `Soal #${i + 1}: Teks soal pilihan ganda wajib diisi.` }, { status: 400 });
        }
        if (!q.multipleChoice.options || q.multipleChoice.options.length < 2) {
          return NextResponse.json({ error: `Soal #${i + 1}: Minimal butuh 2 opsi jawaban.` }, { status: 400 });
        }
        if (!hasCorrectAnswer(q.multipleChoice)) {
          return NextResponse.json({ error: `Soal #${i + 1}: Jawaban benar harus dipilih.` }, { status: 400 });
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

    // Verify subject ownership
    const verifySubject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId), teacherId });
    if (!verifySubject) {
      return NextResponse.json({ error: 'Mata pelajaran tidak valid untuk akun Anda.' }, { status: 403 });
    }
    const activeAcademicYear = await db.collection('academicYears').findOne({ isActive: true });
    const subjectClassCodes = Array.isArray(verifySubject.classCodes) && verifySubject.classCodes.length
      ? verifySubject.classCodes
      : [verifySubject.classCode].filter(Boolean);

    // Normalize question order
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

    const newExam = {
      teacherId,
      subjectId,
      academicYearId: activeAcademicYear?.label || null,
      classCodeSnapshot: subjectClassCodes[0] || null,
      classCodesSnapshot: subjectClassCodes,
      subjectNameSnapshot: verifySubject.subjectName || null,
      title,
      examCategory: normalizedExamCategory,
      requiresCurriculumApproval,
      validationStatus: 'NotRequired',
      questions: normalizedQuestions,
      typeSettings: normalizedTypeSettings,
      isRandomized: !!isRandomized,
      isOptionRandomized: !!isOptionRandomized,
      duration: duration ? parseInt(duration, 10) : null,
      deadline: deadline ? new Date(deadline) : null,
      showResults: true,
      showExplanation: !!showExplanation,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('exams').insertOne(newExam);

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error('Exam creation error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
