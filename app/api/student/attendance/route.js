import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/student/attendance
 * Returns:
 *  - activeSession: the currently open attendance session for the student's class (if any)
 *  - history: the student's own attendance records
 */
export async function GET(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const yearId = searchParams.get('yearId');

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const enrolledYears = Array.isArray(userDoc?.enrolledYears) ? userDoc.enrolledYears : [];

    let classCode = userDoc?.classCode;
    if (yearId && enrolledYears.length > 0) {
      const targetYear = enrolledYears.find((y) => y?.yearId === yearId);
      if (targetYear?.classCode) {
        classCode = targetYear.classCode;
      }
    }

    const isArchiveMode = !!yearId && classCode !== userDoc?.classCode;

    if (!studentId || !classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const now = new Date();

    // 1. Find an active open session for this student's class
    const openSessions = isArchiveMode
      ? []
      : await db.collection('attendanceSessions')
          .find({ classCode, status: 'open' })
          .toArray();

    let activeSession = null;
    for (const session of openSessions) {
      const expiresAt = new Date(session.openedAt.getTime() + session.durationMinutes * 60 * 1000);

      if (now > expiresAt) {
        // This session has expired — auto-close it
        await db.collection('attendanceSessions').updateOne(
          { _id: session._id },
          { $set: { status: 'closed', closedAt: expiresAt } }
        );
        continue;
      }

      // Check if student already checked in
      const myRecord = await db.collection('attendances').findOne({
        sessionId: session._id.toString(),
        studentId,
      });

      // Get subject name
      let subjectName = '';
      if (ObjectId.isValid(session.subjectId)) {
        const subject = await db.collection('subjects').findOne({ _id: new ObjectId(session.subjectId) });
        subjectName = subject?.subjectName || '';
      }

      activeSession = {
        sessionId: session._id.toString(),
        subjectId: session.subjectId,
        subjectName,
        classCode: session.classCode,
        openedAt: session.openedAt,
        expiresAt: expiresAt.toISOString(),
        durationMinutes: session.durationMinutes,
        alreadyCheckedIn: !!myRecord,
        myStatus: myRecord?.status || null,
      };
      break; // Only show one active session at a time
    }

    // 2. Get student's own attendance history
    const history = await db.collection('attendances')
      .find({ studentId, classCode })
      .sort({ date: -1 })
      .limit(50)
      .toArray();

    // Enrich with subject names
    const enrichedHistory = await Promise.all(history.map(async (record) => {
      let subjectName = '';
      if (record.subjectId && ObjectId.isValid(record.subjectId)) {
        const subject = await db.collection('subjects').findOne(
          { _id: new ObjectId(record.subjectId) },
          { projection: { subjectName: 1 } }
        );
        subjectName = subject?.subjectName || '';
      }
      return {
        ...record,
        _id: record._id.toString(),
        subjectName,
      };
    }));

    // 3. Attendance summary stats
    const allRecords = await db.collection('attendances').find({ studentId, classCode }).toArray();
    const stats = {
      hadir: allRecords.filter(r => r.status === 'hadir').length,
      sakit: allRecords.filter(r => r.status === 'sakit').length,
      izin:  allRecords.filter(r => r.status === 'izin').length,
      alpha: allRecords.filter(r => r.status === 'alpha').length,
    };

    return NextResponse.json({ activeSession, history: enrichedHistory, stats, enrolledYears });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
