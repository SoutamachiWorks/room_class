import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildLegacyAcademicMatch, parseAcademicFilters } from '@/lib/dashboardAnalytics';

export async function GET(request) {
  try {
    await requireRole(request, 'curriculum');
    const db = await getDb();
    const filters = parseAcademicFilters(request);
    const match = buildLegacyAcademicMatch('', filters);
    const statusFilter = filters.status && filters.status !== 'all' ? filters.status : '';

    if (statusFilter) {
      match.$and = [
        ...(match.$and || []),
        statusFilter === 'Pending'
          ? { $or: [{ validationStatus: 'Pending' }, { validationStatus: { $exists: false } }] }
          : statusFilter === 'NotRequired'
            ? { requiresCurriculumApproval: { $ne: true } }
          : { validationStatus: statusFilter },
      ];
    }

    const subjectMatch = filters.subjectId && filters.subjectId !== 'all'
      ? { subjectId: filters.subjectId }
      : {};

    const rows = await db.collection('exams').aggregate([
      { $match: { ...match, ...subjectMatch } },
      {
        $addFields: {
          subjectObjectId: { $convert: { input: '$subjectId', to: 'objectId', onError: null, onNull: null } },
          validationStatusNormalized: {
            $cond: [
              { $ifNull: ['$requiresCurriculumApproval', false] },
              { $ifNull: ['$validationStatus', 'Pending'] },
              'NotRequired',
            ],
          },
        },
      },
      { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      { $match: subjectMatch },
      { $lookup: { from: 'users', localField: 'teacherId', foreignField: 'teacherId', as: 'teacher' } },
      { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: { $toString: '$_id' },
          title: 1,
          teacherName: { $ifNull: ['$teacher.fullName', '$teacherId'] },
          subjectName: { $ifNull: ['$subject.subjectName', 'Mata Pelajaran'] },
          subjectId: { $toString: '$subject._id' },
          classCode: { $ifNull: ['$subject.classCode', '-'] },
          examCategory: { $ifNull: ['$examCategory', 'ulangan'] },
          requiresCurriculumApproval: { $ifNull: ['$requiresCurriculumApproval', false] },
          revisionNote: { $ifNull: ['$revisionNote', null] },
          totalQuestions: { $size: { $ifNull: ['$questions', []] } },
          createdAt: 1,
          status: '$validationStatusNormalized',
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ]).toArray();

    return NextResponse.json({ data: rows });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
