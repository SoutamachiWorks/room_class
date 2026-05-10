import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildAcademicDateMatch, buildLegacyAcademicMatch, parseAcademicFilters } from '@/lib/dashboardAnalytics';

export async function GET(request) {
  try {
    await requireRole(request, 'curriculum');
    const db = await getDb();
    const filters = parseAcademicFilters(request);

    const rows = await db.collection('examSessions').aggregate([
      { $match: { ...buildLegacyAcademicMatch('', filters), ...buildAcademicDateMatch('startedAt', filters) } },
      {
        $addFields: {
          examObjectId: { $convert: { input: '$examId', to: 'objectId', onError: null, onNull: null } },
          normalizedViolations: { $ifNull: ['$violationCount', '$exitCount'] },
        },
      },
      { $lookup: { from: 'exams', localField: 'examObjectId', foreignField: '_id', as: 'exam' } },
      { $unwind: { path: '$exam', preserveNullAndEmptyArrays: false } },
      { $match: buildLegacyAcademicMatch('exam', filters) },
      {
        $addFields: {
          subjectObjectId: { $convert: { input: '$exam.subjectId', to: 'objectId', onError: null, onNull: null } },
        },
      },
      { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$exam.subjectId',
          subjectName: { $first: { $ifNull: ['$subject.subjectName', 'Mata Pelajaran'] } },
          classCode: { $first: { $ifNull: ['$subject.classCode', '-'] } },
          totalViolations: { $sum: { $convert: { input: '$normalizedViolations', to: 'int', onError: 0, onNull: 0 } } },
          totalExams: { $sum: 1 },
        },
      },
      { $sort: { totalViolations: -1, subjectName: 1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          subjectName: 1,
          classCode: 1,
          totalViolations: 1,
          totalExams: 1,
          violationRate: {
            $cond: [
              { $gt: ['$totalExams', 0] },
              { $round: [{ $multiply: [{ $divide: ['$totalViolations', '$totalExams'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
    ]).toArray();

    return NextResponse.json({ data: rows });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
