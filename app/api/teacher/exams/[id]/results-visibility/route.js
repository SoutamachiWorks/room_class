import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * PATCH /api/teacher/exams/[id]/results-visibility
 * Toggle the showResults boolean for an exam.
 */
export async function PATCH(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { id: examId } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    const { showResults } = await request.json();
    if (typeof showResults !== 'boolean') {
      return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
    }

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });

    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
    if (!subject || subject.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Anda tidak memiliki hak akses.' }, { status: 403 });
    }

    await db.collection('exams').updateOne(
      { _id: new ObjectId(examId) },
      { $set: { showResults } }
    );

    return NextResponse.json({ success: true, showResults });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
