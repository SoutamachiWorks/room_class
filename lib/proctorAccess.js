import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function canAccessProctorExam({ userId, role }, examId) {
  const db = await getDb();

  if (!ObjectId.isValid(examId)) {
    return { allowed: false, reason: 'ID ujian tidak valid' };
  }

  const exam = await db.collection('exams').findOne(
    { _id: new ObjectId(examId) },
    { projection: { title: 1, teacherId: 1, proctorId: 1, isExamOpen: 1, status: 1 } }
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
    { projection: { teacherId: 1, isProctor: 1 } }
  );

  const isOwnerTeacher = exam.teacherId && teacher?.teacherId && exam.teacherId === teacher.teacherId;
  const isAssignedProctor = teacher?.isProctor && exam.proctorId === String(userId);

  if (!isOwnerTeacher && !isAssignedProctor) {
    return { allowed: false, reason: 'Anda bukan guru pemilik atau pengawas yang ditugaskan untuk ujian ini' };
  }

  return { allowed: true, exam };
}
