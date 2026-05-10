import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { generatePresignedUrl } from '@/lib/s3Client';

function isExamEnded(exam) {
  if (!exam) return false;
  if (exam.isExamOpen !== true) return true;
  if (exam.deadline && new Date(exam.deadline).getTime() < Date.now()) return true;
  return false;
}

export async function GET(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
    if (!exam) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    if (!exam.showExplanation) {
      return NextResponse.json({ error: 'Fitur evaluasi belum dibuka guru.' }, { status: 403 });
    }

    if (!isExamEnded(exam)) {
      return NextResponse.json({ error: 'Evaluasi baru bisa dilihat setelah ujian berakhir.' }, { status: 403 });
    }

    const session = await db.collection('examSessions').findOne(
      { examId: examId.toString(), studentId },
      { sort: { submittedAt: -1 } }
    );

    if (!session || session.status !== 'submitted') {
      return NextResponse.json({ error: 'Anda belum menyelesaikan ujian ini.' }, { status: 403 });
    }

    const questions = Array.isArray(session.questions) ? session.questions : [];
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const normalized = await Promise.all(questions.map(async (question, index) => {
      const answer = answers.find((item) => Number(item.questionOrder) === index + 1) || null;
      let imageUrl = question?.imageUrl || null;
      if (imageUrl) {
        try {
          imageUrl = await generatePresignedUrl(imageUrl);
        } catch {
          imageUrl = null;
        }
      }

      return {
        questionOrder: index + 1,
        imageUrl,
        multipleChoice: question?.multipleChoice || null,
        essay: question?.essay || null,
        fileUpload: question?.fileUpload || null,
        answer: answer
          ? {
              mcAnswer: answer.mcAnswer ?? null,
              essayAnswer: answer.essayAnswer ?? '',
              score: answer.score ?? null,
            }
          : null,
      };
    }));

    return NextResponse.json({
      exam: {
        _id: exam._id,
        title: exam.title,
        subjectId: exam.subjectId,
        submittedAt: session.submittedAt,
      },
      review: normalized,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
