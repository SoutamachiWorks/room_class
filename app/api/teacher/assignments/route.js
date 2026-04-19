import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Storage allocation parameter mapping securely to physical filesystem
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'assignments');

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {}
}

/**
 * GET /api/teacher/assignments
 * Pulls all the explicit Assignments securely bounded to the logged in Teacher Id array natively.
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Validasi Profil Gagal' }, { status: 403 });

    const pipeline = [
       { $match: { teacherId } },
       {
           $addFields: {
               subjectObjectId: { $toObjectId: "$subjectId" }
           }
       },
       {
           $lookup: {
               from: 'subjects',
               localField: 'subjectObjectId',
               foreignField: '_id',
               as: 'subjectDetails'
           }
       },
       {
           $unwind: {
               path: '$subjectDetails',
               preserveNullAndEmptyArrays: true
           }
       },
       { $sort: { createdAt: -1 } }
    ];

    const assignments = await db.collection('assignments').aggregate(pipeline).toArray();
    return NextResponse.json({ assignments });

  } catch (err) {
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
  }
}

/**
 * POST /api/teacher/assignments
 * Takes Multipart Data streams extracting text schemas and piping binaries securely onto server logical paths.
 */
export async function POST(request) {
   try {
     const teacher = await requireRole(request, 'teacher');
     const db = await getDb();
 
     const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
     const teacherId = userDoc?.teacherId;
 
     if (!teacherId) return NextResponse.json({ error: 'Auth Limit Terlewati' }, { status: 403 });
 
     await ensureUploadDir();
 
     const formData = await request.formData();
     const subjectId = formData.get('subjectId');
     const text = formData.get('text');
     const deadlineRaw = formData.get('deadline');
     const files = formData.getAll('files');
 
     if (!subjectId || !text) {
         return NextResponse.json({ error: 'Kolom Pelajaran dan Keterangan wajib ditetapkan' }, { status: 400 });
     }
 
     // RBAC mapping security preventing assignments jumping ownership cleanly
     const verifySubject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId), teacherId });
     if (!verifySubject) {
         return NextResponse.json({ error: 'Peringatan Server: Otorisasi mapping subject class code ini tidak valid bagi kredensial Anda.' }, { status: 403 });
     }
 
     const processedFiles = [];
     for (const file of files) {
         if (file && file.name) {
             const buffer = Buffer.from(await file.arrayBuffer());
             const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
             
             const cleanOriginal = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
             const filename = `asm-${uniqueSuffix}-${cleanOriginal}`;
             const pathToFile = join(UPLOAD_DIR, filename);
 
             await writeFile(pathToFile, buffer);
 
             processedFiles.push({
                 originalName: file.name,
                 filename: filename,
                 url: `/uploads/assignments/${filename}`,
                 size: file.size,
                 type: file.type
             });
         }
     }
 
     const newDocument = {
         teacherId,
         subjectId,
         text,
         deadline: deadlineRaw ? new Date(deadlineRaw) : null,
         files: processedFiles,
         createdAt: new Date(),
         updatedAt: new Date()
     };
 
     const result = await db.collection('assignments').insertOne(newDocument);
 
     return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
 
   } catch (err) {
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }
