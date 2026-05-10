import { ObjectId } from 'mongodb';

export const PASSING_SCORE = 75;

export function getDefaultAcademicFilters() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const academicYear = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return { academicYear };
}

export function parseAcademicFilters(request) {
  const defaults = getDefaultAcademicFilters();
  const { searchParams } = new URL(request.url);
  const academicYear =
    searchParams.get('academicYear') ||
    searchParams.get('tahunAjaran') ||
    defaults.academicYear;
  return {
    academicYear,
    classCode: searchParams.get('classCode') || '',
    subjectId: searchParams.get('subjectId') || '',
    status: searchParams.get('status') || '',
  };
}

export function getAcademicPeriodRange(filters = {}) {
  const [startYearRaw, endYearRaw] = String(filters.academicYear || '').split('/');
  const startYear = Number(startYearRaw);
  const endYear = Number(endYearRaw);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear !== startYear + 1) {
    return null;
  }

  return {
    start: new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999)),
  };
}

export function buildAcademicDateMatch(dateField, filters = {}) {
  const range = getAcademicPeriodRange(filters);
  if (!range || !dateField) return {};

  return {
    [dateField]: {
      $gte: range.start,
      $lte: range.end,
    },
  };
}

export function buildLegacyAcademicMatch(prefix = '', filters = {}) {
  const and = [];
  const field = (name) => (prefix ? `${prefix}.${name}` : name);

  if (filters.academicYear) {
    and.push({
      $or: [
        { [field('academicYear')]: filters.academicYear },
        { [field('academicYearId')]: filters.academicYear },
      ],
    });
  }

  return and.length ? { $and: and } : {};
}

export function scoreExpression() {
  return {
    $cond: [
      { $isArray: '$answers' },
      {
        $let: {
          vars: {
            numericScores: {
              $filter: {
                input: {
                  $map: {
                    input: '$answers',
                    as: 'answer',
                    in: { $convert: { input: '$$answer.score', to: 'double', onError: null, onNull: null } },
                  },
                },
                as: 'score',
                cond: { $ne: ['$$score', null] },
              },
            },
          },
          in: {
            $cond: [
              { $gt: [{ $size: '$$numericScores' }, 0] },
              { $avg: '$$numericScores' },
              null,
            ],
          },
        },
      },
      null,
    ],
  };
}

export function serializeDoc(doc) {
  return JSON.parse(JSON.stringify(doc));
}

export function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
