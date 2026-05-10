import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/auth';
import { canAccessProctorExam } from '@/lib/proctorAccess';
import redis from '@/lib/redis';

const WARNING_TTL_SECONDS = 30;

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
    const message = String(body?.message || 'Fokus pada ujian Anda. Terdeteksi aktivitas mencurigakan.').trim();

    if (!studentId) {
      return NextResponse.json({ error: 'studentId wajib diisi' }, { status: 400 });
    }

    const warningKey = `exam:${examId}:student:${studentId}:warning`;
    await redis.set(
      warningKey,
      JSON.stringify({
        message,
        sentAt: new Date().toISOString(),
        from: user.fullName || user.username || 'Proctor',
      }),
      { ex: WARNING_TTL_SECONDS }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
