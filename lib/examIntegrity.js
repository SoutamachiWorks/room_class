import { createHmac } from 'crypto';

const HASH_ALGORITHM = 'sha256';

function getIntegritySecret() {
  return (
    process.env.EXAM_SYNC_HMAC_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    'roomclass-dev-integrity-secret'
  );
}

export function canonicalizeAnswers(answers = {}) {
  const multipleChoice = Array.isArray(answers.multipleChoice)
    ? answers.multipleChoice.map((value) => (value === undefined ? null : value))
    : [];
  const essay = Array.isArray(answers.essay)
    ? answers.essay.map((value) => (typeof value === 'string' ? value : ''))
    : [];

  return JSON.stringify({ multipleChoice, essay });
}

export function createAnswerHash({ examId, sessionId, studentId, answers }) {
  const payload = JSON.stringify({
    examId: String(examId || ''),
    sessionId: String(sessionId || ''),
    studentId: String(studentId || ''),
    answers: canonicalizeAnswers(answers),
  });

  return createHmac(HASH_ALGORITHM, getIntegritySecret()).update(payload).digest('hex');
}

export function getAnswerHashAlgorithm() {
  return `HMAC-${HASH_ALGORITHM.toUpperCase()}`;
}

export async function checkDisconnectLock(db, session) {
  if (!session || session.status !== 'in-progress') {
    return { locked: session?.status === 'locked', session };
  }

  const lastActive = session.lastSeenAt || session.lastHeartbeatAt || session.startedAt;
  if (!lastActive) {
    return { locked: false, session };
  }

  const now = new Date();
  const lastActiveTime = new Date(lastActive);
  const gapMs = now.getTime() - lastActiveTime.getTime();

  // Heartbeat is sent every 15s. We define disconnect if gap is > 45s.
  // Grace time is 2 minutes (120s).
  const DISCONNECT_THRESHOLD_MS = 45 * 1000;
  const GRACE_TIME_MS = 120 * 1000;

  if (gapMs > DISCONNECT_THRESHOLD_MS) {
    if (gapMs > GRACE_TIME_MS) {
      const reason = 'Peserta offline/disconnect melebihi batas waktu 2 menit.';
      
      await db.collection('examSessions').updateOne(
        { _id: session._id },
        {
          $set: {
            status: 'locked',
            manualLockedAt: now,
            manualLockedBy: 'system',
            manualLockReason: reason,
            disconnectAt: lastActiveTime,
            reconnectAt: now,
            disconnectReason: 'offline/disconnect',
          },
          $push: {
            examEvents: {
              type: 'disconnect-lock',
              at: now,
              reason: reason,
              disconnectAt: lastActiveTime,
              reconnectAt: now,
              countedAsViolation: false,
            }
          }
        }
      );

      const updatedSession = {
        ...session,
        status: 'locked',
        manualLockedAt: now,
        manualLockedBy: 'system',
        manualLockReason: reason,
        disconnectAt: lastActiveTime,
        reconnectAt: now,
        disconnectReason: 'offline/disconnect',
        examEvents: [
          ...(session.examEvents || []),
          {
            type: 'disconnect-lock',
            at: now,
            reason: reason,
            disconnectAt: lastActiveTime,
            reconnectAt: now,
            countedAsViolation: false,
          }
        ]
      };

      return {
        locked: true,
        session: updatedSession,
        error: reason,
      };
    } else {
      // Reconnected within grace time. Update only log history in examEvents.
      await db.collection('examSessions').updateOne(
        { _id: session._id },
        {
          $set: {
            lastSeenAt: now,
            lastHeartbeatAt: now,
          },
          $push: {
            examEvents: {
              type: 'disconnect-reconnect-success',
              at: now,
              reason: 'Peserta terputus tetapi berhasil terhubung kembali dalam masa tenggang.',
              disconnectAt: lastActiveTime,
              reconnectAt: now,
              countedAsViolation: false,
            }
          }
        }
      );

      const updatedSession = {
        ...session,
        lastSeenAt: now,
        lastHeartbeatAt: now,
        examEvents: [
          ...(session.examEvents || []),
          {
            type: 'disconnect-reconnect-success',
            at: now,
            reason: 'Peserta terputus tetapi berhasil terhubung kembali dalam masa tenggang.',
            disconnectAt: lastActiveTime,
            reconnectAt: now,
            countedAsViolation: false,
          }
        ]
      };

      return {
        locked: false,
        session: updatedSession,
      };
    }
  }

  return { locked: false, session };
}

