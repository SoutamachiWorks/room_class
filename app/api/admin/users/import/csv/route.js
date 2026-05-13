import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

const ALLOWED_ROLES = ['teacher', 'student', 'principal', 'curriculum'];

function detectDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/).find((line) => line.trim()) || '';
  const delimiters = [',', ';', '\t'];

  return delimiters
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ',';
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  return rows;
}

export async function POST(request) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file CSV yang diunggah' }, { status: 400 });
    }

    const csvText = await file.text();
    const rows = parseCsv(csvText);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV kosong atau tidak sesuai format' }, { status: 400 });
    }

    const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
    const idx = {
      role: headers.indexOf('role'),
      fullName: headers.indexOf('fullname'),
      username: headers.indexOf('username'),
      password: headers.indexOf('password'),
      email: headers.indexOf('email'),
      phone: headers.indexOf('phone'),
      teacherId: headers.indexOf('teacherid'),
      studentId: headers.indexOf('studentid'),
      classCode: headers.indexOf('classcode'),
      academicYearId: headers.indexOf('academicyearid'),
      isProctor: headers.indexOf('isproctor'),
    };

    if (idx.role === -1 || idx.fullName === -1 || idx.email === -1) {
      return NextResponse.json(
        { error: 'Header wajib: role,fullName,email (header lain opsional sesuai role).' },
        { status: 400 }
      );
    }

    const errors = [];
    const docs = [];

    const seen = {
      username: new Set(),
      email: new Set(),
      teacherId: new Set(),
      studentId: new Set(),
    };

    const classCodeDocs = await db.collection('classCodes').find({}, { projection: { code: 1 } }).toArray();
    const validClassCodes = new Set(classCodeDocs.map((c) => String(c.code).toLowerCase()));

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const rawRole = (row[idx.role] || '').toLowerCase();
      const role = rawRole === 'guru' ? 'teacher' : rawRole === 'siswa' ? 'student' : rawRole;
      const fullName = (row[idx.fullName] || '').trim();
      const email = (row[idx.email] || '').trim();
      const teacherId = idx.teacherId >= 0 ? (row[idx.teacherId] || '').trim() : '';
      const studentId = idx.studentId >= 0 ? (row[idx.studentId] || '').trim() : '';
      const classCode = idx.classCode >= 0 ? (row[idx.classCode] || '').trim() : '';
      const academicYearId = idx.academicYearId >= 0 ? (row[idx.academicYearId] || '').trim() : '';
      const isProctorRaw = idx.isProctor >= 0 ? String(row[idx.isProctor] || '').trim().toLowerCase() : '';

      let username = idx.username >= 0 ? (row[idx.username] || '').trim() : '';
      const passwordRaw = idx.password >= 0 ? (row[idx.password] || '').trim() : '';

      if (!ALLOWED_ROLES.includes(role)) {
        errors.push({ row: i + 1, reason: `Role tidak valid: ${rawRole}` });
        continue;
      }
      if (!fullName || !email) {
        errors.push({ row: i + 1, reason: 'fullName atau email kosong' });
        continue;
      }

      if (role === 'teacher' && !teacherId) {
        errors.push({ row: i + 1, reason: 'teacherId wajib untuk role teacher' });
        continue;
      }

      if (role === 'student') {
        if (!studentId || !classCode) {
          errors.push({ row: i + 1, reason: 'studentId dan classCode wajib untuk role student' });
          continue;
        }
        if (!validClassCodes.has(classCode.toLowerCase())) {
          errors.push({ row: i + 1, reason: `classCode tidak ditemukan: ${classCode}` });
          continue;
        }
      }

      if (!username) {
        if (role === 'teacher') username = `teacher_${teacherId}`;
        else if (role === 'student') username = `student_${studentId}`;
        else username = email.split('@')[0] || `user_${i + 1}`;
      }

      if (seen.username.has(username) || seen.email.has(email) || (teacherId && seen.teacherId.has(teacherId)) || (studentId && seen.studentId.has(studentId))) {
        errors.push({ row: i + 1, reason: 'Duplikasi data pada file CSV' });
        continue;
      }

      seen.username.add(username);
      seen.email.add(email);
      if (teacherId) seen.teacherId.add(teacherId);
      if (studentId) seen.studentId.add(studentId);

      const finalPassword = passwordRaw || studentId || teacherId || username;
      docs.push({
        role,
        fullName,
        username,
        email,
        phone: idx.phone >= 0 ? (row[idx.phone] || '').trim() : '',
        teacherId: teacherId || undefined,
        studentId: studentId || undefined,
        classCode: classCode || undefined,
        academicYearId: academicYearId || undefined,
        isProctor: role === 'teacher' && ['1', 'true', 'yes', 'ya'].includes(isProctorRaw),
        finalPassword,
        sourceRow: i + 1,
      });
    }

    if (!docs.length) {
      return NextResponse.json({ error: 'Tidak ada data valid untuk diimport', errors }, { status: 400 });
    }

    const orChecks = [];
    const usernames = docs.map((d) => d.username);
    const emails = docs.map((d) => d.email);
    const teacherIds = docs.map((d) => d.teacherId).filter(Boolean);
    const studentIds = docs.map((d) => d.studentId).filter(Boolean);

    if (usernames.length) orChecks.push({ username: { $in: usernames } });
    if (emails.length) orChecks.push({ email: { $in: emails } });
    if (teacherIds.length) orChecks.push({ teacherId: { $in: teacherIds } });
    if (studentIds.length) orChecks.push({ studentId: { $in: studentIds } });

    const existing = orChecks.length ? await db.collection('users').find({ $or: orChecks }).toArray() : [];
    const exUser = new Set(existing.map((u) => u.username));
    const exEmail = new Set(existing.map((u) => u.email));
    const exTeacher = new Set(existing.map((u) => u.teacherId).filter(Boolean));
    const exStudent = new Set(existing.map((u) => u.studentId).filter(Boolean));

    const finalDocs = [];
    for (const d of docs) {
      if (exUser.has(d.username) || exEmail.has(d.email) || (d.teacherId && exTeacher.has(d.teacherId)) || (d.studentId && exStudent.has(d.studentId))) {
        errors.push({ row: d.sourceRow, reason: 'Duplikasi dengan data yang sudah ada di database' });
        continue;
      }

      const hashedPassword = await bcrypt.hash(d.finalPassword, 10);
      finalDocs.push({
        role: d.role,
        fullName: d.fullName,
        username: d.username,
        password: hashedPassword,
        email: d.email,
        phone: d.phone || '',
        ...(d.teacherId ? { teacherId: d.teacherId } : {}),
        ...(d.studentId ? { studentId: d.studentId } : {}),
        ...(d.classCode ? { classCode: d.classCode } : {}),
        ...(d.academicYearId ? { academicYearId: d.academicYearId } : {}),
        ...(d.role === 'student' && d.classCode && d.academicYearId ? {
          enrolledYears: [
            {
              yearId: `${d.classCode}_${String(d.academicYearId).replace(/\//g, '-')}`,
              classCode: d.classCode,
              academicYear: d.academicYearId,
              label: `${d.academicYearId} (${d.classCode})`,
              status: 'active',
              archivedAt: null,
            },
          ],
        } : {}),
        ...(d.role === 'teacher' ? { isProctor: Boolean(d.isProctor) } : {}),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (!finalDocs.length) {
      return NextResponse.json({ error: 'Semua data gagal divalidasi', errors }, { status: 400 });
    }

    const result = await db.collection('users').insertMany(finalDocs);

    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'create',
      target: `Import CSV: ${result.insertedCount} pengguna`,
      details: { successCount: result.insertedCount, failedCount: errors.length },
    });

    return NextResponse.json({
      success: true,
      successCount: result.insertedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
