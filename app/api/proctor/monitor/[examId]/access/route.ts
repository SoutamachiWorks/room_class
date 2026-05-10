import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { canAccessProctorExam } from '@/lib/proctorAccess';

export async function PATCH(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await requireRole(request as any, ['admin', 'teacher']);
    const { examId } = await params;

    const access = await canAccessProctorExam({ userId: user.userId, role: user.role }, examId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === 'Ujian tidak ditemukan' ? 404 : 403 });
    }

    const { isExamOpen } = await request.json();
    if (typeof isExamOpen !== 'boolean') {
      return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
    }

    const db = await getDb();
    await db.collection('exams').updateOne(
      { _id: new ObjectId(examId) },
      { $set: { isExamOpen, updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      isExamOpen,
      message: isExamOpen
        ? 'Ujian dibuka. Siswa sekarang dapat memulai ujian.'
        : 'Ujian ditutup. Siswa tidak dapat memulai ujian sampai dibuka kembali.',
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
