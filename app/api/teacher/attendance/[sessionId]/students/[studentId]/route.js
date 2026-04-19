import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * PATCH /api/teacher/attendance/[sessionId]/students/[studentId]
 * Manually corrects a student's attendance status.
 * Body: { status: 'hadir' | 'sakit' | 'izin' | 'alpha', note?: string }
 */
export async function PATCH(request, { params }) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();
    const { sessionId, studentId } = await params;

    if (!ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'Session ID tidak valid' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ error: 'Identifikasi guru gagal' }, { status: 403 });

    // Verify session belongs to this teacher
    const session = await db.collection('attendanceSessions').findOne({ _id: new ObjectId(sessionId) });
    if (!session || session.teacherId !== teacherId) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();
    const { status, note = '' } = body;

    const validStatuses = ['hadir', 'sakit', 'izin', 'alpha'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status tidak valid. Pilih salah satu: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const now = new Date();
    const existing = await db.collection('attendances').findOne({
      sessionId: sessionId.toString(),
      studentId,
    });

    if (existing) {
      // Update existing record
      await db.collection('attendances').updateOne(
        { _id: existing._id },
        {
          $set: {
            status,
            note,
            isManual: true,
            updatedAt: now,
          },
        }
      );
    } else {
      // Create new record (student had no record yet — e.g., session still open)
      await db.collection('attendances').insertOne({
        sessionId: sessionId.toString(),
        studentId,
        subjectId: session.subjectId,
        classCode: session.classCode,
        date: session.date,
        status,
        note,
        checkedInAt: null,
        isManual: true,
        deviceInfo: null,
        createdAt: now,
      });
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
