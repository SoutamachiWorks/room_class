import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildAcademicDateMatch, buildLegacyAcademicMatch, parseAcademicFilters } from '@/lib/dashboardAnalytics';

export async function GET(request) {
  try {
    await requireRole(request, 'principal');
    const db = await getDb();
    const filters = parseAcademicFilters(request);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const [examActivities, pendingQuestions] = await Promise.all([
      db.collection('examSessions').aggregate([
        {
          $match: {
            ...buildLegacyAcademicMatch('', filters),
            ...buildAcademicDateMatch('startedAt', filters),
            $or: [{ startedAt: { $gte: weekStart } }, { submittedAt: { $gte: weekStart } }],
          },
        },
        { $addFields: { examObjectId: { $convert: { input: '$examId', to: 'objectId', onError: null, onNull: null } } } },
        { $lookup: { from: 'exams', localField: 'examObjectId', foreignField: '_id', as: 'exam' } },
        { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
        { $match: buildLegacyAcademicMatch('exam', filters) },
        { $addFields: { subjectObjectId: { $convert: { input: '$exam.subjectId', to: 'objectId', onError: null, onNull: null } } } },
        { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              examId: '$examId',
              status: '$status',
              date: { $dateToString: { date: { $ifNull: ['$submittedAt', '$startedAt'] }, format: '%Y-%m-%dT%H:%M:00.000Z' } },
            },
            subjectName: { $first: { $ifNull: ['$subject.subjectName', '$exam.title'] } },
            classCode: { $first: { $ifNull: ['$subject.classCode', '-'] } },
            participants: { $sum: 1 },
            timestamp: { $max: { $ifNull: ['$submittedAt', '$startedAt'] } },
            status: { $first: '$status' },
          },
        },
        { $sort: { timestamp: -1 } },
        { $limit: 8 },
      ]).toArray(),
      db.collection('exams').aggregate([
        {
          $match: {
            ...buildLegacyAcademicMatch('', filters),
            ...buildAcademicDateMatch('createdAt', filters),
            $or: [{ validationStatus: 'Pending' }, { validationStatus: { $exists: false } }],
            createdAt: { $gte: weekStart },
          },
        },
        { $addFields: { subjectObjectId: { $convert: { input: '$subjectId', to: 'objectId', onError: null, onNull: null } } } },
        { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            type: { $literal: 'question-bank' },
            title: { $concat: ['Soal menunggu validasi: ', { $ifNull: ['$subject.subjectName', '$title'] }] },
            detail: { $ifNull: ['$subject.classCode', '-'] },
            timestamp: '$createdAt',
          },
        },
        { $sort: { timestamp: -1 } },
        { $limit: 4 },
      ]).toArray(),
    ]);

    const mappedExamActivities = examActivities.map((item) => {
      const isCompleted = item.status === 'submitted';
      const isToday = item.timestamp && new Date(item.timestamp) >= todayStart;
      return {
        type: isCompleted ? 'completed' : 'ongoing',
        title: isCompleted ? `Ujian selesai: ${item.subjectName}` : `Ujian berlangsung: ${item.subjectName}`,
        detail: isCompleted
          ? `${item.participants} peserta mengumpulkan`
          : `${item.classCode}${isToday ? ' hari ini' : ''}`,
        timestamp: item.timestamp,
      };
    });

    const activities = [...mappedExamActivities, ...pendingQuestions]
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 10);

    return NextResponse.json({ activities });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
