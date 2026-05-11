import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import redis, { buildExamCacheKey } from '@/lib/redis';

/**
 * PATCH /api/student/exams/[id]/violation
 * Increments exitCount on the student's active examSession.
 * If exitCount >= 3, sets status to 'locked'.
 *
 * Body: { sessionId }
 */
export async function PATCH(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;

    if (!studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    // Verify session ownership
    const session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString(),
      studentId,
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesi ujian tidak ditemukan.' }, { status: 404 });
    }

    if (session.status !== 'in-progress') {
      return NextResponse.json({ error: 'Sesi ujian sudah tidak aktif.', locked: session.status === 'locked' }, { status: 400 });
    }

    const newExitCount = (session.exitCount || 0) + 1;
    const newStatus = newExitCount >= 3 ? 'locked' : 'in-progress';

    await db.collection('examSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          exitCount: newExitCount,
          status: newStatus,
        },
      }
    );

    if (newStatus === 'locked') {
      try {
        await redis.del(buildExamCacheKey(examId.toString(), studentId));
      } catch (err) {
        console.error('Redis cleanup on lock failed:', err);
      }
    }

    return NextResponse.json({
      exitCount: newExitCount,
      locked: newStatus === 'locked',
    });

  } catch (err) {
    console.error('Violation record error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
