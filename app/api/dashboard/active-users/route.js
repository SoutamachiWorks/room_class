import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireRole(request, ['principal', 'curriculum']);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || '';
    const search = searchParams.get('search') || '';

    const match = {
      role: role && role !== 'all' ? role : { $in: ['student', 'teacher'] },
      status: { $ne: 'inactive' },
    };

    if (search) {
      match.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { teacherId: { $regex: search, $options: 'i' } },
        { classCode: { $regex: search, $options: 'i' } },
      ];
    }

    const [summary, users] = await Promise.all([
      db.collection('users').aggregate([
        { $match: { role: { $in: ['student', 'teacher'] }, status: { $ne: 'inactive' } } },
        { $group: { _id: '$role', total: { $sum: 1 } } },
      ]).toArray(),
      db.collection('users')
        .find(match, { projection: { password: 0 } })
        .sort({ role: 1, classCode: 1, fullName: 1 })
        .limit(300)
        .toArray(),
    ]);

    return NextResponse.json({
      summary: {
        students: summary.find((item) => item._id === 'student')?.total || 0,
        teachers: summary.find((item) => item._id === 'teacher')?.total || 0,
      },
      users,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
