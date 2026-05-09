import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2 } from '@/lib/s3Client';
import { createNotification } from '@/lib/notification';

/**
 * POST /api/student/submissions
 * Creates a new submission for the given assignmentId.
 * Accepts multipart form data: assignmentId, text, files[].
 */
export async function POST(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const classCode = userDoc?.classCode;

    if (!studentId || !classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const formData = await request.formData();
    const assignmentId = formData.get('assignmentId');
    const text = formData.get('text');
    const files = formData.getAll('files');

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId wajib diisi.' }, { status: 400 });
    }
    if (!ObjectId.isValid(assignmentId)) {
      return NextResponse.json({ error: 'assignmentId tidak valid.' }, { status: 400 });
    }

    // Verify assignment exists and is scoped to the student's class
    const assignment = await db.collection('assignments').findOne({ _id: new ObjectId(assignmentId) });
    if (!assignment) {
      return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });
    }

    // Verify subject classCode matches student's classCode
    if (!ObjectId.isValid(assignment.subjectId)) {
      return NextResponse.json({ error: 'Data mata pelajaran pada tugas tidak valid.' }, { status: 400 });
    }
    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(assignment.subjectId) });
    if (!subject || subject.classCode !== classCode) {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke tugas ini.' }, { status: 403 });
    }

    // Check if student already submitted
    const existing = await db.collection('submissions').findOne({ assignmentId: assignmentId.toString(), studentId });
    if (existing) {
      return NextResponse.json({ error: 'Anda sudah mengumpulkan jawaban untuk tugas ini. Gunakan fitur edit.' }, { status: 400 });
    }

    const processedFiles = [];
    for (const file of files) {
      if (file && file.name) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const r2Data = await uploadToR2(buffer, file.name, file.type, 'submissions');

        processedFiles.push({
          originalName: r2Data.originalName,
          fileKey: r2Data.fileKey,
          size: r2Data.size,
          type: r2Data.mimeType,
        });
      }
    }

    let isLate = false;
    const now = new Date();
    if (assignment.deadline) {
      if (now > new Date(assignment.deadline)) {
         isLate = true;
      }
    }

    const newSubmission = {
      assignmentId: assignmentId.toString(),
      studentId,
      text: text || '',
      files: processedFiles,
      submittedAt: now,
      updatedAt: now,
      isLate,
      score: null // initially ungraded
    };

    const result = await db.collection('submissions').insertOne(newSubmission);

    // Notifikasi ke guru
    const teacherUser = await db.collection('users').findOne({ role: 'teacher', teacherId: assignment.teacherId });
    if (teacherUser) {
      await createNotification(db, {
        userId: teacherUser._id,
        title: 'Pengumpulan Tugas',
        message: `Siswa ${userDoc.fullName || studentId} telah mengumpulkan tugas untuk mata pelajaran ${subject?.subjectName || 'terkait'}.`,
        type: 'success',
        actionUrl: `/dashboard/teacher/assignments/${assignmentId}`
      });
    }

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (err) {
    console.error('Submission error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
