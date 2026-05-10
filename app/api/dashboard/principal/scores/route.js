import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildLegacyAcademicMatch, parseAcademicFilters, PASSING_SCORE, scoreExpression } from '@/lib/dashboardAnalytics';

export async function GET(request) {
  try {
    await requireRole(request, 'principal');
    const db = await getDb();
    const filters = parseAcademicFilters(request);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const rows = await db.collection('examSessions').aggregate([
      {
        $match: {
          ...buildLegacyAcademicMatch('', filters),
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
      { $addFields: { subjectObjectId: { $convert: { input: '$exam.subjectId', to: 'objectId', onError: null, onNull: null } } } },
      { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'studentId', foreignField: 'studentId', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          classCodeFromCurrentYear: {
            $cond: [
              { $eq: ['$student.academicYearId', filters.academicYear] },
              '$student.classCode',
              null,
            ],
          },
          classCodeFromAcademicYear: {
            $let: {
              vars: {
                history: {
                  $filter: {
                    input: { $ifNull: ['$student.enrolledYears', []] },
                    as: 'year',
                    cond: { $eq: ['$$year.academicYear', filters.academicYear] },
                  },
                },
              },
              in: { $arrayElemAt: ['$$history.classCode', 0] },
            },
          },
        },
      },
      ...(search ? [{
        $match: {
          $or: [
            { studentId: { $regex: search, $options: 'i' } },
            { 'student.fullName': { $regex: search, $options: 'i' } },
            {
              $or: [
                { classCodeFromCurrentYear: { $regex: search, $options: 'i' } },
                { classCodeFromAcademicYear: { $regex: search, $options: 'i' } },
              ],
            },
            { 'exam.title': { $regex: search, $options: 'i' } },
            { 'subject.subjectName': { $regex: search, $options: 'i' } },
          ],
        },
      }] : []),
      {
        $project: {
          _id: { $toString: '$_id' },
          nis: '$studentId',
          studentName: { $ifNull: ['$student.fullName', '$studentId'] },
          classCode: {
            $ifNull: [
              '$exam.classCodeSnapshot',
              {
                $ifNull: [
                  '$classCodeSnapshot',
                  {
                    $ifNull: [
                      '$classCodeFromCurrentYear',
                      { $ifNull: ['$classCodeFromAcademicYear', { $ifNull: ['$subject.classCode', '$student.classCode'] }] },
                    ],
                  },
                ],
              },
            ],
          },
          examTitle: '$exam.title',
          subjectName: { $ifNull: ['$subjectNameSnapshot', { $ifNull: ['$exam.subjectNameSnapshot', { $ifNull: ['$subject.subjectName', 'Mata Pelajaran'] }] }] },
          score: { $round: ['$calculatedScore', 1] },
          status: { $cond: [{ $gte: ['$calculatedScore', PASSING_SCORE] }, 'Lulus', 'Tidak Lulus'] },
          submittedAt: 1,
        },
      },
      { $sort: { submittedAt: -1, classCode: 1, studentName: 1 } },
      { $limit: 500 },
    ]).toArray();

    return NextResponse.json({ data: rows });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
