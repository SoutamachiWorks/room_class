import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { generatePresignedUrl } from '@/lib/s3Client';

/**
 * GET /api/teacher/assignments/[id]/submissions
 * Retrieves all students within the assignment's class boundary and maps their distinct submission payload (if any)
 */
export async function GET(request, { params }) {
   try {
      const teacher = await requireRole(request, 'teacher');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID Assignment tidak valid' }, { status: 400 });

      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
      const teacherId = userDoc?.teacherId;
      if (!teacherId) return NextResponse.json({ error: 'Otorisasi profil terbatas' }, { status: 403 });

      const assignment = await db.collection('assignments').findOne({ _id: new ObjectId(id) });
      if (!assignment || assignment.teacherId !== teacherId) {
         return NextResponse.json({ error: 'Assignment tidak ditemukan atau bukan milik Anda' }, { status: 404 });
      }

      const subject = await db.collection('subjects').findOne({ _id: new ObjectId(assignment.subjectId) });
      if (!subject) {
         return NextResponse.json({ error: 'Mata pelajaran korup / hilang' }, { status: 404 });
      }

      // Find all students mapped natively to the mapped classCode
      const classCode = subject.classCode;
      const enrolledStudents = await db.collection('users').find({
         role: 'student',
         classCode: classCode
      }).toArray();

      // Find all submissions bounded to this exact assignment
      const submissions = await db.collection('submissions').find({
         assignmentId: id
      }).toArray();

      // Mapping Submissions natively towards Students Array securely
      const studentMap = await Promise.all(enrolledStudents.map(async (student) => {
         const subInfo = submissions.find(s => s.studentId === student.studentId);
         
         if (subInfo && subInfo.files && subInfo.files.length > 0) {
            subInfo.files = await Promise.all(subInfo.files.map(async (f) => ({
               ...f,
               url: await generatePresignedUrl(f.fileKey, f.originalName)
            })));
         }

         return {
            _id: student._id.toString(),
            studentId: student.studentId,
            name: student.fullName,
            classCode: student.classCode,
            submission: subInfo ? {
               ...subInfo,
               _id: subInfo._id.toString()
            } : null
         };
      }));

      // Secure payload delivery
      return NextResponse.json({ 
         assignment: {
            text: assignment.text,
            deadline: assignment.deadline || null,
            subjectDetails: subject
         },
         students: studentMap 
      });

   } catch (err) {
      console.error('Submission Tracking API Drop:', err);
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
   }
}
