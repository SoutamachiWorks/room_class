import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/teacher/attendance
 * Returns all attendance sessions for this teacher, optionally filtered by subjectId.
 * Query: ?subjectId=xxx&date=YYYY-MM-DD
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
    const dateStr = searchParams.get('date');

    const match = { teacherId };
    if (subjectId) match.subjectId = subjectId;
    if (dateStr) {
      const start = new Date(dateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setHours(23, 59, 59, 999);
      match.date = { $gte: start, $lte: end };
    }

    const sessions = await db.collection('attendanceSessions')
      .find(match)
      .sort({ openedAt: -1 })
      .toArray();

    // Enrich with subject info and attendance counts
    const enriched = await Promise.all(sessions.map(async (session) => {
      let subjectName = '';
      if (session.subjectId && ObjectId.isValid(session.subjectId)) {
        const subject = await db.collection('subjects').findOne(
          { _id: new ObjectId(session.subjectId) },
          { projection: { subjectName: 1 } }
        );
        subjectName = subject?.subjectName || '';
      }

      const hadirCount = await db.collection('attendances').countDocuments({
        sessionId: session._id.toString(),
        status: 'hadir',
      });
      const totalCount = await db.collection('attendances').countDocuments({
        sessionId: session._id.toString(),
      });

      // Auto-close expired sessions in GET response
      const now = new Date();
      const closedAt = new Date(session.openedAt.getTime() + session.durationMinutes * 60 * 1000);
      if (session.status === 'open' && now > closedAt) {
        await db.collection('attendanceSessions').updateOne(
          { _id: session._id },
          { $set: { status: 'closed', closedAt } }
        );
        session.status = 'closed';
        session.closedAt = closedAt;
      }

      return {
        ...session,
        _id: session._id.toString(),
        subjectName,
        hadirCount,
        totalCount,
        expiresAt: closedAt.toISOString(),
      };
    }));

    // Get all subjects taught by this teacher for the filter dropdown
    const subjects = await db.collection('subjects').find({ teacherId }).toArray();

    return NextResponse.json({ sessions: enriched, subjects });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * POST /api/teacher/attendance
 * Opens a new attendance session.
 * Body: { subjectId, durationMinutes }
 */
export async function POST(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const body = await request.json();
    const { subjectId, durationMinutes = 15 } = body;

    if (!subjectId) return NextResponse.json({ error: 'subjectId wajib diisi.' }, { status: 400 });
    if (!ObjectId.isValid(subjectId)) return NextResponse.json({ error: 'subjectId tidak valid.' }, { status: 400 });

    // Verify subject ownership
    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId), teacherId });
    if (!subject) return NextResponse.json({ error: 'Mata pelajaran tidak valid untuk akun Anda.' }, { status: 403 });

    // Check if there's already an open session for this subject today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingOpen = await db.collection('attendanceSessions').findOne({
      teacherId,
      subjectId,
      status: 'open',
      openedAt: { $gte: today, $lt: tomorrow },
    });
    if (existingOpen) {
      return NextResponse.json({ error: 'Sudah ada sesi absensi yang sedang berjalan untuk mata pelajaran ini hari ini.' }, { status: 409 });
    }

    const now = new Date();
    const newSession = {
      teacherId,
      subjectId,
      classCode: subject.classCode,
      date: now,
      openedAt: now,
      closedAt: null,
      durationMinutes: Math.max(1, Math.min(120, parseInt(durationMinutes))),
      status: 'open',
      createdAt: now,
    };

    const result = await db.collection('attendanceSessions').insertOne(newSession);

    return NextResponse.json({ success: true, sessionId: result.insertedId.toString() }, { status: 201 });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
