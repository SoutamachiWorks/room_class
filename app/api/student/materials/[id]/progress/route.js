import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID materi tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const classCode = userDoc?.classCode;

    if (!studentId || !classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const material = await db.collection('materials').findOne({ _id: new ObjectId(id) });
    if (!material || !ObjectId.isValid(material.subjectId)) {
      return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 });
    }

    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(material.subjectId) });
    const classCodes = Array.isArray(subject?.classCodes) && subject.classCodes.length
      ? subject.classCodes
      : [subject?.classCode].filter(Boolean);

    if (!subject || !classCodes.includes(classCode)) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke materi ini.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const existing = await db.collection('materialProgress').findOne({ materialId: id.toString(), studentId });
    const isViewEvent = body.status === 'viewed';
    const completed = isViewEvent ? !!existing?.completed : body.completed !== false;
    const now = new Date();
    const viewedAt = existing?.viewedAt || now;
    const status = completed ? 'completed' : 'in-progress';

    await db.collection('materialProgress').updateOne(
      { materialId: id.toString(), studentId },
      {
        $set: {
          materialId: id.toString(),
          studentId,
          classCode,
          status,
          viewedAt,
          completed,
          updatedAt: now,
          ...(completed ? { completedAt: now } : { completedAt: null }),
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, status, completed, viewedAt });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
