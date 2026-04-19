import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'submissions');

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {}
}

/**
 * PUT /api/student/submissions/[id]
 * Edits an existing submission (text + files).
 */
export async function PUT(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;

    if (!studentId) return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });

    // Verify ownership
    const existing = await db.collection('submissions').findOne({ _id: new ObjectId(id) });
    if (!existing || existing.studentId !== studentId) {
      return NextResponse.json({ error: 'Submission tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
    }

    await ensureUploadDir();

    const formData = await request.formData();
    const text = formData.get('text');
    const retainedFilesJSON = formData.get('retainedFiles');
    const files = formData.getAll('files');

    let retainedFiles = [];
    try {
      retainedFiles = JSON.parse(retainedFilesJSON || '[]');
    } catch (e) {
      retainedFiles = [];
    }

    // Garbage collect removed files
    const existingFiles = existing.files || [];
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
        const filename = `sub-${uniqueSuffix}-${cleanOriginal}`;
        const pathToFile = join(UPLOAD_DIR, filename);

        await writeFile(pathToFile, buffer);

        newProcessed.push({
          originalName: file.name,
          filename,
          url: `/uploads/submissions/${filename}`,
          size: file.size,
          type: file.type,
        });
      }
    }

    const assignment = await db.collection('assignments').findOne({ _id: new ObjectId(existing.assignmentId) });
    let isLate = false;
    const now = new Date();
    if (assignment && assignment.deadline) {
      if (now > new Date(assignment.deadline)) {
         isLate = true;
      }
    }

    const resolvedFiles = [...filesToKeep, ...newProcessed];

    await db.collection('submissions').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          text: text || '',
          files: resolvedFiles,
          updatedAt: now,
          isLate
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Submission update error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * DELETE /api/student/submissions/[id]
 * Deletes a student's own submission and its files.
 */
export async function DELETE(request, { params }) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;

    if (!studentId) return NextResponse.json({ error: 'Profil siswa tidak lengkap.' }, { status: 403 });

    const existing = await db.collection('submissions').findOne({ _id: new ObjectId(id) });
    if (!existing || existing.studentId !== studentId) {
      return NextResponse.json({ error: 'Submission tidak ditemukan atau bukan milik Anda.' }, { status: 404 });
    }

    // Delete physical files
    if (existing.files && Array.isArray(existing.files)) {
      for (const file of existing.files) {
        try {
          await unlink(join(UPLOAD_DIR, file.filename));
        } catch (e) {}
      }
    }

    await db.collection('submissions').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true, message: 'Submission berhasil dihapus.' });
  } catch (err) {
    console.error('Submission delete error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
