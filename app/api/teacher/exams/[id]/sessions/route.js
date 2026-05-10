import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

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
      const answeredCount = Array.isArray(sess.answers) ? sess.answers.filter((ans) => {
        if (ans.mcAnswer === 0) return true;
        if (ans.mcAnswer) return true;
        if (ans.essayAnswer?.trim()) return true;
        if (Array.isArray(ans.uploadedFiles) && ans.uploadedFiles.length > 0) return true;
        return false;
      }).length : 0;
      let calculatedScore = null;
      if (
        Array.isArray(sess.answers) &&
        sess.answers.length > 0 &&
        (sess.gradingStatus === 'fully-graded' || sess.gradingStatus === 'auto-graded')
      ) {
        const totalPoints = sess.answers.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
        calculatedScore = Number((totalPoints / sess.answers.length).toFixed(1));
      }
      return {
        ...sess,
        questionCount,
        answeredCount,
        calculatedScore,
      };
    });

    const classStudents = subject?.classCode
      ? await db.collection('users')
        .find(
          { role: 'student', classCode: subject.classCode },
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
        classCode: subject?.classCode || '-',
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
