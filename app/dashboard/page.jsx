import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';

const roleDefaultDashboard = {
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  principal: '/dashboard/principal',
  curriculum: '/dashboard/curriculum',
};

export default async function DashboardRootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const nextPath = roleDefaultDashboard[payload.role] || '/login';
    redirect(nextPath);
  } catch {
    redirect('/login');
  }
}
