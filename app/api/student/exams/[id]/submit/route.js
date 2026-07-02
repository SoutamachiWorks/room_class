import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2 } from '@/lib/s3Client';
import { createNotification } from '@/lib/notification';
import redis, { buildExamCacheKey } from '@/lib/redis';
import { createAnswerHash, checkDisconnectLock } from '@/lib/examIntegrity';
import { validateFiles } from '@/lib/fileValidation';

const SERVER_SUBMIT_GRACE_MS = 60_000;
const MAX_EXAM_UPLOAD_TOTAL_BYTES = 10 * 1024 * 1024;

function normalizeAnswerSet(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => Number.isInteger(Number(item))).map((item) => Number(item)).sort((a, b) => a - b);
  }
  return value === null || value === undefined ? [] : [Number(value)];
}

function scoreMultipleChoiceAnswer(answer, correctAnswer) {
  if (!Array.isArray(correctAnswer)) {
    return answer === correctAnswer ? 100 : 0;
  }

  const selected = normalizeAnswerSet(answer);
  const correct = normalizeAnswerSet(correctAnswer);
  if (selected.length === 0 || selected.length > correct.length) return 0;

  const correctSet = new Set(correct);
  const correctSelectedCount = selected.filter((value) => correctSet.has(value)).length;
  if (correctSelectedCount === 0) return 0;
  if (correctSelectedCount === correct.length && selected.length === correct.length) return 100;

  return Number(((correctSelectedCount / (correct.length + 1)) * 100).toFixed(1));
}

function validateMultipleAnswerSelection(answer, question) {
  if (!question?.multipleChoice?.multipleAnswers) return null;
  const requiredSelections = Array.isArray(question.multipleChoice.correctAnswer)
    ? Math.max(1, question.multipleChoice.correctAnswer.length)
    : Math.max(1, Number(question.multipleChoice.minSelections || 1));
  const selectedCount = normalizeAnswerSet(answer?.mcAnswer).length;
  if (selectedCount > requiredSelections) {
    return `Soal ${answer?.questionOrder || ''}: maksimal pilih ${requiredSelections} jawaban.`;
  }
  return null;
}

/**
 * POST /api/student/exams/[id]/submit
 * Submits answers for an exam session.
 *
 * Accepts multipart/form-data:
 *   - sessionId (string)
 *   - answers (JSON string): array of answer objects
 *   - file-{questionOrder} (File): uploaded files per question
 */
export async function POST(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;

    if (!studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const formData = await request.formData();
    const sessionId = formData.get('sessionId');
    const answersJSON = formData.get('answers');

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    // Verify session ownership and status
    let session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString(),
      studentId,
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesi ujian tidak ditemukan.' }, { status: 404 });
    }

    const disconnectCheck = await checkDisconnectLock(db, session);
    if (disconnectCheck.locked) {
      return NextResponse.json({ error: disconnectCheck.error || 'Sesi ujian dikunci karena terputus.', locked: true }, { status: 403 });
    }
    const activeSession = disconnectCheck.session;

    if (activeSession.status === 'submitted') {
      return NextResponse.json({ error: 'Jawaban sudah dikumpulkan sebelumnya.' }, { status: 400 });
    }

    if (activeSession.status === 'locked') {
      return NextResponse.json({ error: 'Sesi ujian telah dikunci.', locked: true }, { status: 403 });
    }

    if (activeSession.status === 'disqualified') {
      return NextResponse.json({ error: 'Anda didiskualifikasi dari ujian ini.', disqualified: true }, { status: 403 });
    }

    session = activeSession;

    // We still need exam metadata for notification/logging.
    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    const subject = await db.collection('subjects').findOne({
      _id: new ObjectId(exam.subjectId),
    });

    const now = Date.now();
    if (exam.deadline && new Date(exam.deadline).getTime() < now) {
      return NextResponse.json({ error: 'Batas akhir ujian sudah lewat. Jawaban tidak dapat dikumpulkan.' }, { status: 409 });
    }

    if (exam.duration && session.startedAt) {
      const endAt = new Date(session.startedAt).getTime() + Number(exam.duration) * 60 * 1000;
      if (endAt + SERVER_SUBMIT_GRACE_MS < now) {
        return NextResponse.json({ error: 'Durasi ujian sudah habis. Jawaban tidak dapat dikumpulkan.' }, { status: 409 });
      }
    }

    // Parse answers
    let answers = [];
    try {
      answers = JSON.parse(answersJSON || '[]');
    } catch (e) {
      return NextResponse.json({ error: 'Format jawaban tidak valid.' }, { status: 400 });
    }

    let cachedViolationCount = null;
    let cachedOfflineEvents = [];
    let hasCachedAnswers = false;
    try {
      const cacheKey = buildExamCacheKey(examId.toString(), studentId);
      const cachedRaw = await redis.get(cacheKey);
      const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
      if (cached?.answers) {
        hasCachedAnswers = true;
        if (cached.answerHash) {
          const expectedHash = createAnswerHash({
            examId: examId.toString(),
            sessionId,
            studentId,
            answers: cached.answers,
          });
          if (expectedHash !== cached.answerHash) {
            return NextResponse.json(
              { error: 'Integritas jawaban sementara tidak valid. Silakan sinkronkan ulang jawaban sebelum submit.' },
              { status: 409 }
            );
          }
        }

        const mc = Array.isArray(cached.answers.multipleChoice) ? cached.answers.multipleChoice : [];
        const essay = Array.isArray(cached.answers.essay) ? cached.answers.essay : [];
        answers = answers.map((ans) => {
          const idx = Math.max(0, (ans.questionOrder || 1) - 1);
          return {
            ...ans,
            mcAnswer: mc[idx] ?? ans.mcAnswer ?? null,
            essayAnswer: essay[idx] ?? ans.essayAnswer ?? '',
          };
        });
      }
      if (Number.isFinite(Number(cached?.violationCount))) {
        cachedViolationCount = Number(cached.violationCount);
      }
      if (Array.isArray(cached?.offlineEvents)) {
        cachedOfflineEvents = cached.offlineEvents;
      }
    } catch (err) {
      console.error('Redis read on submit failed:', err);
    }

    if (!hasCachedAnswers && session.draftAnswers) {
      if (session.draftAnswerHash) {
        const expectedHash = createAnswerHash({
          examId: examId.toString(),
          sessionId,
          studentId,
          answers: session.draftAnswers,
        });
        if (expectedHash !== session.draftAnswerHash) {
          return NextResponse.json(
            { error: 'Integritas draft jawaban tidak valid. Silakan sinkronkan ulang jawaban sebelum submit.' },
            { status: 409 }
          );
        }
      }
      const mc = Array.isArray(session.draftAnswers.multipleChoice) ? session.draftAnswers.multipleChoice : [];
      const essay = Array.isArray(session.draftAnswers.essay) ? session.draftAnswers.essay : [];
      answers = answers.map((ans) => {
        const idx = Math.max(0, (ans.questionOrder || 1) - 1);
        return {
          ...ans,
          mcAnswer: mc[idx] ?? ans.mcAnswer ?? null,
          essayAnswer: essay[idx] ?? ans.essayAnswer ?? '',
        };
      });
      if (Number.isFinite(Number(session.draftViolationCount))) {
        cachedViolationCount = Number(session.draftViolationCount);
      }
      if (Array.isArray(session.offlineEvents)) {
        cachedOfflineEvents = session.offlineEvents;
      }
    }

    let hasManualGradingNeeds = false;
    const allUploadedFiles = [];
    for (const ans of answers) {
      allUploadedFiles.push(...formData.getAll(`file-${ans.questionOrder}`).filter((file) => file && file.name));
    }
    const validation = validateFiles(allUploadedFiles);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
    }
    const totalUploadSize = allUploadedFiles.reduce((total, file) => total + Number(file.size || 0), 0);
    if (totalUploadSize > MAX_EXAM_UPLOAD_TOTAL_BYTES) {
      return NextResponse.json({ error: 'Total lampiran berkas ujian melampaui batas maksimal 10 MB.' }, { status: 400 });
    }

    // Process file uploads & auto-grade per question
    for (let i = 0; i < answers.length; i++) {
      const ans = answers[i];
      
      // Auto-grade against the student's session question (supports per-student option shuffle).
      const sessionQuestion = Array.isArray(session.questions)
        ? session.questions[(ans.questionOrder || 0) - 1]
        : null;
      const selectionError = validateMultipleAnswerSelection(ans, sessionQuestion);
      if (selectionError) {
        return NextResponse.json({ error: selectionError }, { status: 400 });
      }
      if (sessionQuestion) {
        if (sessionQuestion.multipleChoice) {
          ans.score = scoreMultipleChoiceAnswer(ans.mcAnswer, sessionQuestion.multipleChoice.correctAnswer);
        }
        if (sessionQuestion.essay || sessionQuestion.fileUpload) {
          ans.score = null; // Pending review
          hasManualGradingNeeds = true;
        }
      }

      // File upload processing
      const fileKey = `file-${ans.questionOrder}`;
      const files = formData.getAll(fileKey);

      const processedFiles = [];
      for (const file of files) {
        if (file && file.name) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const r2Data = await uploadToR2(buffer, file.name, file.type, 'exam-answers');

          processedFiles.push({
            originalName: r2Data.originalName,
            fileKey: r2Data.fileKey,
            size: r2Data.size,
            type: r2Data.mimeType,
          });
        }
      }

      answers[i].uploadedFiles = processedFiles;
    }

    const gradingStatus = hasManualGradingNeeds ? 'pending-manual' : 'auto-graded';

    // Update session
    await db.collection('examSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          answers,
          academicYearId: session.academicYearId || exam.academicYearId || null,
          classCodeSnapshot: session.classCodeSnapshot || exam.classCodeSnapshot || subject?.classCode || null,
          subjectNameSnapshot: session.subjectNameSnapshot || exam.subjectNameSnapshot || subject?.subjectName || null,
          ...(cachedViolationCount !== null ? { exitCount: Math.max(session.exitCount || 0, cachedViolationCount) } : {}),
          offlineEvents: cachedOfflineEvents,
          status: 'submitted',
          gradingStatus,
          submittedAt: new Date(),
        },
        $unset: {
          draftAnswers: '',
          draftAnswerHash: '',
          draftHashAlgorithm: '',
          draftViolationCount: '',
          draftUpdatedAt: '',
        },
      }
    );

    try {
      const cacheKey = buildExamCacheKey(examId.toString(), studentId);
      await redis.del(cacheKey);
    } catch (err) {
      console.error('Redis cleanup on submit failed:', err);
    }

    // Notifikasi ke guru
    const teacherUser = await db.collection('users').findOne({ role: 'teacher', teacherId: exam.teacherId });
    if (teacherUser) {
      await createNotification(db, {
        userId: teacherUser._id,
        title: 'Pengumpulan Ujian',
        message: `Siswa ${userDoc.fullName || studentId} telah mengumpulkan ujian "${exam.title}".`,
        type: 'success',
        actionUrl: `/dashboard/teacher/exams/${exam._id}/results` // Ensure this route exists or matches the teacher's dashboard
      });
    }

    return NextResponse.json({ success: true, message: 'Jawaban berhasil dikumpulkan.' });

  } catch (err) {
    console.error('Exam submit error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
