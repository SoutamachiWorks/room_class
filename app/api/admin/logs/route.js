import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/admin/logs
 * Fetch activity logs with pagination.
 */
export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const action = searchParams.get('action') || '';

    const filter = {};
    if (action) {
      filter.action = action;
    }

    const skip = (page - 1) * limit;

    const [logs, totalCount] = await Promise.all([
      db
        .collection('activityLogs')
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('activityLogs').countDocuments(filter),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
