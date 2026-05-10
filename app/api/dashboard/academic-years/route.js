import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { getDefaultAcademicFilters } from '@/lib/dashboardAnalytics';

export async function GET(request) {
  try {
    await requireRole(request, ['principal', 'curriculum', 'admin']);
    const db = await getDb();

    const rows = await db.collection('academicYears')
      .find({})
      .sort({ startYear: -1, createdAt: -1 })
      .toArray();

    const options = rows.map((row) => row.label);
    const active = rows.find((row) => row.isActive)?.label || null;
    const fallback = getDefaultAcademicFilters().academicYear;

    return NextResponse.json({
      academicYears: options.length ? options : [fallback],
      activeAcademicYear: active || fallback,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

