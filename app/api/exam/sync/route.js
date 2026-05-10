import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import redis, { buildExamCacheKey } from '@/lib/redis';

const CACHE_TTL_SECONDS = 7200;

export async function POST(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { examId, sessionId, answers, violationCount } = await request.json();

    if (!examId || !ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'examId tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    if (!userDoc?.studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    if (sessionId && !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    if (sessionId) {
      const session = await db.collection('examSessions').findOne({
        _id: new ObjectId(sessionId),
        examId: examId.toString(),
        studentId: userDoc.studentId,
        status: { $in: ['in-progress'] },
      });
      if (!session) {
        return NextResponse.json({ error: 'Sesi ujian tidak valid atau sudah berakhir.' }, { status: 400 });
      }
    }

    const safePayload = {
      answers: answers || { multipleChoice: [], essay: [] },
      violationCount: Number.isFinite(violationCount) ? violationCount : 0,
      sessionId: sessionId || null,
      syncedAt: new Date().toISOString(),
    };

    const key = buildExamCacheKey(examId, userDoc.studentId);
    await redis.set(key, JSON.stringify(safePayload), { ex: CACHE_TTL_SECONDS });

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
