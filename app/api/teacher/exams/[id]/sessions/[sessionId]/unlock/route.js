import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * PATCH /api/teacher/exams/[id]/sessions/[sessionId]/unlock
 * Unlocks a locked session (resets violation count).
 * 
 * DELETE /api/teacher/exams/[id]/sessions/[sessionId]/unlock
 * Completely deletes the student's exam session (Total Reset).
 */

async function verifyOwnership(request, examId, sessionId) {
  const teacher = await requireRole(request, 'teacher');
  const db = await getDb();

  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
  const teacherId = userDoc?.teacherId;
  
  if (!teacherId) throw new Error('Identifikasi guru gagal');

  if (!ObjectId.isValid(examId) || !ObjectId.isValid(sessionId)) {
    throw new Error('ID tidak valid');
  }

  const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
  if (!exam) throw new Error('Ujian tidak ditemukan');

  const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
  if (!subject || subject.teacherId !== teacherId) {
    throw new Error('Anda tidak memiliki izin');
  }

  return { db, teacher };
}

export async function PATCH(request, { params }) {
  try {
    const { id: examId, sessionId } = await params;
    const { db } = await verifyOwnership(request, examId, sessionId);

    const result = await db.collection('examSessions').updateOne(
      { _id: new ObjectId(sessionId), examId: examId.toString(), status: { $ne: 'disqualified' } },
      {
        $set: { status: 'in-progress', exitCount: 0 },
        $unset: {
          manualLockedAt: '',
          manualLockedBy: '',
          manualLockReason: '',
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Kunci sesi berhasil dibuka.' });
  } catch (err) {
    if (err.message === 'ID tidak valid' || err.message.includes('izin') || err.message.includes('ditemukan')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id: examId, sessionId } = await params;
    const { db } = await verifyOwnership(request, examId, sessionId);

    // Optional: we should also delete linked files if any exist in the session answers.
    // For now we just delete the session document.
    const result = await db.collection('examSessions').deleteOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString()
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Data ujian siswa direset total.' });
  } catch (err) {
    if (err.message === 'ID tidak valid' || err.message.includes('izin') || err.message.includes('ditemukan')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
