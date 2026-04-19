import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/student/dashboard
 * Aggregates data for the student's command center dashboard.
 * Returns: pending assignments (todo), available exams, and recent grades.
 */
export async function GET(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const classCode = userDoc?.classCode;
    const studentId = userDoc?.studentId;

    if (!classCode || !studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    // --- Get all subjects in this student's class ---
    const matchingSubjects = await db.collection('subjects').find({ classCode }).toArray();
    const subjectIds = matchingSubjects.map(s => s._id.toString());
    const subjectLookup = {};
    for (const s of matchingSubjects) subjectLookup[s._id.toString()] = s;

    if (subjectIds.length === 0) {
      return NextResponse.json({ pendingAssignments: [], availableExams: [], recentGrades: [] });
    }

    // --- 1. Get pending assignments (not yet submitted) ---
    const allAssignments = await db.collection('assignments')
      .find({ subjectId: { $in: subjectIds } })
      .sort({ deadline: 1 })
      .toArray();

    const assignmentIds = allAssignments.map(a => a._id.toString());

    // Get this student's submissions
    const submissions = await db.collection('submissions')
      .find({ studentId, assignmentId: { $in: assignmentIds } })
      .toArray();

    const submissionMap = {};
    for (const sub of submissions) submissionMap[sub.assignmentId] = sub;

    // Filter: not submitted yet
    const pendingAssignments = allAssignments
      .filter(a => !submissionMap[a._id.toString()])
      .map(a => ({
        _id: a._id.toString(),
        text: a.text,
        deadline: a.deadline || null,
        subjectName: subjectLookup[a.subjectId]?.subjectName || 'Mata Pelajaran',
        subjectId: a.subjectId,
      }))
      .sort((a, b) => {
        // null deadlines go to bottom
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });

    // --- 2. Get available (published) exams not yet attempted ---
    const exams = await db.collection('exams')
      .find({ subjectId: { $in: subjectIds }, status: 'published' })
      .sort({ createdAt: -1 })
      .toArray();

    const examIds = exams.map(e => e._id.toString());
    const sessions = await db.collection('examSessions')
      .find({ studentId, examId: { $in: examIds } })
      .toArray();
    const sessionMap = {};
    for (const sess of sessions) sessionMap[sess.examId] = sess;

    const availableExams = exams
      .filter(e => !sessionMap[e._id.toString()])
      .map(e => ({
        _id: e._id.toString(),
        title: e.title,
        subjectName: subjectLookup[e.subjectId]?.subjectName || 'Mata Pelajaran',
        totalQuestions: (e.questions || []).length,
        createdAt: e.createdAt,
      }));

    // --- 3. Get recent graded submissions (score is not null) ---
    const gradedSubmissions = await db.collection('submissions')
      .find({ studentId, score: { $ne: null } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .toArray();

    const recentGrades = gradedSubmissions.map(sub => {
      const assignment = allAssignments.find(a => a._id.toString() === sub.assignmentId);
      const subjectName = assignment ? (subjectLookup[assignment.subjectId]?.subjectName || '') : '';
      return {
        submissionId: sub._id.toString(),
        assignmentId: sub.assignmentId,
        assignmentTitle: assignment?.text?.substring(0, 60) || 'Tugas',
        subjectName,
        score: sub.score,
        gradedAt: sub.updatedAt,
        isLate: sub.isLate,
      };
    });

    return NextResponse.json({
      pendingAssignments,
      availableExams,
      recentGrades,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
