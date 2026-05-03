import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

import { generatePresignedUrl } from '@/lib/s3Client';

/**
 * GET /api/student/assignments
 * Returns all assignments scoped to the student's classCode.
 * Also checks if the student has already submitted for each assignment.
 */
export async function GET(request) {
  try {
    const student = await requireRole(request, 'student');
    const db = await getDb();

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(student.userId) });
    const studentId = userDoc?.studentId;
    const enrolledYears = userDoc?.enrolledYears || [];

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

    if (!classCode || !studentId) {
      return NextResponse.json({ error: 'Profil siswa tidak lengkap (classCode/studentId hilang).' }, { status: 403 });
    }

    // Find all subjects that match the student's classCode
    const matchingSubjects = await db.collection('subjects').find({ classCode }).toArray();
    const subjectIds = matchingSubjects.map(s => s._id.toString());

    if (subjectIds.length === 0) {
      return NextResponse.json({ assignments: [] });
    }

    // Get assignments linked to those subjects
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

    const assignments = await db.collection('assignments').aggregate(pipeline).toArray();

    // Fetch this student's submissions to map status
    const assignmentIds = assignments.map(a => a._id.toString());
    const submissions = await db.collection('submissions')
      .find({ studentId, assignmentId: { $in: assignmentIds } })
      .toArray();

    const submissionMap = {};
    for (const sub of submissions) {
      submissionMap[sub.assignmentId] = sub;
    }

    // Attach submission info to each assignment and convert R2 file paths to presigned URLs
    let result = await Promise.all(assignments.map(async (a) => {
      // Sign assignment files
      if (a.files && a.files.length > 0) {
        a.files = await Promise.all(a.files.map(async (f) => ({ ...f, url: await generatePresignedUrl(f.fileKey, f.originalName) })));
      }
      
      const sub = submissionMap[a._id.toString()] || null;
      // Sign submission files if they exist
      if (sub && sub.files && sub.files.length > 0) {
        sub.files = await Promise.all(sub.files.map(async (f) => ({ ...f, url: await generatePresignedUrl(f.fileKey, f.originalName) })));
      }

      return {
        ...a,
        submission: sub,
      };
    }));

    return NextResponse.json({ 
      assignments: result,
      enrolledYears
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
