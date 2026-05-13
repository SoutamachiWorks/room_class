import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

const HEADERS = ['role', 'fullName', 'username', 'password', 'email', 'phone', 'teacherId', 'studentId', 'classCode', 'academicYearId', 'isProctor'];
const DELIMITER = ';';

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/["\r\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || '';
    const search = searchParams.get('search') || '';
    const classCode = searchParams.get('classCode') || '';

    const filter = {};
    if (role && ['admin', 'teacher', 'student', 'principal', 'curriculum'].includes(role)) {
      filter.role = role;
    }
    if (classCode) {
      filter.classCode = classCode;
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { teacherId: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await db.collection('users')
      .find(filter, { projection: { password: 0 } })
      .sort({ role: 1, classCode: 1, fullName: 1 })
      .toArray();

    const lines = [
      HEADERS.join(DELIMITER),
      ...users.map((user) => [
        user.role,
        user.fullName,
        user.username,
        '',
        user.email,
        user.phone,
        user.teacherId,
        user.studentId,
        user.classCode,
        user.academicYearId,
        user.role === 'teacher' && user.isProctor ? 'true' : '',
      ].map(csvCell).join(DELIMITER)),
    ];

    return new NextResponse(`\uFEFF${lines.join('\n')}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="export-users.csv"',
      },
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
