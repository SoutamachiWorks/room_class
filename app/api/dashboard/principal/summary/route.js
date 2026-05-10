import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildAcademicDateMatch, buildLegacyAcademicMatch, parseAcademicFilters, PASSING_SCORE, scoreExpression } from '@/lib/dashboardAnalytics';

function previousPeriod(filters) {
  const [start, end] = String(filters.academicYear).split('/').map(Number);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return { ...filters, academicYear: `${start - 1}/${end - 1}` };
  }
  return { ...filters };
}

function delta(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function sessionStats(db, filters) {
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
    { $lookup: { from: 'exams', localField: 'examObjectId', foreignField: '_id', as: 'exam' } },
    { $unwind: { path: '$exam', preserveNullAndEmptyArrays: true } },
    { $match: buildLegacyAcademicMatch('exam', filters) },
    {
      $group: {
        _id: null,
        completedExams: { $sum: 1 },
        gradedParticipants: { $sum: { $cond: [{ $ne: ['$calculatedScore', null] }, 1, 0] } },
        passed: { $sum: { $cond: [{ $gte: ['$calculatedScore', PASSING_SCORE] }, 1, 0] } },
      },
    },
  ]).toArray();

  const row = rows[0] || { completedExams: 0, gradedParticipants: 0, passed: 0 };
  const passRate = row.gradedParticipants > 0
    ? Number(((row.passed / row.gradedParticipants) * 100).toFixed(1))
    : 0;

  return { ...row, passRate };
}

export async function GET(request) {
  try {
    await requireRole(request, 'principal');
    const db = await getDb();
    const filters = parseAcademicFilters(request);
    const prev = previousPeriod(filters);

    const [activeStudents, previousStudents, currentStats, previousStats] = await Promise.all([
      db.collection('users').countDocuments({
        role: 'student',
        status: { $ne: 'inactive' },
        academicYearId: filters.academicYear,
      }),
      db.collection('users').countDocuments({
        role: 'student',
        status: { $ne: 'inactive' },
        academicYearId: prev.academicYear,
      }),
      sessionStats(db, filters),
      sessionStats(db, prev),
    ]);

    return NextResponse.json({
      cards: [
        {
          key: 'students',
          label: 'Siswa Aktif',
          value: activeStudents,
          delta: delta(activeStudents, previousStudents),
        },
        {
          key: 'completed',
          label: 'Ujian Selesai',
          value: currentStats.completedExams,
          delta: delta(currentStats.completedExams, previousStats.completedExams),
        },
        {
          key: 'passRate',
          label: 'Tingkat Kelulusan',
          value: currentStats.passRate,
          suffix: '%',
          delta: delta(currentStats.passRate, previousStats.passRate),
        },
      ],
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
