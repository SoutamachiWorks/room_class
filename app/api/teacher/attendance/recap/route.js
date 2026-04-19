import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/teacher/attendance/recap
 * Returns attendance recap (percentage) for each student per subject.
 * Query: ?subjectId=xxx
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');

    if (!subjectId) return NextResponse.json({ error: 'subjectId wajib diisi.' }, { status: 400 });
    if (!ObjectId.isValid(subjectId)) return NextResponse.json({ error: 'subjectId tidak valid.' }, { status: 400 });

    // Verify subject ownership
    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId), teacherId });
    if (!subject) return NextResponse.json({ error: 'Mata pelajaran tidak valid untuk akun Anda.' }, { status: 403 });

    // Get all closed sessions for this subject
    const sessions = await db.collection('attendanceSessions')
      .find({ teacherId, subjectId, status: 'closed' })
      .toArray();
    const sessionIds = sessions.map(s => s._id.toString());
    const totalSessions = sessions.length;

    // Get all students in the class
    const students = await db.collection('users')
      .find({ role: 'student', classCode: subject.classCode })
      .project({ studentId: 1, fullName: 1 })
      .sort({ fullName: 1 })
      .toArray();

    if (students.length === 0 || totalSessions === 0) {
      return NextResponse.json({
        subject: { _id: subjectId, subjectName: subject.subjectName, classCode: subject.classCode },
        totalSessions,
        recap: [],
      });
    }

    // Aggregate attendance per student
    const allAttendances = await db.collection('attendances')
      .find({ sessionId: { $in: sessionIds } })
      .toArray();

    const recap = students.map(student => {
      const studentRecords = allAttendances.filter(a => a.studentId === student.studentId);
      const hadir = studentRecords.filter(a => a.status === 'hadir').length;
      const sakit = studentRecords.filter(a => a.status === 'sakit').length;
      const izin  = studentRecords.filter(a => a.status === 'izin').length;
      const alpha = studentRecords.filter(a => a.status === 'alpha').length;
      const totalRecorded = studentRecords.length;
      const percentage = totalSessions > 0
        ? Math.round((hadir / totalSessions) * 100)
        : 0;

      return {
        studentId: student.studentId,
        fullName: student.fullName,
        hadir,
        sakit,
        izin,
        alpha,
        totalRecorded,
        totalSessions,
        percentage,
      };
    });

    return NextResponse.json({
      subject: {
        _id: subjectId,
        subjectName: subject.subjectName,
        classCode: subject.classCode,
      },
      totalSessions,
      recap,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
