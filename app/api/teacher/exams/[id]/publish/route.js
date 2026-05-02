import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { createNotificationsForClass } from '@/lib/notification';

/**
 * PUT /api/teacher/exams/[id]/publish
 * Toggles exam status between 'draft' and 'published'.
 */
export async function PUT(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const { id } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const existing = await db.collection('exams').findOne({ _id: new ObjectId(id), teacherId });
    if (!existing) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    const newStatus = existing.status === 'published' ? 'draft' : 'published';

    await db.collection('exams').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
        },
      }
    );

    // Kirim notifikasi jika statusnya adalah 'published'
    if (newStatus === 'published') {
      const subject = await db.collection('subjects').findOne({ _id: new ObjectId(existing.subjectId) });
      if (subject && subject.classCode) {
        await createNotificationsForClass(db, subject.classCode, {
          title: 'Ujian Baru',
          message: `Ujian "${existing.title}" telah dipublikasikan pada mata pelajaran ${subject.name}.`,
          type: 'info',
          actionUrl: `/dashboard/student/exams`
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: newStatus === 'published' ? 'Ujian berhasil dipublikasi.' : 'Ujian ditarik ke mode draft.',
    });
  } catch (err) {
    console.error('Exam publish toggle error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
