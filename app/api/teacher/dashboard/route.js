import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/teacher/dashboard
 * Aggregates all data needed for the teacher's command center dashboard.
 * Returns: student count, active exams, active assignments, and ungraded submissions.
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    // --- 1. Get all subjects taught by this teacher ---
    const subjects = await db.collection('subjects').find({ teacherId }).toArray();
    const subjectIds = subjects.map(s => s._id.toString());
    const classCodes = [
      ...new Set(
        subjects.flatMap((s) => (
          Array.isArray(s.classCodes) && s.classCodes.length
            ? s.classCodes
            : [s.classCode]
        )).filter(Boolean)
      ),
    ];

    // --- 2. Count total students ---
    const totalStudents = await db.collection('users').countDocuments({
      role: 'student',
      classCode: { $in: classCodes },
    });

    // --- 3. Count active assignments (all assignments by this teacher) ---
    const totalAssignments = await db.collection('assignments').countDocuments({ teacherId });
    const activeAssignments = await db.collection('assignments').countDocuments({
      teacherId,
      $or: [
        { deadline: { $gte: new Date() } },
        { deadline: null },
      ],
    });

    // --- 4. Count published exams ---
    const activeExams = await db.collection('exams').countDocuments({ teacherId, status: 'published' });

    // --- 5. Get ungraded submissions (score is null) ---
    const assignmentDocs = await db.collection('assignments')
      .find({ teacherId })
      .project({ _id: 1, text: 1, subjectId: 1, deadline: 1 })
      .toArray();

    const assignmentIds = assignmentDocs.map(a => a._id.toString());
    const assignmentLookup = {};
    for (const a of assignmentDocs) assignmentLookup[a._id.toString()] = a;

    // Find submissions without a score
    const ungradedSubmissions = await db.collection('submissions')
      .find({
        assignmentId: { $in: assignmentIds },
        score: null,
      })
      .sort({ submittedAt: -1 })
      .limit(10)
      .toArray();

    // Enrich with student name and assignment info
    const enriched = await Promise.all(
      ungradedSubmissions.map(async (sub) => {
        const studentUser = await db.collection('users').findOne(
          { studentId: sub.studentId },
          { projection: { fullName: 1, classCode: 1 } }
        );

        const assignment = assignmentLookup[sub.assignmentId];
        let subjectName = '';
        if (assignment?.subjectId && ObjectId.isValid(assignment.subjectId)) {
          const subjectDoc = await db.collection('subjects').findOne(
            { _id: new ObjectId(assignment.subjectId) },
            { projection: { subjectName: 1 } }
          );
          subjectName = subjectDoc?.subjectName || '';
        }

        return {
          submissionId: sub._id.toString(),
          assignmentId: sub.assignmentId,
          studentName: studentUser?.fullName || 'Siswa',
          classCode: studentUser?.classCode || '',
          assignmentTitle: assignment?.text?.substring(0, 60) || 'Tugas',
          subjectName,
          submittedAt: sub.submittedAt,
          isLate: sub.isLate,
        };
      })
    );

    return NextResponse.json({
      stats: {
        totalStudents,
        totalAssignments,
        activeAssignments,
        activeExams,
      },
      ungradedSubmissions: enriched,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
