import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const MAX_TOKEN_AGE_SECONDS = 60 * 60 * 24;

function isTokenTooOld(payload) {
  if (!payload?.iat || typeof payload.iat !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - payload.iat > MAX_TOKEN_AGE_SECONDS;
}

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
    if (isTokenTooOld(payload)) {
      return NextResponse.json(
        { error: 'Token kedaluwarsa, silakan login ulang' },
        { status: 401 }
      );
    }

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
