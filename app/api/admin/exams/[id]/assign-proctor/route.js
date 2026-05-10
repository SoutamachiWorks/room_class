import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID ujian tidak valid' }, { status: 400 });
    }

    const { teacherUserId } = await request.json();

    if (!teacherUserId || !ObjectId.isValid(teacherUserId)) {
      return NextResponse.json({ error: 'teacherUserId tidak valid' }, { status: 400 });
    }

    const teacherUser = await db.collection('users').findOne({
      _id: new ObjectId(teacherUserId),
      role: 'teacher',
    });

    if (!teacherUser) {
      return NextResponse.json({ error: 'User guru tidak ditemukan' }, { status: 404 });
    }

    const result = await db.collection('exams').updateOne(
      { _id: new ObjectId(id) },
      { $set: { proctorId: teacherUser._id.toString(), updatedAt: new Date() } }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: 'Data ujian tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
