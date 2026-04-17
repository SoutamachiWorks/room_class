import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that don't require authentication
const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout'];

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
          const redirectMap = {
            admin: '/dashboard/admin',
            teacher: '/dashboard/teacher',
            student: '/dashboard/student',
          };
          const redirectTo = redirectMap[payload.role];
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

      // Role-based access control
      const roleFromPath = pathname.split('/')[2]; // e.g., 'admin', 'teacher', 'student'
      
      if (roleFromPath && payload.role !== roleFromPath) {
        // Redirect to their correct dashboard
        const redirectMap = {
          admin: '/dashboard/admin',
          teacher: '/dashboard/teacher',
          student: '/dashboard/student',
        };
        return NextResponse.redirect(
          new URL(redirectMap[payload.role] || '/login', request.url)
        );
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
