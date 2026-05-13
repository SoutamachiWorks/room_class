import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2, generatePresignedUrl } from '@/lib/s3Client';

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

    let materials = await db.collection('materials').aggregate(pipeline).toArray();

    materials = await Promise.all(materials.map(async (mat) => {
       if (mat.files && mat.files.length > 0) {
           mat.files = await Promise.all(mat.files.map(async (f) => ({
               ...f,
               url: await generatePresignedUrl(f.fileKey, f.originalName)
           })));
       }
       const classCodes = Array.isArray(mat.subjectDetails?.classCodes) && mat.subjectDetails.classCodes.length
         ? mat.subjectDetails.classCodes
         : [mat.subjectDetails?.classCode].filter(Boolean);
       const [totalStudents, completedCount, viewedCount] = classCodes.length
         ? await Promise.all([
             db.collection('users').countDocuments({ role: 'student', classCode: { $in: classCodes } }),
             db.collection('materialProgress').countDocuments({
               materialId: mat._id.toString(),
               classCode: { $in: classCodes },
               completed: true,
             }),
             db.collection('materialProgress').countDocuments({
               materialId: mat._id.toString(),
               classCode: { $in: classCodes },
               viewedAt: { $ne: null },
             }),
           ])
         : [0, 0, 0];
       return {
         ...mat,
         completionStats: {
           totalStudents,
           completedCount,
           inProgressCount: Math.max(0, viewedCount - completedCount),
           notStartedCount: Math.max(0, totalStudents - viewedCount),
           percentage: totalStudents ? Math.round((completedCount / totalStudents) * 100) : 0,
         },
       };
    }));

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
             
             // Upload buffer directly to R2 bucket
             const r2Data = await uploadToR2(buffer, file.name, file.type, 'materials');
 
             processedFiles.push({
                 originalName: r2Data.originalName,
                 fileKey: r2Data.fileKey,
                 size: r2Data.size,
                 type: r2Data.mimeType
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
