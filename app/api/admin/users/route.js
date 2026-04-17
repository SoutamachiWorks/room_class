import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/users
 * List all users with pagination, role filter, and search.
 */
export async function GET(request) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const role = searchParams.get('role') || '';
    const search = searchParams.get('search') || '';

    // Build filter
    const filter = {};
    if (role && ['admin', 'teacher', 'student'].includes(role)) {
      filter.role = role;
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { teacherId: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, totalCount] = await Promise.all([
      db
        .collection('users')
        .find(filter, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('users').countDocuments(filter),
    ]);

    return NextResponse.json({
      users,
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

/**
 * POST /api/admin/users
 * Create a new teacher or student account.
 */
export async function POST(request) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const body = await request.json();

    const { role, fullName, username, password, email, phone, teacherId, studentId, classCode } = body;

    // Validate required fields
    if (!role || !fullName || !username || !password || !email) {
      return NextResponse.json(
        { error: 'Field wajib belum lengkap' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['teacher', 'student'].includes(role)) {
      return NextResponse.json(
        { error: 'Role harus teacher atau student' },
        { status: 400 }
      );
    }

    // Role-specific validation
    if (role === 'teacher' && !teacherId) {
      return NextResponse.json(
        { error: 'Teacher ID (No. Induk Guru) wajib diisi' },
        { status: 400 }
      );
    }
    if (role === 'student') {
      if (!studentId) {
        return NextResponse.json(
          { error: 'Student ID (No. Induk Siswa) wajib diisi' },
          { status: 400 }
        );
      }
      if (!classCode) {
        return NextResponse.json(
          { error: 'Kode kelas wajib diisi' },
          { status: 400 }
        );
      }
    }

    // Check uniqueness: username
    const existingUsername = await db.collection('users').findOne({ username });
    if (existingUsername) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 409 }
      );
    }

    // Check uniqueness: teacherId or studentId
    if (role === 'teacher') {
      const existingTeacher = await db.collection('users').findOne({ teacherId });
      if (existingTeacher) {
        return NextResponse.json(
          { error: 'Teacher ID sudah digunakan' },
          { status: 409 }
        );
      }
    }
    if (role === 'student') {
      const existingStudent = await db.collection('users').findOne({ studentId });
      if (existingStudent) {
        return NextResponse.json(
          { error: 'Student ID sudah digunakan' },
          { status: 409 }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Build user document
    const userDoc = {
      role,
      fullName,
      username,
      password: hashedPassword,
      email,
      phone: phone || '',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (role === 'teacher') {
      userDoc.teacherId = teacherId;
    }
    if (role === 'student') {
      userDoc.studentId = studentId;
      userDoc.classCode = classCode;
    }

    const result = await db.collection('users').insertOne(userDoc);

    // Log activity
    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'create',
      target: `${role === 'teacher' ? 'Guru' : 'Siswa'}: ${fullName}`,
      details: { createdUserId: result.insertedId.toString(), role, username },
    });

    return NextResponse.json(
      { success: true, userId: result.insertedId },
      { status: 201 }
    );
  } catch (err) {
    console.error('Create user error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
