import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'assignments');
const SUBMISSION_DIR = join(process.cwd(), 'public', 'uploads', 'submissions'); // Required for nested cascading

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await mkdir(SUBMISSION_DIR, { recursive: true }); // Prepared to avoid crashes on cascaded unlinking paths natively
  } catch (err) {}
}

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

      await ensureUploadDir();

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
      const filesToDelete = existingFiles.filter(f => !retainedFiles.includes(f.filename));
      const filesToKeep = existingFiles.filter(f => retainedFiles.includes(f.filename));

      for (const scrap of filesToDelete) {
         try {
            await unlink(join(UPLOAD_DIR, scrap.filename));
         } catch (e) {}
      }

      const newProcessed = [];
      for (const file of files) {
         if (file && file.name) {
             const buffer = Buffer.from(await file.arrayBuffer());
             const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
             const cleanOriginal = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
             const filename = `asm-${uniqueSuffix}-${cleanOriginal}`;
             const pathToFile = join(UPLOAD_DIR, filename);

             await writeFile(pathToFile, buffer);

             newProcessed.push({
                 originalName: file.name,
                 filename: filename,
                 url: `/uploads/assignments/${filename}`,
                 size: file.size,
                 type: file.type
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
            try {
               await unlink(join(UPLOAD_DIR, file.filename));
            } catch (fsErr) { /* Ignored cleanly on async cascades isolating breaks */ }
         }
      }

      // --- PHASE 2: Scrub ALL Nested STUDENT Submissions Cascading Permanently ---
      // 1. Gather all linked submission arrays explicitly fetching file targets
      const connectedSubmissions = await db.collection('submissions').find({ assignmentId: strId }).toArray();
      
      // 2. Iterate each submission stripping out physical disk payloads cleanly natively
      for (const stSubmission of connectedSubmissions) {
         if (stSubmission.files && Array.isArray(stSubmission.files)) {
            for (const stFile of stSubmission.files) {
               try {
                  await unlink(join(SUBMISSION_DIR, stFile.filename));
               } catch (fsX) {}
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
