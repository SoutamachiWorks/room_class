import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

import { generatePresignedUrl } from '@/lib/s3Client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const rawEnrolledYears = Array.isArray(userDoc?.enrolledYears) ? userDoc.enrolledYears : [];
    const currentYear = (userDoc?.academicYearId && userDoc?.classCode)
      ? {
          yearId: `${userDoc.classCode}_${String(userDoc.academicYearId).replace(/\//g, '-')}`,
          classCode: userDoc.classCode,
          academicYear: userDoc.academicYearId,
          label: `${userDoc.academicYearId} (${userDoc.classCode})`,
          status: 'active',
        }
      : null;
    const enrolledYears = currentYear && !rawEnrolledYears.some((y) => y?.yearId === currentYear.yearId)
      ? [...rawEnrolledYears, currentYear]
      : rawEnrolledYears;

    const { searchParams } = new URL(request.url);
    const yearId = searchParams.get('yearId');

    let classCode = userDoc?.classCode;

    // Archive Mode logic: If yearId is provided and exists in history, use that classCode
    if (yearId && enrolledYears.length > 0) {
      const targetYear = enrolledYears.find(y => y.yearId === yearId);
      if (targetYear) {
        classCode = targetYear.classCode;
      }
    }

    if (!classCode) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap (classCode hilang).' }, { status: 403 });
    }

    // Find subjects matching this student's classCode
    const matchingSubjects = await db.collection('subjects').find({ classCode }).toArray();
    const subjectIds = matchingSubjects.map(s => s._id.toString());

    let materials = [];

    if (subjectIds.length > 0) {
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

      materials = await db.collection('materials').aggregate(pipeline).toArray();

      materials = await Promise.all(materials.map(async (mat) => {
        if (mat.files && mat.files.length > 0) {
            mat.files = await Promise.all(mat.files.map(async (f) => ({
                ...f,
                url: await generatePresignedUrl(f.fileKey, f.originalName)
            })));
        }
        return mat;
      }));
    }

    return NextResponse.json({ 
      materials,
      enrolledYears,
      currentYear: currentYear || {
        classCode: userDoc?.classCode || 'Tidak Diketahui',
        academicYear: userDoc?.academicYearId || 'Tidak Diketahui',
        label: userDoc?.academicYearId && userDoc?.classCode
          ? `${userDoc.academicYearId} (${userDoc.classCode})`
          : 'Data Kelas Aktif Tidak Lengkap'
      }
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
