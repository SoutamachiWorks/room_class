import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// Helper ensuring physical static upload routing maps natively
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'materials');

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('Directory mapping fault:', err);
  }
}

/**
 * GET /api/teacher/materials
 * Extracts the explicit Materials posted by the specific teacher including relational class information.
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) return NextResponse.json({ error: 'Teacher Identificator Invalid' }, { status: 403 });

    // Aggregate with subjects directly to parse Subject Name / Class Code gracefully avoiding pure foreign keys
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

    const materials = await db.collection('materials').aggregate(pipeline).toArray();

    return NextResponse.json({ materials });

  } catch (err) {
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
  }
}

/**
 * POST /api/teacher/materials
 * Executes Multipart/Form-Data arrays persisting objects natively into public blocks routing payloads safely.
 */
export async function POST(request) {
   try {
     const teacher = await requireRole(request, 'teacher');
     const db = await getDb();
 
     const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
     const teacherId = userDoc?.teacherId;
 
     if (!teacherId) return NextResponse.json({ error: 'Auth Failure' }, { status: 403 });
 
     await ensureUploadDir();
 
     const formData = await request.formData();
     const subjectId = formData.get('subjectId');
     const title = formData.get('title') || '';
     const text = formData.get('text');
     const files = formData.getAll('files'); // Extract multi-files Array
 
     if (!subjectId || !text) {
         return NextResponse.json({ error: 'Pilihan Subjek dan Rincian Text Materi wajib ada.' }, { status: 400 });
     }
 
     // Enforce Validation mapping Subject Ownership strictly
     const verifySubject = await db.collection('subjects').findOne({ _id: new ObjectId(subjectId), teacherId });
     if (!verifySubject) {
         return NextResponse.json({ error: 'Restriksi Sistem Gagal: Subjek ini tidak berkaitan dengan otorisasi akun Anda.' }, { status: 403 });
     }
 
     const processedFiles = [];
     for (const file of files) {
         if (file && file.name) {
             const buffer = Buffer.from(await file.arrayBuffer());
             const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
             
             // Strip weird characters out of Original Name replacing natively with sanitizers
             const cleanOriginal = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
             const filename = `${uniqueSuffix}-${cleanOriginal}`;
             const pathToFile = join(UPLOAD_DIR, filename);
 
             await writeFile(pathToFile, buffer);
 
             processedFiles.push({
                 originalName: file.name,
                 filename: filename,
                 url: `/uploads/materials/${filename}`,
                 size: file.size,
                 type: file.type
             });
         }
     }
 
     const newMaterial = {
         teacherId,
         subjectId,
         title,
         text,
         files: processedFiles,
         createdAt: new Date(),
         updatedAt: new Date()
     };
 
     const result = await db.collection('materials').insertOne(newMaterial);
 
     return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
 
   } catch (err) {
     console.error('Material Processing Fatal Error:', err);
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }
