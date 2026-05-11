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
