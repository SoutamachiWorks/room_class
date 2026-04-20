import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2, deleteFromR2 } from '@/lib/s3Client';

/**
 * PUT /api/teacher/assignments/[id]
 * Modifies local assignment payloads explicitly handling physical file swaps actively natively.
 */
export async function PUT(request, { params }) {
   try {
      const teacher = await requireRole(request, 'teacher');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Parsing ID gagal' }, { status: 400 });

      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
      const teacherId = userDoc?.teacherId;
      if (!teacherId) return NextResponse.json({ error: 'Akses terbatas' }, { status: 403 });

      const targetDoc = await db.collection('assignments').findOne({ _id: new ObjectId(id) });
      if (!targetDoc || targetDoc.teacherId !== teacherId) {
         return NextResponse.json({ error: 'Entitas tidak ditemukan pada domain Anda.' }, { status: 404 });
      }

      const formData = await request.formData();
      const text = formData.get('text');
      const deadlineRaw = formData.get('deadline');
      const retainedFilesJSON = formData.get('retainedFiles'); 
      const files = formData.getAll('files'); 

      if (!text) return NextResponse.json({ error: 'Rincian instruksi Text tak diizinkan kosong' }, { status: 400 });

      let retainedFiles = [];
      try {
         retainedFiles = JSON.parse(retainedFilesJSON || '[]');
      } catch (e) {
         retainedFiles = [];
      }

      // Garbage collection over deleted obsolete files cleanly
      const existingFiles = targetDoc.files || [];
      const filesToDelete = existingFiles.filter(f => !retainedFiles.includes(f.fileKey || f.filename));
      const filesToKeep = existingFiles.filter(f => retainedFiles.includes(f.fileKey || f.filename));

      for (const scrap of filesToDelete) {
         if (scrap.fileKey) {
            await deleteFromR2(scrap.fileKey);
         }
      }

      const newProcessed = [];
      for (const file of files) {
         if (file && file.name) {
             const buffer = Buffer.from(await file.arrayBuffer());
             const r2Data = await uploadToR2(buffer, file.name, file.type, 'assignments');

             newProcessed.push({
                 originalName: r2Data.originalName,
                 fileKey: r2Data.fileKey,
                 size: r2Data.size,
                 type: r2Data.mimeType
             });
         }
     }

     const resolvedAttachments = [...filesToKeep, ...newProcessed];

     await db.collection('assignments').updateOne(
        { _id: new ObjectId(id) },
        {
           $set: {
              text,
              deadline: deadlineRaw ? new Date(deadlineRaw) : null,
              files: resolvedAttachments,
              updatedAt: new Date()
           }
        }
     );

     return NextResponse.json({ success: true });

   } catch (err) {
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
   }
}

/**
 * DELETE /api/teacher/assignments/[id]
 * !CRITICAL DATA DESTRUCTION EVENT!
 * Cascades aggressively over Native Node APIs to recursively pull out Physical Files of internal Student nested data structures!
 */
export async function DELETE(request, { params }) {
   try {
      const teacher = await requireRole(request, 'teacher');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Kode kompilasi ID rusak' }, { status: 400 });

      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
      const teacherId = userDoc?.teacherId;
      if (!teacherId) return NextResponse.json({ error: 'Hak Akses Otoritas Tidak Falid' }, { status: 403 });

      const strId = id.toString();
      const rootAssignment = await db.collection('assignments').findOne({ _id: new ObjectId(id) });
      if (!rootAssignment) return NextResponse.json({ error: 'Module Tidak Ditemukan.' }, { status: 404 });

      // Ensure we don't let a bad actor cross boundaries safely resolving strict paths natively
      if (rootAssignment.teacherId !== teacherId) {
         return NextResponse.json({ error: 'Pemblokiran Mutasi Asing Diaktifkan.' }, { status: 403 });
      }

      // --- PHASE 1: Scrub the Teacher's Assignment File Attachments ---
      if (rootAssignment.files && Array.isArray(rootAssignment.files)) {
         for (const file of rootAssignment.files) {
            if (file.fileKey) {
               await deleteFromR2(file.fileKey);
            }
         }
      }

      // --- PHASE 2: Scrub ALL Nested STUDENT Submissions Cascading Permanently ---
      // 1. Gather all linked submission arrays explicitly fetching file targets
      const connectedSubmissions = await db.collection('submissions').find({ assignmentId: strId }).toArray();
      
      // 2. Iterate each submission stripping out active cloud payloads
      for (const stSubmission of connectedSubmissions) {
         if (stSubmission.files && Array.isArray(stSubmission.files)) {
            for (const stFile of stSubmission.files) {
               if (stFile.fileKey) {
                  await deleteFromR2(stFile.fileKey);
               }
            }
         }
      }

      // 3. Drop relational structures from the DB natively using optimal hook
      if (connectedSubmissions.length > 0) {
          await db.collection('submissions').deleteMany({ assignmentId: strId });
      }

      // --- PHASE 3: Neutralize Main Document ---
      await db.collection('assignments').deleteOne({ _id: new ObjectId(id) });

      return NextResponse.json({ success: true, cascadesTriggered: connectedSubmissions.length });

   } catch (err) {
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
   }
}
