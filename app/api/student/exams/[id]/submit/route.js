import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2 } from '@/lib/s3Client';
import { createNotification } from '@/lib/notification';
import redis, { buildExamCacheKey } from '@/lib/redis';
import { createAnswerHash } from '@/lib/examIntegrity';

const SERVER_SUBMIT_GRACE_MS = 60_000;

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
    const session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString(),
      studentId,
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesi ujian tidak ditemukan.' }, { status: 404 });
    }

    if (session.status === 'submitted') {
      return NextResponse.json({ error: 'Jawaban sudah dikumpulkan sebelumnya.' }, { status: 400 });
    }

    if (session.status === 'locked') {
      return NextResponse.json({ error: 'Sesi ujian telah dikunci.', locked: true }, { status: 403 });
    }

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
    try {
      const cacheKey = buildExamCacheKey(examId.toString(), studentId);
      const cachedRaw = await redis.get(cacheKey);
      const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
      if (cached?.answers) {
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

    let hasManualGradingNeeds = false;

    // Process file uploads & auto-grade per question
    for (let i = 0; i < answers.length; i++) {
      const ans = answers[i];
      
      // Auto-grade against the student's session question (supports per-student option shuffle).
      const sessionQuestion = Array.isArray(session.questions)
        ? session.questions[(ans.questionOrder || 0) - 1]
        : null;
      if (sessionQuestion) {
        if (sessionQuestion.multipleChoice) {
          if (ans.mcAnswer === sessionQuestion.multipleChoice.correctAnswer) {
            ans.score = 100;
          } else {
            ans.score = 0;
          }
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
    const isLockout = formData.get('isLockout') === 'true';

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
          status: isLockout ? 'locked' : 'submitted',
          gradingStatus,
          submittedAt: new Date(),
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
