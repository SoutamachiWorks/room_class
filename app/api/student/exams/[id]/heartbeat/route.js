import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { checkDisconnectLock } from '@/lib/examIntegrity';

export async function POST(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id: examId } = await params;
    const { sessionId } = await request.json().catch(() => ({}));

    if (!ObjectId.isValid(examId)) {
      return NextResponse.json({ error: 'ID ujian tidak valid.' }, { status: 400 });
    }

    if (!sessionId || !ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'sessionId tidak valid.' }, { status: 400 });
    }

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });
    }

    const session = await db.collection('examSessions').findOne({
      _id: new ObjectId(sessionId),
      examId: examId.toString(),
      studentId,
    });

    if (!session) {
      return NextResponse.json({ success: false, ignored: true });
    }

    const disconnectCheck = await checkDisconnectLock(db, session);
    if (disconnectCheck.locked) {
      return NextResponse.json({ success: false, locked: true, error: disconnectCheck.error || 'Sesi ujian dikunci.' }, { status: 403 });
    }
    const activeSession = disconnectCheck.session;

    if (activeSession.status === 'locked') {
      return NextResponse.json({ success: false, locked: true, error: activeSession.manualLockReason || 'Sesi ujian dikunci.' }, { status: 403 });
    }

    if (activeSession.status === 'disqualified') {
      return NextResponse.json({ success: false, disqualified: true, error: activeSession.disqualifyReason || 'Siswa didiskualifikasi.' }, { status: 403 });
    }

    const heartbeatAt = new Date();
    const result = await db.collection('examSessions').updateOne(
      {
        _id: new ObjectId(sessionId),
        examId: examId.toString(),
        studentId,
        status: 'in-progress',
      },
      {
        $set: {
          lastHeartbeatAt: heartbeatAt,
          lastSeenAt: heartbeatAt,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, ignored: true });
    }

    return NextResponse.json({ success: true, heartbeatAt });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
