import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2, generatePresignedUrl } from '@/lib/s3Client';
import { createNotificationsForClass } from '@/lib/notification';

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

    let assignments = await db.collection('assignments').aggregate(pipeline).toArray();

    assignments = await Promise.all(assignments.map(async (asm) => {
       if (asm.files && asm.files.length > 0) {
           asm.files = await Promise.all(asm.files.map(async (f) => ({
               ...f,
               url: await generatePresignedUrl(f.fileKey)
           })));
       }
       return asm;
    }));

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
 
     const formData = await request.formData();
     const subjectId = formData.get('subjectId');
     const text = formData.get('text');
     const rubricText = formData.get('rubricText') || '';
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
             
             const r2Data = await uploadToR2(buffer, file.name, file.type, 'assignments');
 
             processedFiles.push({
                 originalName: r2Data.originalName,
                 fileKey: r2Data.fileKey,
                 size: r2Data.size,
                 type: r2Data.mimeType
             });
         }
     }
 
     const newDocument = {
         teacherId,
         subjectId,
         text,
         rubricText,
         deadline: deadlineRaw ? new Date(deadlineRaw) : null,
         files: processedFiles,
         createdAt: new Date(),
         updatedAt: new Date()
     };
 
     const result = await db.collection('assignments').insertOne(newDocument);

     // Notifikasi ke siswa
     const subjectClassCodes = Array.isArray(verifySubject?.classCodes) && verifySubject.classCodes.length
       ? verifySubject.classCodes
       : [verifySubject?.classCode].filter(Boolean);
     if (subjectClassCodes.length > 0) {
       await Promise.all(subjectClassCodes.map((classCode) => createNotificationsForClass(db, classCode, {
         title: 'Tugas Baru',
         message: `Tugas baru telah ditambahkan pada mata pelajaran ${verifySubject.subjectName}.`,
         type: 'info',
         actionUrl: `/dashboard/student/assignments`
       })));
     }

     return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
 
   } catch (err) {
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }
