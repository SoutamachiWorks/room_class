import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildAcademicDateMatch, buildLegacyAcademicMatch, parseAcademicFilters, PASSING_SCORE, scoreExpression } from '@/lib/dashboardAnalytics';

export async function GET(request) {
  try {
    await requireRole(request, 'curriculum');
    const db = await getDb();
    const filters = parseAcademicFilters(request);

    const rows = await db.collection('examSessions').aggregate([
      {
        $match: {
          ...buildLegacyAcademicMatch('', filters),
          ...buildAcademicDateMatch('submittedAt', filters),
          status: { $in: ['submitted', 'locked'] },
        },
      },
      {
        $addFields: {
          examObjectId: { $convert: { input: '$examId', to: 'objectId', onError: null, onNull: null } },
          calculatedScore: scoreExpression(),
        },
      },
      { $match: { calculatedScore: { $ne: null } } },
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
          averageScore: { $avg: '$calculatedScore' },
          participants: { $sum: 1 },
          passed: {
            $sum: {
              $cond: [{ $gte: ['$calculatedScore', PASSING_SCORE] }, 1, 0],
            },
          },
        },
      },
      { $sort: { averageScore: -1, subjectName: 1 } },
      {
        $project: {
          _id: 0,
          subjectId: '$_id',
          subjectName: 1,
          classCode: 1,
          participants: 1,
          passed: 1,
          kkm: { $literal: PASSING_SCORE },
          averageScore: { $round: ['$averageScore', 1] },
          passRate: {
            $cond: [
              { $gt: ['$participants', 0] },
              { $round: [{ $multiply: [{ $divide: ['$passed', '$participants'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
    ]).toArray();

    return NextResponse.json({ data: rows, kkm: PASSING_SCORE });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
