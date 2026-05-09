import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    
    const body = await request.json();
    const { classCode, subjectId, teacherId, dayOfWeek, startTime, endTime } = body;

    if (!classCode || !subjectId || !teacherId || dayOfWeek === undefined || !startTime || !endTime) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }
    if (!ObjectId.isValid(subjectId)) {
      return NextResponse.json({ error: 'subjectId tidak valid' }, { status: 400 });
    }

    // Validasi Subject exist
    const subject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId) });
    if (!subject) {
      return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan' }, { status: 404 });
    }

    const newSchedule = {
      classCode,
      subjectId: new ObjectId(subjectId),
      teacherId,
      dayOfWeek: parseInt(dayOfWeek, 10),
      startTime,
      endTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('schedules').insertOne(newSchedule);

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
