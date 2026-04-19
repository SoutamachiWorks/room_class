import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * Helper: auto-alpha all students who haven't checked in for this session.
 * Called when a session is closed.
 */
async function autoAlphaAbsentStudents(db, session) {
  const classCode = session.classCode;
  const sessionId = session._id.toString();

  // Get all enrolled students in this class
  const students = await db.collection('users')
    .find({ role: 'student', classCode })
    .project({ studentId: 1, fullName: 1 })
    .toArray();

  if (students.length === 0) return;

  // Get existing attendance records for this session
  const existing = await db.collection('attendances')
    .find({ sessionId })
    .project({ studentId: 1 })
    .toArray();
  const existingSet = new Set(existing.map(a => a.studentId));

  // Build alpha records for students who never checked in
  const alphaRecords = students
    .filter(s => !existingSet.has(s.studentId))
    .map(s => ({
      sessionId,
      studentId: s.studentId,
      subjectId: session.subjectId,
      classCode,
      date: session.date,
      status: 'alpha',
      note: 'Tidak hadir (otomatis)',
      checkedInAt: null,
      isManual: false,
      deviceInfo: null,
      createdAt: new Date(),
    }));

  if (alphaRecords.length > 0) {
    await db.collection('attendances').insertMany(alphaRecords);
  }
}

/**
 * GET /api/teacher/attendance/[sessionId]
 * Returns session detail + full student list with their attendance status.
 */
export async function GET(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { sessionId } = await params;

    if (!ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'Session ID tidak valid' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const session = await db.collection('attendanceSessions').findOne({ _id: new ObjectId(sessionId) });
    if (!session || session.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
    }

    // Auto-close if time expired
    const now = new Date();
    const expiresAt = new Date(session.openedAt.getTime() + session.durationMinutes * 60 * 1000);
    if (session.status === 'open' && now > expiresAt) {
      await db.collection('attendanceSessions').updateOne(
        { _id: session._id },
        { $set: { status: 'closed', closedAt: expiresAt } }
      );
      session.status = 'closed';
      session.closedAt = expiresAt;
      await autoAlphaAbsentStudents(db, session);
    }

    // Get subject info
    let subjectName = '';
    if (ObjectId.isValid(session.subjectId)) {
      const subject = await db.collection('subjects').findOne({ _id: new ObjectId(session.subjectId) });
      subjectName = subject?.subjectName || '';
    }

    // Get all students in the class
    const students = await db.collection('users')
      .find({ role: 'student', classCode: session.classCode })
      .project({ studentId: 1, fullName: 1, classCode: 1 })
      .sort({ fullName: 1 })
      .toArray();

    // Get attendance records for this session
    const attendances = await db.collection('attendances')
      .find({ sessionId: sessionId.toString() })
      .toArray();
    const attendanceMap = {};
    for (const a of attendances) attendanceMap[a.studentId] = a;

    // Merge students with their attendance
    const studentList = students.map(s => ({
      studentId: s.studentId,
      fullName: s.fullName,
      classCode: s.classCode,
      attendance: attendanceMap[s.studentId]
        ? { ...attendanceMap[s.studentId], _id: attendanceMap[s.studentId]._id.toString() }
        : null,
    }));

    return NextResponse.json({
      session: {
        ...session,
        _id: session._id.toString(),
        subjectName,
        expiresAt: expiresAt.toISOString(),
      },
      students: studentList,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * PATCH /api/teacher/attendance/[sessionId]
 * Closes the session manually and auto-alphas absent students.
 */
export async function PATCH(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { sessionId } = await params;

    if (!ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'Session ID tidak valid' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const session = await db.collection('attendanceSessions').findOne({ _id: new ObjectId(sessionId) });
    if (!session || session.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
    }
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'Sesi sudah ditutup sebelumnya.' }, { status: 409 });
    }

    const now = new Date();
    await db.collection('attendanceSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: { status: 'closed', closedAt: now } }
    );

    session.status = 'closed';
    session.closedAt = now;

    // Auto-alpha all absent students
    await autoAlphaAbsentStudents(db, session);

    return NextResponse.json({ success: true, message: 'Sesi ditutup. Siswa yang absen ditandai Alpha.' });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
