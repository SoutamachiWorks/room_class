import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { canAccessProctorExam } from '@/lib/proctorAccess';
import redis from '@/lib/redis';

export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await requireRole(request as any, ['admin', 'teacher']);
    const { examId } = await params;
    const access = await canAccessProctorExam({ userId: user.userId, role: user.role }, examId);

    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === 'Ujian tidak ditemukan' ? 404 : 403 });
    }

    const body = await request.json();
    const studentId = String(body?.studentId || '').trim();
    const reason = String(body?.reason || 'Pelanggaran tata tertib ujian').trim();

    if (!studentId) {
      return NextResponse.json({ error: 'studentId wajib diisi' }, { status: 400 });
    }

    const db = await getDb();
    const cacheKey = `exam:${examId}:student:${studentId}`;
    const warningKey = `exam:${examId}:student:${studentId}:warning`;
    await Promise.all([redis.del(cacheKey), redis.del(warningKey)]);

    const disqualifiedAt = new Date();
    await db.collection('examSessions').updateMany(
      { examId: examId.toString(), studentId, status: { $in: ['in-progress'] } },
      {
        $set: {
          status: 'locked',
          disqualifiedAt,
          disqualifiedBy: user.userId,
          disqualifyReason: reason,
        },
      }
    );

    await db.collection('examDisqualifications').updateOne(
      { examId: examId.toString(), studentId },
      {
        $setOnInsert: {
          examId: examId.toString(),
          studentId,
          createdAt: disqualifiedAt,
        },
        $set: {
          reason,
          disqualifiedAt,
          disqualifiedBy: user.userId,
          updatedAt: disqualifiedAt,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
