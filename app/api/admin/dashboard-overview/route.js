import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    // Jalankan semua query secara paralel di sisi server (lebih cepat daripada di client)
    const [
      totalUsers,
      teachers,
      students,
      classCodes,
      logs,
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('users').countDocuments({ role: 'teacher' }),
      db.collection('users').countDocuments({ role: 'student' }),
      db.collection('classCodes').find().toArray(),
      db.collection('activityLogs').find().sort({ timestamp: -1 }).limit(6).toArray(),
    ]);

    return NextResponse.json({
      stats: {
        total: totalUsers,
        teachers,
        students,
        classes: classCodes.length,
      },
      classes: classCodes.slice(0, 6),
      logs,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
