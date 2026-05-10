import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

const ALLOWED_ROLES = ['teacher', 'student', 'principal', 'curriculum'];

export async function POST(request, { params }) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID user tidak valid' }, { status: 400 });
    }

    const { role } = await request.json();

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Role tujuan tidak valid' }, { status: 400 });
    }

    const existingUser = await db.collection('users').findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const updateDoc = {
      role,
      updatedAt: new Date(),
    };

    // If moved away from teacher, revoke proctor marker to keep data consistent.
    if (role !== 'teacher') {
      updateDoc.isProctor = false;
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'update',
      target: `Assign role: ${existingUser.fullName}`,
      details: { userId: id, previousRole: existingUser.role, newRole: role },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
