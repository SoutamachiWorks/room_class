import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { createNotificationsForClass } from '@/lib/notification';

const ALLOWED_ACTION = new Set(['approve', 'revision']);

export async function PATCH(request, { params }) {
  try {
    await requireRole(request, 'curriculum');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID bank soal tidak valid.' }, { status: 400 });
    }

    const body = await request.json();
    const action = body?.action;
    const revisionNote = (body?.revisionNote || '').trim();

    if (!ALLOWED_ACTION.has(action)) {
      return NextResponse.json({ error: 'Aksi validasi tidak valid.' }, { status: 400 });
    }

    const exam = await db.collection('exams').findOne({ _id: new ObjectId(id) });
    if (!exam) {
      return NextResponse.json({ error: 'Bank soal tidak ditemukan.' }, { status: 404 });
    }

    const requiresCurriculumApproval = exam.requiresCurriculumApproval === true;

    if (!requiresCurriculumApproval && action === 'approve') {
      return NextResponse.json({ error: 'Ulangan biasa tidak memerlukan approval kurikulum.' }, { status: 400 });
    }

    if (action === 'revision' && !revisionNote) {
      return NextResponse.json({ error: 'Catatan revisi wajib diisi saat mengirim balik soal.' }, { status: 400 });
    }

    if (action === 'approve') {
      await db.collection('exams').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            validationStatus: 'Approved',
            revisionRequired: false,
            revisionNote: null,
            status: 'published',
            isExamOpen: false,
            validationUpdatedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
      if (subject?.classCode) {
        await createNotificationsForClass(db, subject.classCode, {
          title: 'Ujian Baru',
          message: `Ujian "${exam.title}" telah disetujui kurikulum dan dipublikasikan.`,
          type: 'info',
          actionUrl: '/dashboard/student/exams',
        });
      }

      return NextResponse.json({ success: true, status: 'Approved', autoPublished: true });
    }

    await db.collection('exams').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          validationStatus: 'NeedsRevision',
          revisionRequired: true,
          revisionNote,
          status: 'draft',
          isExamOpen: false,
          validationUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true, status: 'NeedsRevision' });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
