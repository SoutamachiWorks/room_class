import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/student/exams
 * Returns all published exams scoped to the student's classCode.
 * Also attaches the student's examSession status if one exists.
 */
export async function GET(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const enrolledYears = userDoc?.enrolledYears || [];

    const { searchParams } = new URL(request.url);
    const yearId = searchParams.get('yearId');

    let classCode = userDoc?.classCode;

    // Archive Mode logic: If yearId is provided and exists in history, use that classCode
    if (yearId && enrolledYears.length > 0) {
      const targetYear = enrolledYears.find(y => y.yearId === yearId);
      if (targetYear) {
        classCode = targetYear.classCode;
      }
    }

    if (!classCode || !studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    // Find subjects matching this student's classCode
    const matchingSubjects = await db.collection('subjects').find({ classCode }).toArray();
    const subjectIds = matchingSubjects.map(s => s._id.toString());

    if (subjectIds.length === 0) {
      return NextResponse.json({ exams: [] });
    }

    const pipeline = [
      { $match: { subjectId: { $in: subjectIds }, status: 'published' } },
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
        $unwind: {
          path: '$subjectDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          teacherId: 1,
          subjectId: 1,
          title: 1,
          status: 1,
          showResults: 1,
          randomCount: 1,
          totalQuestions: { $size: '$questions' },
          deadline: 1,
          createdAt: 1,
          subjectDetails: 1,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const exams = await db.collection('exams').aggregate(pipeline).toArray();

    // Fetch this student's exam sessions to map status
    const examIds = exams.map(e => e._id.toString());
    const sessions = await db.collection('examSessions')
      .find({ studentId, examId: { $in: examIds } })
      .sort({ startedAt: -1 })
      .toArray();

    // Build a map: examId -> latest session
    const sessionMap = {};
    for (const sess of sessions) {
      if (!sessionMap[sess.examId]) {
        // Calculate score
        let calculatedScore = null;
        if (sess.gradingStatus !== 'pending-manual' && Array.isArray(sess.answers)) {
          const totalPoints = sess.answers.reduce((acc, curr) => acc + (curr.score || 0), 0);
          const divisor = sess.answers.length > 0 ? sess.answers.length : 1;
          calculatedScore = (totalPoints / divisor).toFixed(1);
        }

        sessionMap[sess.examId] = {
          _id: sess._id,
          status: sess.status,
          gradingStatus: sess.gradingStatus,
          startedAt: sess.startedAt,
          submittedAt: sess.submittedAt,
          calculatedScore
        };
      }
    }

    const result = exams.map(e => ({
      ...e,
      session: sessionMap[e._id.toString()] || null,
    }));

    return NextResponse.json({ 
      exams: result,
      enrolledYears
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
