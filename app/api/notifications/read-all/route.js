import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireAuth, handleAuthError } from '@/lib/auth';

/**
 * PATCH /api/notifications/read-all
 * Marks all unread notifications for current user as read.
 */
export async function PATCH(request) {
  try {
    const user = await requireAuth(request);
    const db = await getDb();

    await db.collection('notifications').updateMany(
      { userId: user.userId, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
