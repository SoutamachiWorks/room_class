import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { createNotification } from '@/lib/notification';

/**
 * PUT /api/teacher/assignments/[id]/submissions/[studentId]/grade
 * Takes a JSON payload { score: number } and patches it to the respective Submission record safely.
 */
export async function PUT(request, { params }) {
   try {
      const teacher = await requireRole(request, 'teacher');
      const db = await getDb();
      const { id, studentId } = await params;

      if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Referensi Tugas salah' }, { status: 400 });

      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
      const teacherProfileId = userDoc?.teacherId;
      if (!teacherProfileId) return NextResponse.json({ error: 'Anda bukan guru sah' }, { status: 403 });

      // Domain mapping security validation ensuring teacher owns the target assignment explicitly
      const mapping = await db.collection('assignments').findOne({ _id: new ObjectId(id) });
      if (!mapping || mapping.teacherId !== teacherProfileId) {
         return NextResponse.json({ error: 'Otoritas Akses Ditolak' }, { status: 403 });
      }

      const body = await request.json();
      const { score, feedback } = body;

      if (score === undefined || score === null) {
          return NextResponse.json({ error: 'Nilai tidak boleh kosong' }, { status: 400 });
      }

      // Safe update
      const updateResult = await db.collection('submissions').updateOne(
         { 
            assignmentId: id,
            studentId: studentId
         },
         {
            $set: {
               score: Number(score),
               feedback: feedback || '',
               gradedAt: new Date()
            }
         }
      );

      if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
          return NextResponse.json({ error: 'Pengumpulan siswa ini belum ada atau ID pecah.' }, { status: 404 });
      }

      // Notifikasi ke siswa
      const studentUser = await db.collection('users').findOne({ role: 'student', studentId: studentId });
      if (studentUser) {
        const subject = await db.collection('subjects').findOne({ _id: new ObjectId(mapping.subjectId) });
        await createNotification(db, {
          userId: studentUser._id,
          title: 'Nilai Tugas',
          message: `Nilai untuk tugas pada mata pelajaran ${subject?.subjectName || 'terkait'} telah diberikan oleh guru.`,
          type: 'success',
          actionUrl: `/dashboard/student/assignments`
        });
      }

      return NextResponse.json({ success: true });

   } catch (err) {
      console.error('Grading API Critical Fault:', err);
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
   }
}
