import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

/**
 * GET /api/auth/profile
 * Returns full profile of the currently logged-in user from DB.
 */
export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const db = await getDb();
    const dbUser = await db.collection('users').findOne(
      { _id: new ObjectId(user.userId) },
      { projection: { password: 0 } } // never return password hash
    );

    if (!dbUser) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ user: dbUser });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/profile
 * Allows the logged-in user to update their own email, phone, and/or password.
 * Immutable fields: fullName, username, teacherId, studentId, role, classCode.
 */
export async function PATCH(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
    }

    const body = await request.json();
    const { email, phone, currentPassword, newPassword } = body;

    // Build update object — only allow email and phone directly
    const updateFields = {};

    if (email !== undefined) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
      }
      updateFields.email = email.trim().toLowerCase();
    }

    if (phone !== undefined) {
      updateFields.phone = phone.trim();
    }

    // Handle password change
    if (newPassword !== undefined && newPassword !== '') {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Password saat ini wajib diisi untuk mengubah password' },
          { status: 400 }
        );
      }
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password baru minimal 6 karakter' },
          { status: 400 }
        );
      }

      const db = await getDb();
      const dbUser = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });

      if (!dbUser) {
        return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
      }

      const isMatch = await bcrypt.compare(currentPassword, dbUser.password);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Password saat ini salah' },
          { status: 400 }
        );
      }

      updateFields.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    updateFields.updatedAt = new Date();

    const db = await getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(user.userId) },
      { $set: updateFields }
    );

    // Log activity
    try {
      await logActivity(db, {
        userId: user.userId,
        userName: user.fullName,
        action: 'update',
        target: `Profile: ${user.fullName} memperbarui profil sendiri`,
      });
    } catch (_) {
      // Non-critical — ignore log errors
    }

    return NextResponse.json({ success: true, message: 'Profil berhasil diperbarui' });
  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
