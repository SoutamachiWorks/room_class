import { jwtVerify } from 'jose';

/**
 * Extract and verify the JWT from the request cookies.
 * Returns the user payload or null if invalid.
 */
export async function getAuthUser(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    return {
      userId: payload.userId,
      role: payload.role,
      fullName: payload.fullName,
      username: payload.username,
    };
  } catch {
    return null;
  }
}

/**
 * Require a specific role. Returns the user if authorized.
 * Throws an object with `status` and `error` if unauthorized.
 */
export async function requireRole(request, role) {
  const user = await getAuthUser(request);

  if (!user) {
    throw { status: 401, error: 'Tidak terautentikasi' };
  }

  if (Array.isArray(role)) {
    if (!role.includes(user.role)) {
      throw { status: 403, error: 'Akses ditolak' };
    }
  } else if (user.role !== role) {
    throw { status: 403, error: 'Akses ditolak' };
  }

  return user;
}

/**
 * Helper to return a JSON error response from a caught role error.
 */
export function handleAuthError(err) {
  if (err && err.status && err.error) {
    return { status: err.status, error: err.error };
  }
  if (err instanceof Error) {
    return { status: 400, error: err.message };
  }
  return { status: 500, error: 'Terjadi kesalahan server' };
}
