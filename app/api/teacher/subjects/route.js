import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/teacher/subjects
 * Retrieves all subjects strictly assigned to the currently logged-in teacher.
 * This is used to populate targeted Dropdowns in the Material/Assignment/Exam portals.
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    // The teacher document stores their unique teacherId. Our token holds `username` and `role`, but we didn't inject `teacherId` securely into the standard JWT initially. 
    // Let's resolve their `teacherId` natively first to be absolutely safe (just in case they logged in with username instead of teacherId)
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });

    if (!userDoc || !userDoc.teacherId) {
        return NextResponse.json({ error: 'Identifikasi Guru Gagal: Parameter Teacher ID tidak ditemukan pada profil.' }, { status: 403 });
    }

    const { teacherId } = userDoc;

    // Fetch subjects constrained to this specific teacher
    const subjects = await db.collection('subjects')
      .find({ teacherId })
      .sort({ classCode: 1, subjectName: 1 })
      .toArray();

    return NextResponse.json({ subjects });

  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
