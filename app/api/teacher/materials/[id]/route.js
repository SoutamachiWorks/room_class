import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2, deleteFromR2 } from '@/lib/s3Client';

/**
 * PUT /api/teacher/materials/[id]
 * Appends new file chunks resolving unlinked arrays isolating payload logic cleanly.
 */
export async function PUT(request, { params }) {
   try {
      const teacher = await requireRole(request, 'teacher');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) {
         return NextResponse.json({ error: 'Format ID Corrupt' }, { status: 400 });
      }

      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
      const teacherId = userDoc?.teacherId;
      if (!teacherId) return NextResponse.json({ error: 'Auth Failure' }, { status: 403 });

      const material = await db.collection('materials').findOne({ _id: new ObjectId(id) });
      if (!material || material.teacherId !== teacherId) {
         return NextResponse.json({ error: 'Akses Dilarang / File tidak ditemukan' }, { status: 404 });
      }

      const formData = await request.formData();
      const title = formData.get('title') || '';
      const text = formData.get('text');
      const retainedFilesJSON = formData.get('retainedFiles'); // Array of file names we want to KEEP
      const files = formData.getAll('files'); // New uploaded Files

      if (!text) {
          return NextResponse.json({ error: 'Rincian Text wajib diisi' }, { status: 400 });
      }

      // Parse retained files defensively
      let retainedFiles = [];
      try {
         retainedFiles = JSON.parse(retainedFilesJSON || '[]');
      } catch (e) {
         retainedFiles = [];
      }

      // 1. Identify which old files were explicitly deleted by the user
      const existingFiles = material.files || [];
      const filesToDelete = existingFiles.filter(f => !retainedFiles.includes(f.fileKey || f.filename));
      const filesToKeep = existingFiles.filter(f => retainedFiles.includes(f.fileKey || f.filename));

      // Attempt Bucket Cleansing
      for (const scrap of filesToDelete) {
         if (scrap.fileKey) {
             await deleteFromR2(scrap.fileKey);
         }
      }

      // 2. Process NEW incoming uploads
      const newlyProcessed = [];
      for (const file of files) {
         if (file && file.name) {
             const buffer = Buffer.from(await file.arrayBuffer());
             const r2Data = await uploadToR2(buffer, file.name, file.type, 'materials');

             newlyProcessed.push({
                 originalName: r2Data.originalName,
                 fileKey: r2Data.fileKey,
                 size: r2Data.size,
                 type: r2Data.mimeType
             });
         }
     }

     const finalFilesArray = [...filesToKeep, ...newlyProcessed];

     // Commit State Update
     await db.collection('materials').updateOne(
        { _id: new ObjectId(id) },
        {
           $set: {
              title,
              text,
              files: finalFilesArray,
              updatedAt: new Date()
           }
        }
     );

     return NextResponse.json({ success: true });

   } catch (err) {
      console.error('Material Processing Error:', err);
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
   }
}

/**
 * DELETE /api/teacher/materials/[id]
 * Physical Unlinking mechanism eradicating files tracking locally.
 */
export async function DELETE(request, { params }) {
   try {
      const teacher = await requireRole(request, 'teacher');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Format ID Corrupt' }, { status: 400 });

      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
      const teacherId = userDoc?.teacherId;
      if (!teacherId) return NextResponse.json({ error: 'Auth Failure' }, { status: 403 });

      const material = await db.collection('materials').findOne({ _id: new ObjectId(id) });
      if (!material) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });

      // RBAC Constraint strictly ensuring teachers don't wipe OTHER teachers files
      if (material.teacherId !== teacherId) {
         return NextResponse.json({ error: 'Tindakan Terlarang (Pelanggaran Wilayah Otoritas Modul)' }, { status: 403 });
      }

      // Disconnect Items from Bucket
      if (material.files && Array.isArray(material.files)) {
         for (const file of material.files) {
            if (file.fileKey) {
                await deleteFromR2(file.fileKey);
            }
         }
      }

      // Disconnect Database Instance
      await db.collection('materials').deleteOne({ _id: new ObjectId(id) });

      return NextResponse.json({ success: true });

   } catch (err) {
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
   }
}
