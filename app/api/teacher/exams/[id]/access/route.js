import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * PATCH /api/teacher/exams/[id]/access
 * Toggle exam entry access while keeping publication status unchanged.
 */
export async function PATCH(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { id: examId } = await params;

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId), teacherId });
    if (!exam) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    const { isExamOpen } = await request.json();
    if (typeof isExamOpen !== 'boolean') {
      return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
    }

    await db.collection('exams').updateOne(
      { _id: new ObjectId(examId) },
      { $set: { isExamOpen, updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      isExamOpen,
      message: isExamOpen
        ? 'Akses ujian dibuka kembali.'
        : 'Akses ujian ditutup. Siswa tidak dapat masuk sampai dibuka lagi.',
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

