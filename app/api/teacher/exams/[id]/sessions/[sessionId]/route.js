import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

import { generatePresignedUrl } from '@/lib/s3Client';

/**
 * GET /api/teacher/exams/[id]/sessions/[sessionId]
 * Fetch the details of a student's submitted exam to review/grade.
 */
export async function GET(request, { params }) {
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

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return NextResponse.json({ error: 'Ujian tidak ditemukan' }, { status: 404 });

    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
    if (!subject || subject.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Anda tidak memiliki hak akses' }, { status: 403 });
    }

    const session = await db.collection('examSessions').findOne({ 
      _id: new ObjectId(sessionId), 
      examId: examId.toString() 
    });

    if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });

    const student = await db.collection('users').findOne({ studentId: session.studentId });

    // Merging questions with answers & singing files
    const reviewData = await Promise.all(session.answers.map(async (ans) => {
      const originalQuestion = exam.questions.find(q => q.order === ans.originalOrder);
      
      if (ans.uploadedFiles && ans.uploadedFiles.length > 0) {
         ans.uploadedFiles = await Promise.all(ans.uploadedFiles.map(async (f) => ({
             ...f,
             url: await generatePresignedUrl(f.fileKey)
         })));
      }

      return {
        ...ans,
        questionDetails: originalQuestion || null
      };
    }));

    return NextResponse.json({
      session: {
        ...session,
        answers: reviewData,
        studentName: student?.fullName || 'Anonim',
        classCode: student?.classCode || '-'
      },
      examTitle: exam.title
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
