import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

function getClassCodes(source) {
  return Array.isArray(source?.classCodes) && source.classCodes.length
    ? source.classCodes
    : [source?.classCode].filter(Boolean);
}

/**
 * POST /api/student/attendance/check-in
 * Marks the student as present for the given session.
 * Body: { sessionId }
 * 
 * Security measures:
 *  1. Server-side time validation: Date.now() < session.openedAt + durationMinutes (NOT relying on client)
 *  2. Duplicate prevention: one check-in per studentId per session
 *  3. Device info logging: userAgent + IP recorded
 */
export async function POST(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const classCode = userDoc?.classCode;

    if (!studentId || !classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    // Fetch the session
    const session = await db.collection('attendanceSessions').findOne({ _id: new ObjectId(sessionId) });
    if (!session) {
      return NextResponse.json({ error: 'Sesi absensi tidak ditemukan.' }, { status: 404 });
    }

    // Verify student's class matches session's class
    if (!getClassCodes(session).includes(classCode)) {
      return NextResponse.json({ error: 'Anda tidak terdaftar di kelas ini.' }, { status: 403 });
    }

    // ── SECURITY: Server-side time validation ──────────────────────────────
    // This cannot be bypassed by tools like Postman since check is on the server
    const now = new Date();
    const expiresAt = new Date(session.openedAt.getTime() + session.durationMinutes * 60 * 1000);

    if (session.status === 'closed' || now > expiresAt) {
      // Auto-close the session if still "open" in DB
      if (session.status === 'open') {
        await db.collection('attendanceSessions').updateOne(
          { _id: new ObjectId(sessionId) },
          { $set: { status: 'closed', closedAt: expiresAt } }
        );
      }
      return NextResponse.json({ error: 'Waktu absensi sudah berakhir. Anda tidak dapat melakukan check-in.' }, { status: 410 });
    }
    // ── END SECURITY ───────────────────────────────────────────────────────

    // Duplicate prevention: one check-in per studentId per session
    const existing = await db.collection('attendances').findOne({
      sessionId: sessionId.toString(),
      studentId,
    });
    if (existing) {
      return NextResponse.json({ error: 'Anda sudah melakukan absensi untuk sesi ini.', alreadyCheckedIn: true }, { status: 409 });
    }

    // Capture device info for anti-titip absen logging
    const userAgent = request.headers.get('user-agent') || '';
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';

    // Record attendance
    await db.collection('attendances').insertOne({
      sessionId: sessionId.toString(),
      studentId,
      subjectId: session.subjectId,
      classCode,
      date: session.date,
      status: 'hadir',
      note: '',
      checkedInAt: now,
      isManual: false,
      deviceInfo: { userAgent, ip },
      createdAt: now,
    });

    return NextResponse.json({ success: true, message: 'Absensi berhasil dicatat. Selamat!' });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
