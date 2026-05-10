import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { canAccessProctorExam } from '@/lib/proctorAccess';
import { generatePresignedUrl } from '@/lib/s3Client';

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await requireRole(request as any, ['admin', 'teacher']);
    const { examId } = await params;

    const access = await canAccessProctorExam({ userId: user.userId, role: user.role }, examId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === 'Ujian tidak ditemukan' ? 404 : 403 });
    }

    const db = await getDb();
    const exam = await db.collection('exams').findOne(
      { _id: new ObjectId(examId) },
      { projection: { title: 1, questions: 1, status: 1, createdAt: 1 } }
    );

    if (!exam) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan' }, { status: 404 });
    }

    const questions = await Promise.all(
      (Array.isArray(exam.questions) ? exam.questions : []).map(async (q: any, idx: number) => {
        let previewUrl = null;
        if (q?.imageUrl) {
          try {
            previewUrl = await generatePresignedUrl(q.imageUrl, q.imageUrl);
          } catch {
            previewUrl = null;
          }
        }

        return {
          order: q?.order || idx + 1,
          imageUrl: previewUrl,
          multipleChoice: q?.multipleChoice
            ? {
                questionText: q.multipleChoice.questionText || '',
                options: Array.isArray(q.multipleChoice.options) ? q.multipleChoice.options : [],
              }
            : null,
          essay: q?.essay ? { questionText: q.essay.questionText || '' } : null,
          fileUpload: q?.fileUpload ? { questionText: q.fileUpload.questionText || '' } : null,
        };
      })
    );

    return NextResponse.json({
      exam: {
        id: examId,
        title: exam.title || 'Tanpa Judul',
        status: exam.status || '-',
        createdAt: exam.createdAt || null,
      },
      questions,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
