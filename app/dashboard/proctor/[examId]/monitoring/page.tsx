import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import MonitoringClient from '../monitoring';
import { canAccessProctorExam } from '@/lib/proctorAccess';

async function getAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId?: string; role?: string };
  } catch {
    return null;
  }
}

export default async function ProctorExamMonitoringPage({ params }: { params: Promise<{ examId: string }> }) {
  const payload = await getAuthPayload();
  if (!payload?.userId || !payload?.role) {
    redirect('/login');
  }

  const { examId } = await params;
  const access = await canAccessProctorExam(
    { userId: String(payload.userId), role: String(payload.role) },
    examId
  );

  if (!access.allowed) {
    redirect('/unauthorized');
  }

  return <MonitoringClient examId={examId} examTitle={access.exam?.title || 'Monitoring Ujian'} />;
}
