import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireRole(request, 'admin');

    const csv = [
      'role,fullName,username,password,email,phone,teacherId,studentId,classCode,academicYearId,isProctor',
      'teacher,Budi Santoso,,,budi.guru@example.com,08123456789,T001,,,,true',
      'student,Siti Aminah,,,siti.siswa@example.com,08129876543,,S001,10A,2026/2027',
    ].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="template-import-users.csv"',
      },
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
