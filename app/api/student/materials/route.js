import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

import { generatePresignedUrl } from '@/lib/s3Client';

/**
 * GET /api/student/materials
 * Returns all materials scoped to the student's classCode.
 * Students have read-only access — no create, edit, or delete.
 */
export async function GET(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const classCode = userDoc?.classCode;

    if (!classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap (classCode hilang).' }, { status: 403 });
    }

    // Find subjects matching this student's classCode
    const matchingSubjects = await db.collection('subjects').find({ classCode }).toArray();
    const subjectIds = matchingSubjects.map(s => s._id.toString());

    if (subjectIds.length === 0) {
      return NextResponse.json({ materials: [] });
    }

    const pipeline = [
      { $match: { subjectId: { $in: subjectIds } } },
      {
        $addFields: {
          subjectObjectId: { $toObjectId: '$subjectId' },
        },
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectObjectId',
          foreignField: '_id',
          as: 'subjectDetails',
        },
      },
      {
        $unwind: {
          path: '$subjectDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    let materials = await db.collection('materials').aggregate(pipeline).toArray();

    materials = await Promise.all(materials.map(async (mat) => {
       if (mat.files && mat.files.length > 0) {
           mat.files = await Promise.all(mat.files.map(async (f) => ({
               ...f,
               url: await generatePresignedUrl(f.fileKey)
           })));
       }
       return mat;
    }));

    return NextResponse.json({ materials });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
