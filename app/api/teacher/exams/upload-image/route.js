import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { uploadToR2, generatePresignedUrl } from '@/lib/s3Client';

/**
 * POST /api/teacher/exams/upload-image
 * Handles image uploads for exam questions, saving them to Cloudflare R2.
 */
export async function POST(request) {
  try {
    // 1. Verify Authentication & Authorization
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;

    if (!teacherId) {
      return NextResponse.json({ error: 'Identifikasi Guru Tidak Valid' }, { status: 403 });
    }

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || !file.name) {
      return NextResponse.json({ error: 'Tidak ada file gambar yang diunggah.' }, { status:400 });
    }

    // 3. Basic Image Validation (Client already does this, but server should too)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File yang diunggah harus berupa gambar.' }, { status: 400 });
    }

    // 4. Process and Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // We use a specific folder 'exam-questions' for organization
    const r2Data = await uploadToR2(buffer, file.name, file.type, 'exam-questions');

    // 5. Generate a presigned URL for immediate preview in the builder
    const previewUrl = await generatePresignedUrl(r2Data.fileKey);
    
    return NextResponse.json({ 
      success: true, 
      imageUrl: r2Data.fileKey, // Storing the key is better practice for R2
      previewUrl, // For immediate display in the teacher UI
      fileName: r2Data.originalName 
    });

  } catch (err) {
    console.error('Exam Image Upload Fatal Error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
