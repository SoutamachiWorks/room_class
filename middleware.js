import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const MAX_TOKEN_AGE_SECONDS = 60 * 60 * 24;

function isTokenTooOld(payload) {
  if (!payload?.iat || typeof payload.iat !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - payload.iat > MAX_TOKEN_AGE_SECONDS;
}

// Routes that don't require authentication
const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout'];
const routePermissions = {
  '/dashboard/admin': ['admin'],
  '/dashboard/teacher': ['admin', 'teacher'],
  '/dashboard/student': ['admin', 'student'],
  '/dashboard/principal': ['admin', 'principal'],
  '/dashboard/curriculum': ['admin', 'curriculum'],
  '/dashboard/proctor': ['admin', 'teacher'],
};

const roleDefaultDashboard = {
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  principal: '/dashboard/principal',
  curriculum: '/dashboard/curriculum',
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // If user is already logged in and tries to access /login, redirect to dashboard
    if (pathname === '/login') {
      const token = request.cookies.get('auth-token')?.value;
      if (token) {
        try {
          const secret = new TextEncoder().encode(process.env.JWT_SECRET);
          const { payload } = await jwtVerify(token, secret);
          if (isTokenTooOld(payload)) {
            throw new Error('Token expired by max age policy');
          }
          const redirectTo = roleDefaultDashboard[payload.role];
          if (redirectTo) {
            return NextResponse.redirect(new URL(redirectTo, request.url));
          }
        } catch {
          // Token invalid, let them access login
        }
      }
    }
    return NextResponse.next();
  }

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      if (isTokenTooOld(payload)) {
        throw new Error('Token expired by max age policy');
      }

      // Role-based access control per route permission map
      const matchedRoute = Object.keys(routePermissions).find((route) =>
        pathname.startsWith(route)
      );

      if (matchedRoute) {
        const allowedRoles = routePermissions[matchedRoute];
        if (!allowedRoles.includes(payload.role)) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
        if (
          matchedRoute === '/dashboard/proctor' &&
          payload.role === 'teacher' &&
          !payload.isProctor
        ) {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }
      }

      // Attach user info to headers for downstream use
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', payload.userId);
      requestHeaders.set('x-user-role', payload.role);
      requestHeaders.set('x-user-name', payload.fullName);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch {
      // Token invalid or expired
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('auth-token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
