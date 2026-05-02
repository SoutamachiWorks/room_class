import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { createNotification } from '@/lib/notification';

/**
 * PUT /api/teacher/exams/[id]/sessions/[sessionId]/grade
 * Grade the student's exam.
 * 
 * Body: { scores: [{ questionOrder: 1, score: 80 }, ...] }
 */
export async function PUT(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { id: examId, sessionId } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    if (!ObjectId.isValid(examId) || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const { scores } = await request.json();
    if (!Array.isArray(scores)) {
      return NextResponse.json({ error: 'Format nilai tidak valid.' }, { status: 400 });
    }

    const subjectCheck = await db.collection('exams').aggregate([
      { $match: { _id: new ObjectId(examId) } },
      { $addFields: { subjectObjectId: { $toObjectId: '$subjectId' } } },
      { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'sub' } }
    ]).toArray();

    if (!subjectCheck.length || !subjectCheck[0].sub.length || subjectCheck[0].sub[0].teacherId !== teacherId) {
      return NextResponse.json({ error: 'Anda tidak memiliki hak akses' }, { status: 403 });
    }

    const session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString()
    });

    if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });

    // Update scores in answers array
    const updatedAnswers = session.answers.map(ans => {
      const scoreInput = scores.find(s => s.questionOrder === ans.questionOrder);
      if (scoreInput !== undefined) {
        return { ...ans, score: Number(scoreInput.score) };
      }
      return ans;
    });

    await db.collection('examSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          answers: updatedAnswers,
          gradingStatus: 'fully-graded',
          updatedAt: new Date()
        }
      }
    );

    // Notifikasi ke siswa
    const studentUser = await db.collection('users').findOne({ role: 'student', studentId: session.studentId });
    if (studentUser) {
      await createNotification(db, {
        userId: studentUser._id,
        title: 'Nilai Ujian',
        message: `Ujian "${subjectCheck[0].title}" telah dikoreksi oleh guru.`,
        type: 'success',
        actionUrl: `/dashboard/student/exams`
      });
    }

    return NextResponse.json({ success: true, message: 'Penilaian berhasil disimpan.' });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
