import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2 } from '@/lib/s3Client';
import { createNotification } from '@/lib/notification';

/**
 * POST /api/student/exams/[id]/submit
 * Submits answers for an exam session.
 *
 * Accepts multipart/form-data:
 *   - sessionId (string)
 *   - answers (JSON string): array of answer objects
 *   - file-{questionOrder} (File): uploaded files per question
 */
export async function POST(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;

    if (!studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const formData = await request.formData();
    const sessionId = formData.get('sessionId');
    const answersJSON = formData.get('answers');

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    // Verify session ownership and status
    const session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString(),
      studentId,
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesi ujian tidak ditemukan.' }, { status: 404 });
    }

    if (session.status === 'submitted') {
      return NextResponse.json({ error: 'Jawaban sudah dikumpulkan sebelumnya.' }, { status: 400 });
    }

    if (session.status === 'locked') {
      return NextResponse.json({ error: 'Sesi ujian telah dikunci.', locked: true }, { status: 403 });
    }

    // We need the exam document to auto-grade MCQs
    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });

    // Parse answers
    let answers = [];
    try {
      answers = JSON.parse(answersJSON || '[]');
    } catch (e) {
      return NextResponse.json({ error: 'Format jawaban tidak valid.' }, { status: 400 });
    }

    let hasManualGradingNeeds = false;

    // Process file uploads & auto-grade per question
    for (let i = 0; i < answers.length; i++) {
      const ans = answers[i];
      
      // Auto Grade Logic
      const originalQuestion = exam.questions.find(q => q.order === ans.originalOrder);
      if (originalQuestion) {
        if (originalQuestion.multipleChoice) {
          if (ans.mcAnswer === originalQuestion.multipleChoice.correctAnswer) {
            ans.score = 100;
          } else {
            ans.score = 0;
          }
        }
        if (originalQuestion.essay || originalQuestion.fileUpload) {
          ans.score = null; // Pending review
          hasManualGradingNeeds = true;
        }
      }

      // File upload processing
      const fileKey = `file-${ans.questionOrder}`;
      const files = formData.getAll(fileKey);

      const processedFiles = [];
      for (const file of files) {
        if (file && file.name) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const r2Data = await uploadToR2(buffer, file.name, file.type, 'exam-answers');

          processedFiles.push({
            originalName: r2Data.originalName,
            fileKey: r2Data.fileKey,
            size: r2Data.size,
            type: r2Data.mimeType,
          });
        }
      }

      answers[i].uploadedFiles = processedFiles;
    }

    const gradingStatus = hasManualGradingNeeds ? 'pending-manual' : 'auto-graded';
    const isLockout = formData.get('isLockout') === 'true';

    // Update session
    await db.collection('examSessions').updateOne(
      { _id: new ObjectId(sessionId) },
      {
        $set: {
          answers,
          status: isLockout ? 'locked' : 'submitted',
          gradingStatus,
          submittedAt: new Date(),
        },
      }
    );

    // Notifikasi ke guru
    const teacherUser = await db.collection('users').findOne({ role: 'teacher', teacherId: exam.teacherId });
    if (teacherUser) {
      await createNotification(db, {
        userId: teacherUser._id,
        title: 'Pengumpulan Ujian',
        message: `Siswa ${userDoc.fullName || studentId} telah mengumpulkan ujian "${exam.title}".`,
        type: 'success',
        actionUrl: `/dashboard/teacher/exams/${exam._id}/results` // Ensure this route exists or matches the teacher's dashboard
      });
    }

    return NextResponse.json({ success: true, message: 'Jawaban berhasil dikumpulkan.' });

  } catch (err) {
    console.error('Exam submit error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
