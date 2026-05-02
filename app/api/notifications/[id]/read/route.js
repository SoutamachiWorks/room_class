import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { handleAuthError } from '@/lib/auth';
import { cookies } from 'next/headers';
import * as jose from 'jose';

async function getUserIdFromToken(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) throw new Error('Unauthenticated');

  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
  const { payload } = await jose.jwtVerify(token, secret);
  return payload.userId;
}

/**
 * PATCH /api/notifications/[id]/read
 * Marks a specific notification as read.
 */
export async function PATCH(request, { params }) {
  try {
    const userId = await getUserIdFromToken(request);
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID notifikasi tidak valid' }, { status: 400 });
    }

    // Update the notification, ensuring it belongs to the user
    const result = await db.collection('notifications').updateOne(
      { _id: new ObjectId(id), userId: userId.toString() },
      { $set: { isRead: true } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status: status || 401 });
  }
}
