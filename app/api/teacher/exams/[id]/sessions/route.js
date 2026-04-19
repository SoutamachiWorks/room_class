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
          'studentInfo.fullName': 1,
          'studentInfo.studentId': 1,
          'studentInfo.classCode': 1
        }
      },
      { $sort: { 'studentInfo.fullName': 1 } }
    ];

    const sessions = await db.collection('examSessions').aggregate(pipeline).toArray();

    return NextResponse.json({ sessions, examTitle: exam.title });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
