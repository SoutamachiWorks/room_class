import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export function buildExamCacheKey(examId, studentId) {
  return `exam:${examId}:student:${studentId}`;
}

export default redis;
