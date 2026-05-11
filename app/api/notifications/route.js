import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { handleAuthError } from '@/lib/auth';
import { cookies } from 'next/headers';
import * as jose from 'jose';

/**
 * Helper to get the current user ID from the JWT token.
 * We don't use requireRole because this endpoint is used by both teachers and students.
 */
async function getUserIdFromToken(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) throw { status: 401, error: 'Tidak terautentikasi' };

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET belum dikonfigurasi');
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    return payload.userId;
  } catch {
    throw { status: 401, error: 'Token tidak valid' };
  }
}

/**
 * GET /api/notifications
 * Retrieves the latest notifications for the logged-in user.
 */
export async function GET(request) {
  try {
    const userId = await getUserIdFromToken(request);
    const db = await getDb();

    // Fetch the 50 most recent notifications
    const notifications = await db.collection('notifications')
      .find({ userId: userId.toString() })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Count unread notifications
    const unreadCount = await db.collection('notifications')
      .countDocuments({ userId: userId.toString(), isRead: false });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status: status || 401 });
  }
}
