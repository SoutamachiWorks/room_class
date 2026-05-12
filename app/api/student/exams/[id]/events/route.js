import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import redis, { buildExamCacheKey } from '@/lib/redis';

const MAX_EXAM_EVENTS = 120;
const UNEXPECTED_EXIT_LONG_MS = 5 * 60 * 1000;
const UNEXPECTED_EXIT_FREQUENCY_THRESHOLD = 3;
const MAX_VIOLATIONS = 3;

function parseJsonBody(request) {
  return request.json().catch(() => ({}));
}

function normalizeReason(value) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : 'unknown';
}

function normalizeClientAt(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function appendEvent(events, event) {
  return [...(Array.isArray(events) ? events : []), event].slice(-MAX_EXAM_EVENTS);
}

export async function POST(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const body = await parseJsonBody(request);
    const sessionId = String(body?.sessionId || '');
    const type = String(body?.type || '');
    const reason = normalizeReason(body?.reason);
    const clientAt = normalizeClientAt(body?.clientAt);
    const now = new Date();

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    const session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString(),
      studentId,
      status: 'in-progress',
    });

    if (!session) {
      return NextResponse.json({ success: true, ignored: true });
    }

    if (type === 'unexpected-exit-start') {
      const occurredAt = clientAt || now;
      const event = {
        type,
        reason,
        at: occurredAt,
        receivedAt: now,
        countedAsViolation: false,
      };

      await db.collection('examSessions').updateOne(
        { _id: session._id, status: 'in-progress' },
        {
          $set: {
            activeUnexpectedExit: { at: occurredAt, reason },
            lastUnexpectedExitAt: occurredAt,
            examEvents: appendEvent(session.examEvents, event),
          },
        }
      );

      return NextResponse.json({ success: true, countedAsViolation: false });
    }

    if (type === 'unexpected-exit-return') {
      const activeExit = session.activeUnexpectedExit;
      if (!activeExit?.at) {
        return NextResponse.json({ success: true, ignored: true });
      }

      const exitAt = new Date(activeExit.at);
      const returnedAt = clientAt || now;
      const durationMs = Math.max(0, returnedAt.getTime() - exitAt.getTime());
      const unexpectedExitCount = Number(session.unexpectedExitCount || 0) + 1;
      const countedAsViolation =
        durationMs >= UNEXPECTED_EXIT_LONG_MS ||
        unexpectedExitCount % UNEXPECTED_EXIT_FREQUENCY_THRESHOLD === 0;
      const nextExitCount = Number(session.exitCount || 0) + (countedAsViolation ? 1 : 0);
      const locked = nextExitCount >= MAX_VIOLATIONS;

      const event = {
        type,
        reason,
        at: returnedAt,
        exitAt,
        returnedAt,
        durationMs,
        unexpectedExitCount,
        countedAsViolation,
        violationRule: countedAsViolation
          ? durationMs >= UNEXPECTED_EXIT_LONG_MS
            ? 'unexpected-exit-too-long'
            : 'unexpected-exit-too-frequent'
          : null,
      };

      await db.collection('examSessions').updateOne(
        { _id: session._id, status: 'in-progress' },
        {
          $set: {
            exitCount: nextExitCount,
            unexpectedExitCount,
            status: locked ? 'locked' : 'in-progress',
            examEvents: appendEvent(session.examEvents, event),
          },
          $unset: { activeUnexpectedExit: '' },
        }
      );

      if (locked) {
        try {
          await redis.del(buildExamCacheKey(examId.toString(), studentId));
        } catch (err) {
          console.error('Redis cleanup on unexpected-exit lock failed:', err);
        }
      }

      return NextResponse.json({
        success: true,
        exitCount: nextExitCount,
        unexpectedExitCount,
        countedAsViolation,
        locked,
      });
    }

    return NextResponse.json({ error: 'Tipe event tidak valid.' }, { status: 400 });
  } catch (err) {
    console.error('Exam event record error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
