import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const [exams, proctorTeachers] = await Promise.all([
      db
        .collection('exams')
        .find({}, { projection: { title: 1, subjectId: 1, proctorId: 1, status: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray(),
      db
        .collection('users')
        .find({ role: 'teacher', isProctor: true }, { projection: { fullName: 1, teacherId: 1 } })
        .sort({ fullName: 1 })
        .toArray(),
    ]);

    const subjectIds = exams
      .map((exam) => exam.subjectId)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    const proctorIds = exams
      .map((exam) => exam.proctorId)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const [subjects, assignedProctors] = await Promise.all([
      subjectIds.length
        ? db
            .collection('subjects')
            .find({ _id: { $in: subjectIds } }, { projection: { subjectName: 1, classCode: 1 } })
            .toArray()
        : [],
      proctorIds.length
        ? db
            .collection('users')
            .find({ _id: { $in: proctorIds } }, { projection: { fullName: 1, teacherId: 1 } })
            .toArray()
        : [],
    ]);

    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));
    const proctorMap = new Map(assignedProctors.map((p) => [p._id.toString(), p]));

    return NextResponse.json({
      proctorTeachers: proctorTeachers.map((t) => ({
        userId: t._id.toString(),
        fullName: t.fullName || '-',
        teacherId: t.teacherId || '-',
      })),
      exams: exams.map((exam) => {
        const subject = subjectMap.get(String(exam.subjectId));
        const proctor = exam.proctorId ? proctorMap.get(String(exam.proctorId)) : null;
        return {
          id: exam._id.toString(),
          title: exam.title || 'Tanpa Judul',
          status: exam.status || '-',
          subjectName: subject?.subjectName || '-',
          classCode: subject?.classCode || '-',
          proctorId: exam.proctorId || null,
          proctorName: proctor?.fullName || null,
          proctorTeacherId: proctor?.teacherId || null,
        };
      }),
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
