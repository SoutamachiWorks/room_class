import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import { canAccessProctorExam } from '@/lib/proctorAccess';
import QuestionsClient from './questions-client';

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

export default async function ProctorExamQuestionsPage({ params }: { params: Promise<{ examId: string }> }) {
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

  return <QuestionsClient examId={examId} />;
}
