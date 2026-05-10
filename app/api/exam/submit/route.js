import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import redis, { buildExamCacheKey } from '@/lib/redis';

export async function POST(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { examId, studentId } = await request.json();

    if (!examId || !ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'examId tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    if (!userDoc?.studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    if (studentId && studentId !== userDoc.studentId) {
      return NextResponse.json({ error: 'studentId tidak sesuai akun aktif.' }, { status: 403 });
    }

    const key = buildExamCacheKey(examId, userDoc.studentId);
    const raw = await redis.get(key);
    await redis.del(key);

    if (!raw) {
      return NextResponse.json({ error: 'No cached data found' }, { status: 404 });
    }

    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return NextResponse.json({ error: 'Cache payload tidak valid' }, { status: 422 });
    }

    return NextResponse.json({
      answers: parsed.answers || { multipleChoice: [], essay: [] },
      violationCount: Number(parsed.violationCount || 0),
      sessionId: parsed.sessionId || null,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
