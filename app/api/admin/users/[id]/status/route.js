import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

/**
 * PATCH /api/admin/users/[id]/status
 * Toggle user status between 'active' and 'inactive'.
 */
export async function PATCH(request, { params }) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Prevent toggling your own status
    if (user._id.toString() === admin.userId) {
      return NextResponse.json(
        { error: 'Tidak dapat mengubah status akun sendiri' },
        { status: 400 }
      );
    }

    const newStatus = user.status === 'active' ? 'inactive' : 'active';

    await db
      .collection('users')
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: newStatus, updatedAt: new Date() } }
      );

    // Log activity
    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'status_change',
      target: `${user.fullName}`,
      details: { previousStatus: user.status, newStatus, role: user.role },
    });

    return NextResponse.json({ success: true, newStatus });
  } catch (err) {
    console.error('Toggle status error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
