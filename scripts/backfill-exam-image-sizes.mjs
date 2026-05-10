import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (!key || valueParts.length === 0) return;
    process.env[key.trim()] = valueParts.join('=').trim();
  });
}

function toNumberSafe(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function main() {
  loadEnv();

  const mongoUri = process.env.MONGODB_URI;
  const mongoDb = process.env.MONGODB_DB || 'room_class';
  const bucketName = process.env.R2_BUCKET_NAME || 'roomclass-storage';
  const force = process.argv.includes('--force');

  if (!mongoUri) throw new Error('MONGODB_URI tidak ditemukan di environment.');
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('Kredensial R2 tidak lengkap. Pastikan R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY tersedia.');
  }

  const mongoClient = new MongoClient(mongoUri);
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  let scannedExams = 0;
  let scannedQuestions = 0;
  let updatedExams = 0;
  let updatedQuestions = 0;
  let skippedQuestions = 0;
  let missingObjects = 0;
  let failedHeads = 0;

  try {
    await mongoClient.connect();
    const db = mongoClient.db(mongoDb);
    const examsCol = db.collection('exams');

    const exams = await examsCol.find(
      { 'questions.imageUrl': { $exists: true, $ne: null } },
      { projection: { questions: 1 } }
    ).toArray();

    for (const exam of exams) {
      scannedExams += 1;
      const questions = Array.isArray(exam.questions) ? exam.questions : [];
      let hasChange = false;

      const patchedQuestions = await Promise.all(
        questions.map(async (q) => {
          scannedQuestions += 1;
          if (!q?.imageUrl) return q;

          const currentSize = toNumberSafe(q.imageSize);
          if (!force && currentSize > 0) {
            skippedQuestions += 1;
            return q;
          }

          try {
            const head = await r2Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: q.imageUrl }));
            const contentLength = toNumberSafe(head?.ContentLength);
            if (contentLength <= 0) {
              missingObjects += 1;
              return q;
            }
            hasChange = true;
            updatedQuestions += 1;
            return { ...q, imageSize: contentLength };
          } catch (err) {
            if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.Code === 'NoSuchKey') {
              missingObjects += 1;
            } else {
              failedHeads += 1;
              console.error(`HeadObject gagal untuk key "${q.imageUrl}":`, err?.message || err);
            }
            return q;
          }
        })
      );

      if (hasChange) {
        await examsCol.updateOne(
          { _id: new ObjectId(exam._id) },
          { $set: { questions: patchedQuestions, updatedAt: new Date() } }
        );
        updatedExams += 1;
      }
    }

    console.log('=== Backfill Exam Image Size Selesai ===');
    console.log(`Mode: ${force ? 'FORCE (hitung ulang semua)' : 'SAFE (skip imageSize > 0)'}`);
    console.log(`Exam discan: ${scannedExams}`);
    console.log(`Question discan: ${scannedQuestions}`);
    console.log(`Question diupdate: ${updatedQuestions}`);
    console.log(`Exam diupdate: ${updatedExams}`);
    console.log(`Question diskip: ${skippedQuestions}`);
    console.log(`Object tidak ditemukan: ${missingObjects}`);
    console.log(`HeadObject gagal (non-404): ${failedHeads}`);
  } finally {
    await mongoClient.close();
  }
}

main().catch((err) => {
  console.error('Backfill gagal:', err);
  process.exit(1);
});

