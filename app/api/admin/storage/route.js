import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

function toSafeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object') {
    if (typeof value.$numberLong === 'string') {
      const parsed = Number(value.$numberLong);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value.toString === 'function') {
      const parsed = Number(value.toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  return 0;
}

function sumFileSizes(fileList) {
  if (!Array.isArray(fileList)) return 0;
  return fileList.reduce((acc, file) => {
    const size = toSafeNumber(file?.size ?? file?.fileSize ?? 0);
    return acc + size;
  }, 0);
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function getR2UsageBytes() {
  const bucket = process.env.R2_BUCKET_NAME || 'roomclass-storage';
  let continuationToken = undefined;
  let totalBytes = 0;
  let totalObjects = 0;

  do {
    const result = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    const objects = Array.isArray(result?.Contents) ? result.Contents : [];
    for (const obj of objects) {
      totalBytes += toSafeNumber(obj?.Size);
      totalObjects += 1;
    }

    continuationToken = result?.IsTruncated ? result?.NextContinuationToken : undefined;
  } while (continuationToken);

  return { totalBytes, totalObjects };
}

export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    // Primary source of truth: Cloudflare R2 actual object sizes.
    const r2Usage = await getR2UsageBytes();

    // Keep DB-based estimate for diagnostics/debug if needed.
    const db = await getDb();
    let dbEstimatedBytes = 0;
    const [materials, assignments, submissions, examSessions, exams] = await Promise.all([
      db.collection('materials').find({}, { projection: { files: 1 } }).toArray(),
      db.collection('assignments').find({}, { projection: { files: 1 } }).toArray(),
      db.collection('submissions').find({}, { projection: { files: 1 } }).toArray(),
      db.collection('examSessions').find({}, { projection: { answers: 1 } }).toArray(),
      db.collection('exams').find({}, { projection: { questions: 1 } }).toArray(),
    ]);
    for (const doc of materials) dbEstimatedBytes += sumFileSizes(doc.files);
    for (const doc of assignments) dbEstimatedBytes += sumFileSizes(doc.files);
    for (const doc of submissions) dbEstimatedBytes += sumFileSizes(doc.files);
    for (const sess of examSessions) {
      const answers = Array.isArray(sess.answers) ? sess.answers : [];
      for (const ans of answers) dbEstimatedBytes += sumFileSizes(ans.uploadedFiles);
    }
    for (const exam of exams) {
      const questions = Array.isArray(exam.questions) ? exam.questions : [];
      for (const q of questions) dbEstimatedBytes += toSafeNumber(q?.imageSize ?? 0);
    }

    return NextResponse.json({
      totalBytes: r2Usage.totalBytes,
      objectCount: r2Usage.totalObjects,
      dbEstimatedBytes,
    });
  } catch (error) {
    if (error && error.status && error.error) {
      const { status, error: authError } = handleAuthError(error);
      return NextResponse.json({ error: authError }, { status });
    }
    console.error('Storage stats failed:', error);
    return NextResponse.json({ error: 'Failed to fetch storage stats' }, { status: 500 });
  }
}
