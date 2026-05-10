import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import redis from '@/lib/redis';
import { canAccessProctorExam } from '@/lib/proctorAccess';

function parseCachePayload(raw: unknown) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function extractAnsweredCount(payload: Record<string, unknown>) {
  if (Number.isFinite(Number(payload.answeredCount))) return Number(payload.answeredCount);
  const answers = payload.answers as { multipleChoice?: unknown[]; essay?: unknown[] } | undefined;
  const mcCount = Array.isArray(answers?.multipleChoice) ? answers.multipleChoice.filter((v) => v !== null && v !== undefined).length : 0;
  const essayCount = Array.isArray(answers?.essay) ? answers.essay.filter((v) => String(v ?? '').trim() !== '').length : 0;
  return Math.max(mcCount, essayCount);
}

async function scanExamStudentKeys(examId: string) {
  const match = `exam:${examId}:student:*`;
  const keys: string[] = [];
  let cursor: string | number = '0';

  do {
    const result: unknown = await redis.scan(cursor, { match, count: 100 });
    if (Array.isArray(result)) {
      cursor = result[0];
      const pageKeys = Array.isArray(result[1]) ? result[1] : [];
      for (const key of pageKeys) {
        if (typeof key === 'string' && !key.endsWith(':warning')) keys.push(key);
      }
    } else {
      const nextCursor = (result as { cursor?: string | number }).cursor ?? '0';
      const pageKeys = Array.isArray((result as { keys?: unknown[] }).keys) ? (result as { keys: unknown[] }).keys : [];
      cursor = nextCursor;
      for (const key of pageKeys) {
        if (typeof key === 'string' && !key.endsWith(':warning')) keys.push(key);
      }
    }
  } while (String(cursor) !== '0');

  return keys;
}

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  try {
    const user = await requireRole(request as any, ['admin', 'teacher']);
    const { examId } = await params;

    const access = await canAccessProctorExam({ userId: user.userId, role: user.role }, examId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.reason === 'Ujian tidak ditemukan' ? 404 : 403 });
    }

    const db = await getDb();
    const redisKeys = await scanExamStudentKeys(examId);
    const redisEntries = await Promise.all(
      redisKeys.map(async (key) => {
        const payload = parseCachePayload(await redis.get(key));
        const studentId = key.split(':')[3] || '';
        return { studentId, payload };
      })
    );

    const redisMap = new Map(redisEntries.map((entry) => [entry.studentId, entry.payload]));

    const sessions = await db
      .collection('examSessions')
      .find(
        { examId: examId.toString() },
        { projection: { studentId: 1, status: 1, submittedAt: 1, answers: 1, exitCount: 1 }, sort: { startedAt: -1 } }
      )
      .toArray();

    const latestSessionByStudent = new Map<string, any>();
    for (const session of sessions) {
      if (session?.studentId && !latestSessionByStudent.has(session.studentId)) {
        latestSessionByStudent.set(session.studentId, session);
      }
    }

    const studentIds = Array.from(new Set([...redisMap.keys(), ...latestSessionByStudent.keys()]));
    const users = studentIds.length
      ? await db
          .collection('users')
          .find({ role: 'student', studentId: { $in: studentIds } }, { projection: { studentId: 1, fullName: 1 } })
          .toArray()
      : [];

    const userByStudentId = new Map(
      users.map((u: { studentId: string; fullName?: string }) => [u.studentId, u] as const)
    );

    const students = studentIds.map((studentId) => {
      const payload = (redisMap.get(studentId) || {}) as Record<string, unknown>;
      const session = latestSessionByStudent.get(studentId);
      const userDoc = userByStudentId.get(studentId);

      const violationCount = Number.isFinite(Number(payload.violationCount))
        ? Number(payload.violationCount)
        : Number(session?.exitCount || 0);
      const answeredCount = extractAnsweredCount(payload) || (Array.isArray(session?.answers) ? session.answers.length : 0);
      const submittedAtRaw = payload.submittedAt || session?.submittedAt || null;
      const submittedAt = submittedAtRaw ? new Date(submittedAtRaw as string | Date).toISOString() : null;

      const status = payload.status === 'offline' ? 'offline' : submittedAt ? 'offline' : 'online';

      return {
        studentId,
        namaSiswa: (userDoc as any)?.fullName || '-',
        nisn: studentId,
        status,
        violationCount,
        answeredCount,
        submittedAt,
      };
    });

    students.sort((a, b) => {
      if ((b.violationCount > 0 ? 1 : 0) !== (a.violationCount > 0 ? 1 : 0)) {
        return (b.violationCount > 0 ? 1 : 0) - (a.violationCount > 0 ? 1 : 0);
      }
      return a.namaSiswa.localeCompare(b.namaSiswa, 'id');
    });

    const summary = {
      total: students.length,
      online: students.filter((s) => s.status === 'online').length,
      violated: students.filter((s) => s.violationCount > 0).length,
      finished: students.filter((s) => s.submittedAt !== null).length,
    };

    return NextResponse.json({
      examId,
      examTitle: access.exam?.title || 'Monitoring Ujian',
      isExamOpen: access.exam?.isExamOpen === true,
      fetchedAt: new Date().toISOString(),
      summary,
      students,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
