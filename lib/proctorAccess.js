import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function canAccessProctorExam({ userId, role }, examId) {
  const db = await getDb();

  if (!ObjectId.isValid(examId)) {
    return { allowed: false, reason: 'ID ujian tidak valid' };
  }

  const exam = await db.collection('exams').findOne(
    { _id: new ObjectId(examId) },
    { projection: { title: 1, proctorId: 1, isExamOpen: 1, status: 1 } }
  );

  if (!exam) {
    return { allowed: false, reason: 'Ujian tidak ditemukan' };
  }

  if (role === 'admin') {
    return { allowed: true, exam };
  }

  if (role !== 'teacher') {
    return { allowed: false, reason: 'Akses ditolak' };
  }

  const teacher = await db.collection('users').findOne(
    { _id: new ObjectId(userId), role: 'teacher' },
    { projection: { isProctor: 1 } }
  );

  if (!teacher?.isProctor) {
    return { allowed: false, reason: 'Akses pengawas ujian ditolak' };
  }

  const isAssigned = exam.proctorId === String(userId);
  if (!isAssigned) {
    return { allowed: false, reason: 'Anda tidak ditugaskan untuk ujian ini' };
  }

  return { allowed: true, exam };
}
