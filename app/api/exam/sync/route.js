import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import redis, { buildExamCacheKey } from '@/lib/redis';
import { createAnswerHash, getAnswerHashAlgorithm, checkDisconnectLock } from '@/lib/examIntegrity';


const FALLBACK_CACHE_TTL_SECONDS = 1800;
const MIN_CACHE_TTL_SECONDS = 60;
const CACHE_GRACE_SECONDS = 60;
const MAX_CACHE_TTL_SECONDS = 24 * 60 * 60;
const MAX_OFFLINE_AUDIT_EVENTS = 20;

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

function calculateCacheTtlSeconds({ exam, session }) {
  const now = Date.now();
  const candidates = [];

  if (exam?.deadline) {
    candidates.push(Math.floor((new Date(exam.deadline).getTime() - now) / 1000) + CACHE_GRACE_SECONDS);
  }

  if (exam?.duration && session?.startedAt) {
    const endAt = new Date(session.startedAt).getTime() + Number(exam.duration) * 60 * 1000;
    candidates.push(Math.floor((endAt - now) / 1000) + CACHE_GRACE_SECONDS);
  }

  const validCandidate = candidates
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)[0];
  const ttl = validCandidate || FALLBACK_CACHE_TTL_SECONDS;
  return Math.min(MAX_CACHE_TTL_SECONDS, Math.max(MIN_CACHE_TTL_SECONDS, ttl));
}

function normalizeOfflineEvents(offlineEvents) {
  return Array.isArray(offlineEvents)
    ? offlineEvents.slice(-MAX_OFFLINE_AUDIT_EVENTS).map((event) => ({
        type: typeof event?.type === 'string' ? event.type.slice(0, 40) : 'unknown',
        at: typeof event?.at === 'string' ? event.at : null,
        durationMs: Number.isFinite(Number(event?.durationMs)) ? Number(event.durationMs) : null,
        answerChanges: Number.isFinite(Number(event?.answerChanges)) ? Number(event.answerChanges) : null,
        reason: typeof event?.reason === 'string' ? event.reason.slice(0, 80) : null,
      }))
    : [];
}

function buildFinalAnswers({ session, answers }) {
  const multipleChoice = Array.isArray(answers?.multipleChoice) ? answers.multipleChoice : [];
  const essay = Array.isArray(answers?.essay) ? answers.essay : [];
  let hasManualGradingNeeds = false;

  const finalAnswers = (session.questions || []).map((question, index) => {
    const answer = {
      questionOrder: index + 1,
      originalOrder: question.order,
      mcAnswer: multipleChoice[index] ?? null,
      essayAnswer: essay[index] ?? '',
      uploadedFiles: [],
    };

    if (question.multipleChoice) {
      answer.score = scoreMultipleChoiceAnswer(answer.mcAnswer, question.multipleChoice.correctAnswer);
    }

    if (question.essay || question.fileUpload) {
      answer.score = null;
      hasManualGradingNeeds = true;
    }

    return answer;
  });

  return {
    finalAnswers,
    gradingStatus: hasManualGradingNeeds ? 'pending-manual' : 'auto-graded',
  };
}

async function finalizeExpiredSession({ db, exam, session, subject, studentId, answers, violationCount, offlineEvents, cacheKey }) {
  const { finalAnswers, gradingStatus } = buildFinalAnswers({ session, answers });

  await db.collection('examSessions').updateOne(
    { _id: session._id, status: 'in-progress' },
    {
      $set: {
        answers: finalAnswers,
        academicYearId: session.academicYearId || exam.academicYearId || null,
        classCodeSnapshot: session.classCodeSnapshot || exam.classCodeSnapshot || subject?.classCode || null,
        subjectNameSnapshot: session.subjectNameSnapshot || exam.subjectNameSnapshot || subject?.subjectName || null,
        exitCount: Math.max(Number(session.exitCount || 0), Number(violationCount || 0)),
        offlineEvents,
        status: 'submitted',
        gradingStatus,
        submittedAt: new Date(),
        autoSubmittedReason: 'exam-time-ended',
      },
    }
  );

  try {
    await redis.del(cacheKey);
  } catch (err) {
    console.error('Redis cleanup on auto-submit failed:', err);
  }

  return { studentId };
}

export async function POST(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { examId, sessionId, answers, violationCount, offlineEvents = [] } = await request.json();

    if (!examId || !ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'examId tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    if (!userDoc?.studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    if (sessionId && !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    let session = null;
    let exam = null;

    if (sessionId) {
      const existingSession = await db.collection('examSessions').findOne({
        _id: new ObjectId(sessionId),
        examId: examId.toString(),
        studentId: userDoc.studentId,
      });
      if (!existingSession) {
        return NextResponse.json({ error: 'Sesi ujian tidak valid atau sudah berakhir.' }, { status: 400 });
      }
      const disconnectCheck = await checkDisconnectLock(db, existingSession);
      if (disconnectCheck.locked) {
        return NextResponse.json({ error: disconnectCheck.error || 'Sesi ujian dikunci karena terputus.', locked: true }, { status: 403 });
      }
      const activeSession = disconnectCheck.session;

      if (activeSession.status === 'locked') {
        return NextResponse.json({ error: activeSession.manualLockReason || 'Sesi ujian dikunci.', locked: true }, { status: 403 });
      }
      if (activeSession.status === 'disqualified') {
        return NextResponse.json({ error: activeSession.disqualifyReason || 'Siswa didiskualifikasi.', disqualified: true }, { status: 403 });
      }
      if (activeSession.status !== 'in-progress') {
        return NextResponse.json({ error: 'Sesi ujian tidak valid atau sudah berakhir.' }, { status: 400 });
      }
      session = activeSession;

      exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
      if (!exam) {
        return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
      }

      const now = Date.now();
      const safeOfflineEvents = normalizeOfflineEvents(offlineEvents);
      const safeAnswers = answers || { multipleChoice: [], essay: [] };
      const cacheKey = buildExamCacheKey(examId, userDoc.studentId);
      const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
      const deadlineEnded = exam.deadline && new Date(exam.deadline).getTime() < now;
      const durationEnded = exam.duration && session.startedAt
        ? new Date(session.startedAt).getTime() + Number(exam.duration) * 60 * 1000 <= now
        : false;

      if (deadlineEnded || durationEnded) {
        await finalizeExpiredSession({
          db,
          exam,
          session,
          subject,
          studentId: userDoc.studentId,
          answers: safeAnswers,
          violationCount,
          offlineEvents: safeOfflineEvents,
          cacheKey,
        });

        return NextResponse.json({
          success: true,
          autoSubmitted: true,
          message: 'Waktu ujian telah berakhir. Jawaban otomatis dikumpulkan.',
        });
      }
    }

    const safeOfflineEvents = normalizeOfflineEvents(offlineEvents);

    const safePayload = {
      answers: answers || { multipleChoice: [], essay: [] },
      violationCount: Number.isFinite(Number(violationCount)) ? Number(violationCount) : 0,
      sessionId: sessionId || null,
      offlineEvents: safeOfflineEvents,
      syncedAt: new Date().toISOString(),
    };
    safePayload.answerHash = createAnswerHash({
      examId,
      sessionId: safePayload.sessionId,
      studentId: userDoc.studentId,
      answers: safePayload.answers,
    });
    safePayload.hashAlgorithm = getAnswerHashAlgorithm();

    if (session?._id) {
      await db.collection('examSessions').updateOne(
        { _id: session._id, status: 'in-progress' },
        {
          $set: {
            draftAnswers: safePayload.answers,
            draftAnswerHash: safePayload.answerHash,
            draftHashAlgorithm: safePayload.hashAlgorithm,
            draftViolationCount: safePayload.violationCount,
            draftUpdatedAt: new Date(),
            lastSeenAt: new Date(),
            offlineEvents: safeOfflineEvents,
          },
        }
      );
    }

    try {
      const key = buildExamCacheKey(examId, userDoc.studentId);
      await redis.set(key, JSON.stringify(safePayload), { ex: calculateCacheTtlSeconds({ exam, session }) });
    } catch (err) {
      console.error('Redis exam sync failed after MongoDB draft save:', err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
