import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { deleteFromR2 } from '@/lib/s3Client';

/**
 * GET /api/teacher/exams/[id]
 * Retrieves a single exam by ID for the edit form.
 */
export async function GET(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const { id } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(id), teacherId });

    if (!exam) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ exam });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * PUT /api/teacher/exams/[id]
 * Updates an exam — only allowed if status is 'draft'.
 */
export async function PUT(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const { id } = await params;

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    // Verify exam exists and belongs to this teacher
    const existing = await db.collection('exams').findOne({ _id: new ObjectId(id), teacherId });
    if (!existing) {
      return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Ujian yang sudah dipublikasi tidak dapat diedit. Tarik publikasi terlebih dahulu.' }, { status: 400 });
    }

    const body = await request.json();
    const { title, questions, isRandomized, duration, deadline } = body;

    if (!title) {
      return NextResponse.json({ error: 'Judul ujian wajib diisi.' }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Ujian harus memiliki minimal 1 soal.' }, { status: 400 });
    }

    // Validate each question block
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const hasType = q.multipleChoice || q.essay || q.fileUpload;
      if (!hasType) {
        return NextResponse.json({ error: `Soal #${i + 1} harus memiliki minimal 1 tipe soal aktif.` }, { status: 400 });
      }
      if (q.multipleChoice) {
        if (!q.multipleChoice.questionText) {
          return NextResponse.json({ error: `Soal #${i + 1}: Teks soal pilihan ganda wajib diisi.` }, { status: 400 });
        }
        if (!q.multipleChoice.options || q.multipleChoice.options.length < 2) {
          return NextResponse.json({ error: `Soal #${i + 1}: Pilihan ganda harus memiliki minimal 2 opsi.` }, { status: 400 });
        }
        if (q.multipleChoice.correctAnswer === undefined || q.multipleChoice.correctAnswer === null) {
          return NextResponse.json({ error: `Soal #${i + 1}: Jawaban benar pilihan ganda harus dipilih.` }, { status: 400 });
        }
      }
      if (q.essay && !q.essay.questionText) {
        return NextResponse.json({ error: `Soal #${i + 1}: Teks soal esai wajib diisi.` }, { status: 400 });
      }
      if (q.fileUpload && !q.fileUpload.questionText) {
        return NextResponse.json({ error: `Soal #${i + 1}: Teks soal file upload wajib diisi.` }, { status: 400 });
      }
    }

    const normalizedQuestions = questions.map((q, idx) => ({
      order: idx + 1,
      multipleChoice: q.multipleChoice || null,
      essay: q.essay || null,
      fileUpload: q.fileUpload || null,
    }));

    await db.collection('exams').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          questions: normalizedQuestions,
          isRandomized: !!isRandomized,
          duration: duration ? parseInt(duration, 10) : null,
          deadline: deadline ? new Date(deadline) : null,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Exam update error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * DELETE /api/teacher/exams/[id]
 * Deletes an exam and all associated examSessions (cascade).
 */
export async function DELETE(request, { params }) {
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

    // Cascade: fetch all sessions to properly trash physical cloud files
    const sessions = await db.collection('examSessions').find({ examId: id }).toArray();
    for (const session of sessions) {
       if (session.answers && Array.isArray(session.answers)) {
          for (const ans of session.answers) {
             if (ans.uploadedFiles && Array.isArray(ans.uploadedFiles)) {
                for (const file of ans.uploadedFiles) {
                   if (file.fileKey) {
                      await deleteFromR2(file.fileKey);
                   }
                }
             }
          }
       }
    }

    // Drop the collection relational footprints natively
    if (sessions.length > 0) {
       await db.collection('examSessions').deleteMany({ examId: id });
    }

    // Delete the exam itself
    await db.collection('exams').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true, message: 'Ujian dan seluruh sesi terkait telah dihapus.' });
  } catch (err) {
    console.error('Exam deletion error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
