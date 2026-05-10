import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function GET(request) {
  try {
    const user = await requireRole(request, 'teacher');
    const db = await getDb();
    const teacher = await db.collection('users').findOne({
      _id: new ObjectId(user.userId),
      role: 'teacher',
    });

    if (!teacher?.isProctor) {
      return NextResponse.json({ error: 'Akses pengawas ujian ditolak' }, { status: 403 });
    }

    const exams = await db
      .collection('exams')
      .find(
        { proctorId: user.userId },
        { projection: { title: 1, subjectId: 1, status: 1, createdAt: 1, startTime: 1, endTime: 1 } }
      )
      .sort({ createdAt: -1 })
      .toArray();

    const subjectIds = exams
      .map((exam) => exam.subjectId)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const subjects = subjectIds.length
      ? await db
          .collection('subjects')
          .find({ _id: { $in: subjectIds } }, { projection: { subjectName: 1, classCode: 1 } })
          .toArray()
      : [];

    const subjectMap = new Map(subjects.map((subject) => [subject._id.toString(), subject]));

    return NextResponse.json({
      sessions: exams.map((exam) => {
        const subject = subjectMap.get(String(exam.subjectId));
        return {
          id: exam._id.toString(),
          title: exam.title || 'Tanpa Judul',
          scheduledAt: exam.createdAt || null,
          status: exam.status || 'draft',
          subjectName: subject?.subjectName || '-',
          classCode: subject?.classCode || '-',
        };
      }),
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
