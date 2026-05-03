import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/users/[id]
 * Get a single user by ID.
 */
export async function GET(request, { params }) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update user fields (except role).
 */
export async function PUT(request, { params }) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;
    const body = await request.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const existingUser = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) });

    if (!existingUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Build update object — exclude role from updates
    const updateFields = {};
    const allowedFields = ['fullName', 'username', 'email', 'phone', 'teacherId', 'studentId', 'classCode', 'academicYearId'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    // Handle password update (re-hash if provided)
    if (body.password && body.password.trim() !== '') {
      updateFields.password = await bcrypt.hash(body.password, 12);
    }

    // Check username uniqueness if changed
    if (updateFields.username && updateFields.username !== existingUser.username) {
      const duplicate = await db.collection('users').findOne({
        username: updateFields.username,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Username sudah digunakan' },
          { status: 409 }
        );
      }
    }

    // Check teacherId uniqueness if changed
    if (updateFields.teacherId && updateFields.teacherId !== existingUser.teacherId) {
      const duplicate = await db.collection('users').findOne({
        teacherId: updateFields.teacherId,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Teacher ID sudah digunakan' },
          { status: 409 }
        );
      }
    }

    // Check studentId uniqueness if changed
    if (updateFields.studentId && updateFields.studentId !== existingUser.studentId) {
      const duplicate = await db.collection('users').findOne({
        studentId: updateFields.studentId,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Student ID sudah digunakan' },
          { status: 409 }
        );
      }
    }

    updateFields.updatedAt = new Date();

    await db
      .collection('users')
      .updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    // Log activity
    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'update',
      target: `${existingUser.role === 'teacher' ? 'Guru' : existingUser.role === 'student' ? 'Siswa' : 'Admin'}: ${existingUser.fullName}`,
      details: { updatedFields: Object.keys(updateFields).filter((k) => k !== 'password' && k !== 'updatedAt') },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Hard delete a user.
 */
export async function DELETE(request, { params }) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Prevent deleting yourself
    if (user._id.toString() === admin.userId) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    await db.collection('users').deleteOne({ _id: new ObjectId(id) });

    // Log activity
    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'delete',
      target: `${user.role === 'teacher' ? 'Guru' : user.role === 'student' ? 'Siswa' : 'Admin'}: ${user.fullName}`,
      details: { deletedUserId: id, role: user.role, username: user.username },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
