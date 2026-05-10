import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Tidak terautentikasi' },
        { status: 401 }
      );
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    return NextResponse.json({
      user: {
        userId: payload.userId,
        role: payload.role,
        isProctor: Boolean(payload.isProctor),
        fullName: payload.fullName,
        username: payload.username,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Token tidak valid' },
      { status: 401 }
    );
  }
}
