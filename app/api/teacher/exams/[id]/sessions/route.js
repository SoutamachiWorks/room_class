import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

function normalizeSelectedAnswers(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => Number.isInteger(Number(item))).map((item) => Number(item));
  }
  return value === null || value === undefined ? [] : [Number(value)];
}

function hasSubmittedAnswer(answer = {}) {
  if (normalizeSelectedAnswers(answer.mcAnswer).length > 0) return true;
  if (answer.essayAnswer?.trim()) return true;
  if (Array.isArray(answer.uploadedFiles) && answer.uploadedFiles.length > 0) return true;
  return false;
}

function countDraftAnswers(draftAnswers = {}, questions = []) {
  const multipleChoice = Array.isArray(draftAnswers.multipleChoice) ? draftAnswers.multipleChoice : [];
  const essay = Array.isArray(draftAnswers.essay) ? draftAnswers.essay : [];
  return questions.filter((question, index) => {
    if (question.multipleChoice) return normalizeSelectedAnswers(multipleChoice[index]).length > 0;
    if (question.essay || question.fileUpload) return typeof essay[index] === 'string' && essay[index].trim().length > 0;
    return false;
  }).length;
}

/**
 * GET /api/teacher/exams/[id]/sessions
 * Gets all student sessions for a specific exam.
 */
export async function GET(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { id: examId } = await params;

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    // Verify teacher owns this exam via its subject
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });

    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
    if (!subject || subject.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Anda tidak berhak melihat ujian ini.' }, { status: 403 });
    }

    // Aggregate sessions with student details
    const pipeline = [
      { $match: { examId: examId.toString() } },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: 'studentId',
          as: 'studentInfo'
        }
      },
      {
        $unwind: {
          path: '$studentInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          exitCount: 1,
          status: 1,
          gradingStatus: 1,
          startedAt: 1,
          submittedAt: 1,
          answers: 1,
          questions: 1,
          examEvents: 1,
          unexpectedExitCount: 1,
          activeUnexpectedExit: 1,
          draftAnswers: 1,
          draftUpdatedAt: 1,
          lastHeartbeatAt: 1,
          lastSeenAt: 1,
          disqualifiedAt: 1,
          disqualifyReason: 1,
          manualLockedAt: 1,
          manualLockReason: 1,
          'studentInfo.fullName': 1,
          'studentInfo.studentId': 1,
          'studentInfo.classCode': 1
        }
      },
      { $sort: { 'studentInfo.fullName': 1 } }
    ];

    const sessions = await db.collection('examSessions').aggregate(pipeline).toArray();

    const mappedSessions = sessions.map((sess) => {
      const questionCount = Array.isArray(sess.questions) ? sess.questions.length : (exam.questions?.length || 0);
      const submittedAnsweredCount = Array.isArray(sess.answers) ? sess.answers.filter(hasSubmittedAnswer).length : 0;
      const draftAnsweredCount = sess.status === 'in-progress'
        ? countDraftAnswers(sess.draftAnswers, Array.isArray(sess.questions) ? sess.questions : exam.questions || [])
        : 0;
      const answeredCount = sess.status === 'in-progress'
        ? Math.max(submittedAnsweredCount, draftAnsweredCount)
        : submittedAnsweredCount;
      let calculatedScore = null;
      if (sess.status === 'disqualified') {
        calculatedScore = 0;
      }
      if (
        calculatedScore === null &&
        Array.isArray(sess.answers) &&
        sess.answers.length > 0 &&
        (sess.gradingStatus === 'fully-graded' || sess.gradingStatus === 'auto-graded')
      ) {
        const totalPoints = sess.answers.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
        calculatedScore = Number((totalPoints / sess.answers.length).toFixed(1));
      }
      return {
        ...sess,
        draftAnswers: undefined,
        questionCount,
        answeredCount,
        draftAnsweredCount,
        progressSource: sess.status === 'in-progress' && draftAnsweredCount > submittedAnsweredCount ? 'draft' : 'answers',
        calculatedScore,
      };
    });

    const subjectClassCodes = Array.isArray(subject?.classCodes) && subject.classCodes.length
      ? subject.classCodes
      : [subject?.classCode].filter(Boolean);

    const classStudents = subjectClassCodes.length
      ? await db.collection('users')
        .find(
          { role: 'student', classCode: { $in: subjectClassCodes } },
          { projection: { fullName: 1, studentId: 1, classCode: 1 } }
        )
        .toArray()
      : [];

    const sessionByStudentId = new Map(
      mappedSessions
        .filter((sess) => sess.studentInfo?.studentId)
        .map((sess) => [sess.studentInfo.studentId, sess])
    );

    const completeSessions = classStudents.map((student) => {
      const existing = sessionByStudentId.get(student.studentId);
      if (existing) return existing;
      return {
        _id: `not-started-${student.studentId}`,
        exitCount: 0,
        status: 'not-started',
        gradingStatus: null,
        startedAt: null,
        submittedAt: null,
        answers: [],
        questions: exam.questions || [],
        questionCount: exam.questions?.length || 0,
        answeredCount: 0,
        calculatedScore: null,
        studentInfo: {
          fullName: student.fullName,
          studentId: student.studentId,
          classCode: student.classCode,
        },
      };
    });

    const totalStudents = classStudents.length || mappedSessions.length;
    completeSessions.sort((a, b) => (a.studentInfo?.fullName || '').localeCompare(b.studentInfo?.fullName || '', 'id'));

    return NextResponse.json({
      sessions: completeSessions,
      examTitle: exam.title,
      examMeta: {
        classCode: subjectClassCodes.join(', ') || '-',
        classCodes: subjectClassCodes,
        duration: exam.duration || null,
        deadline: exam.deadline || null,
        showResults: !!exam.showResults,
        isExamOpen: exam.isExamOpen === true,
        status: exam.status || 'draft',
        createdAt: exam.createdAt || null,
      },
      totalStudents,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
