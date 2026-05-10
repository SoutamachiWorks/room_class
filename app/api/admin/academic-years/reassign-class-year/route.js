import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

function clean(value) {
  return String(value || '').trim();
}

export async function POST(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const body = await request.json();

    const classCode = clean(body?.classCode);
    const fromAcademicYearId = clean(body?.fromAcademicYearId);
    const toAcademicYearId = clean(body?.toAcademicYearId);

    if (!classCode || !fromAcademicYearId || !toAcademicYearId) {
      return NextResponse.json(
        { error: 'classCode, fromAcademicYearId, dan toAcademicYearId wajib diisi.' },
        { status: 400 }
      );
    }

    // 1) Move exam master records for this class/year.
    const examResult = await db.collection('exams').updateMany(
      {
        classCodeSnapshot: classCode,
        academicYearId: fromAcademicYearId,
      },
      {
        $set: {
          academicYearId: toAcademicYearId,
          updatedAt: new Date(),
        },
      }
    );

    // 2) Move session records for this class/year.
    const sessionResult = await db.collection('examSessions').updateMany(
      {
        classCodeSnapshot: classCode,
        academicYearId: fromAcademicYearId,
      },
      {
        $set: {
          academicYearId: toAcademicYearId,
        },
      }
    );

    return NextResponse.json({
      success: true,
      moved: {
        exams: examResult.modifiedCount || 0,
        examSessions: sessionResult.modifiedCount || 0,
      },
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

