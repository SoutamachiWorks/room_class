import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

async function verifyOwnership(request, examId, sessionId) {
  const teacher = await requireRole(request, 'teacher');
  const db = await getDb();

  if (!ObjectId.isValid(examId) || !ObjectId.isValid(sessionId)) {
    return { error: 'ID tidak valid', status: 400 };
  }

  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
  const teacherId = userDoc?.teacherId;
  if (!teacherId) return { error: 'Identifikasi guru gagal', status: 403 };

  const exam = await db.collection('exams').findOne({ _id: new ObjectId(examId) });
  if (!exam) return { error: 'Ujian tidak ditemukan', status: 404 };

  const subject = await db.collection('subjects').findOne({ _id: new ObjectId(exam.subjectId) });
  if (!subject || subject.teacherId !== teacherId) {
    return { error: 'Anda tidak memiliki izin', status: 403 };
  }

  return { db, teacher };
}

export async function PATCH(request, { params }) {
  try {
    const { id: examId, sessionId } = await params;
    const verified = await verifyOwnership(request, examId, sessionId);
    if (verified.error) return NextResponse.json({ error: verified.error }, { status: verified.status });

    const { db, teacher } = verified;
    const { action, reason = '' } = await request.json().catch(() => ({}));
    const now = new Date();
    const cleanReason = String(reason || '').trim().slice(0, 180);

    let update;
    if (action === 'lock') {
      update = {
        $set: {
          status: 'locked',
          manualLockedAt: now,
          manualLockedBy: teacher.userId,
          manualLockReason: cleanReason || 'Dikunci manual oleh guru.',
        },
        $push: {
          examEvents: {
            type: 'manual-lock',
            at: now,
            reason: cleanReason || 'Dikunci manual oleh guru.',
            countedAsViolation: false,
            by: teacher.userId,
          },
        },
      };
    } else if (action === 'disqualify') {
      update = {
        $set: {
          status: 'disqualified',
          gradingStatus: 'auto-graded',
          calculatedScore: 0,
          disqualifiedAt: now,
          disqualifiedBy: teacher.userId,
          disqualifyReason: cleanReason || 'Diskualifikasi oleh guru.',
        },
        $push: {
          examEvents: {
            type: 'manual-disqualify',
            at: now,
            reason: cleanReason || 'Diskualifikasi oleh guru.',
            countedAsViolation: true,
            by: teacher.userId,
          },
        },
      };
    } else {
      return NextResponse.json({ error: 'Aksi tidak valid.' }, { status: 400 });
    }

    const allowedStatuses = action === 'lock' ? ['in-progress'] : ['in-progress', 'locked'];
    const result = await db.collection('examSessions').updateOne(
      {
        _id: new ObjectId(sessionId),
        examId: examId.toString(),
        status: { $in: allowedStatuses },
      },
      update
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan atau status tidak dapat diubah.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: action === 'lock' ? 'locked' : 'disqualified',
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
