import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { generatePresignedUrl } from '@/lib/s3Client';

/**
 * Fisher-Yates shuffle — server-side randomization.
 * Returns a new shuffled array without mutating the original.
 */
function fisherYatesShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleMcOptions(question) {
  if (!question?.multipleChoice?.options || question.multipleChoice.options.length < 2) {
    return question;
  }

  const originalOptions = question.multipleChoice.options;
  const indices = originalOptions.map((_, idx) => idx);
  const shuffledIndices = fisherYatesShuffle(indices);
  const shuffledOptions = shuffledIndices.map((idx) => originalOptions[idx]);

  const originalCorrect = question.multipleChoice.correctAnswer;
  const shuffledCorrect = shuffledIndices.indexOf(originalCorrect);

  return {
    ...question,
    multipleChoice: {
      ...question.multipleChoice,
      options: shuffledOptions,
      correctAnswer: shuffledCorrect,
    },
  };
}

/**
 * Strip correct answers from questions and resolve image URLs before sending to client.
 */
async function sanitizeQuestions(questions) {
  return await Promise.all(questions.map(async (q, idx) => {
    const sanitized = { ...q, displayOrder: idx + 1 };
    
    // Resolve imageUrl to a secure presigned URL
    if (sanitized.imageUrl) {
      try {
        sanitized.imageUrl = await generatePresignedUrl(sanitized.imageUrl);
      } catch (e) {
        console.error(`Failed to generate presigned URL for ${sanitized.imageUrl}:`, e);
        sanitized.imageUrl = null;
      }
    }

    if (sanitized.multipleChoice) {
      sanitized.multipleChoice = {
        questionText: sanitized.multipleChoice.questionText,
        options: sanitized.multipleChoice.options,
        // Do NOT send correctAnswer to client
      };
    }
    return sanitized;
  }));
}

/**
 * POST /api/student/exams/[id]/start
 * Starts a new exam session with server-side question randomization.
 *
 * Logic:
 * - If an existing session is 'in-progress', resume it (return the same questions).
 * - If an existing session is 'submitted', block (already completed).
 * - If an existing session is 'locked', block (locked out).
 * - Otherwise, create a new session with randomized questions.
 */
export async function POST(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const classCode = userDoc?.classCode;

    if (!studentId || !classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    // Verify exam exists and is published
    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId), status: 'published' });
    if (!exam) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan atau belum dipublikasikan.' }, { status: 404 });
    }

    // Verify the exam's subject classCode matches student's classCode
    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
    if (!subject || subject.classCode !== classCode) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke ujian ini.' }, { status: 403 });
    }

    // Check if deadline has passed
    if (exam.deadline && new Date(exam.deadline).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Ujian ini telah melewati batas waktu (deadline) dan tidak dapat lagi diakses. Silakan hubungi guru Anda.' }, { status: 403 });
    }

    if (exam.isExamOpen !== true) {
      return NextResponse.json(
        { error: 'Ujian belum dimulai. Tunggu guru atau pengawas membuka ujian terlebih dahulu.' },
        { status: 403 }
      );
    }

    // Check for existing session
    const existingSession = await db.collection('examSessions').findOne({
      examId: examId.toString(),
      studentId,
    }, { sort: { startedAt: -1 } });

    if (existingSession) {
      if (existingSession.status === 'submitted') {
        return NextResponse.json({ error: 'Anda sudah menyelesaikan ujian ini.' }, { status: 400 });
      }
      if (existingSession.status === 'locked') {
        return NextResponse.json({ error: 'Sesi ujian Anda telah dikunci karena pelanggaran. Hubungi guru Anda.', locked: true }, { status: 403 });
      }
      if (existingSession.status === 'in-progress') {
        // Resume: return existing randomized questions
        return NextResponse.json({
          sessionId: existingSession._id,
          questions: await sanitizeQuestions(existingSession.questions),
          exitCount: existingSession.exitCount,
          examTitle: exam.title,
          examDuration: exam.duration,
          startedAt: existingSession.startedAt,
        });
      }
    }

    // Get all questions
    const allQuestions = exam.questions || [];

    // Shuffle only if isRandomized is true
    let selected;
    if (exam.isRandomized) {
      selected = fisherYatesShuffle(allQuestions);
    } else {
      selected = [...allQuestions];
    }

    if (exam.isOptionRandomized) {
      selected = selected.map((q) => shuffleMcOptions(q));
    }

    const newSession = {
      examId: examId.toString(),
      studentId,
      academicYearId: exam.academicYearId || null,
      classCodeSnapshot: exam.classCodeSnapshot || subject.classCode || null,
      subjectNameSnapshot: exam.subjectNameSnapshot || subject.subjectName || null,
      examTitleSnapshot: exam.title || null,
      exitCount: 0,
      status: 'in-progress',
      questions: selected, // store the randomized set for this student
      answers: [],
      startedAt: new Date(),
      submittedAt: null,
    };

    const result = await db.collection('examSessions').insertOne(newSession);

    return NextResponse.json({
      sessionId: result.insertedId,
      questions: await sanitizeQuestions(selected),
      exitCount: 0,
      examTitle: exam.title,
      examDuration: exam.duration,
      startedAt: newSession.startedAt,
    }, { status: 201 });

  } catch (err) {
    console.error('Exam start error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
