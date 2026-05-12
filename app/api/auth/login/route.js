import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkFixedWindowRateLimit } from '@/lib/rateLimit';

const LOGIN_RATE_LIMIT = 8;
const LOGIN_RATE_WINDOW_SECONDS = 10 * 60;

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function normalizeRateLimitPart(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 80);
}

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifier dan password wajib diisi' },
        { status: 400 }
      );
    }

    const ip = normalizeRateLimitPart(getClientIp(request));
    const account = normalizeRateLimitPart(identifier);
    const [ipLimit, accountLimit] = await Promise.all([
      checkFixedWindowRateLimit({
        key: `rate:login:ip:${ip}`,
        limit: LOGIN_RATE_LIMIT * 3,
        windowSeconds: LOGIN_RATE_WINDOW_SECONDS,
      }),
      checkFixedWindowRateLimit({
        key: `rate:login:account:${account}`,
        limit: LOGIN_RATE_LIMIT,
        windowSeconds: LOGIN_RATE_WINDOW_SECONDS,
      }),
    ]);

    if (!ipLimit.allowed || !accountLimit.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' },
        { status: 429 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    // Search by username, teacherId, or studentId
    const user = await usersCollection.findOne({
      $or: [
        { username: identifier },
        { teacherId: identifier },
        { studentId: identifier },
      ],
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kredensial tidak valid' },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Akun Anda tidak aktif. Hubungi administrator.' },
        { status: 403 }
      );
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Kredensial tidak valid' },
        { status: 401 }
      );
    }

    // Create JWT token
    const tokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      isProctor: Boolean(user.isProctor),
      fullName: user.fullName,
      username: user.username,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    // Build redirect path based on role
    const redirectMap = {
      admin: '/dashboard/admin',
      teacher: '/dashboard/teacher',
      student: '/dashboard/student',
      principal: '/dashboard/principal',
      curriculum: '/dashboard/curriculum',
    };

    const redirectTo = redirectMap[user.role] || '/login';

    // Set HttpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: {
        fullName: user.fullName,
        role: user.role,
        username: user.username,
      },
      redirectTo,
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
