import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

function normalizeAcademicYearLabel(value = '') {
  return String(value || '').trim();
}

function validateAcademicYearLabel(label) {
  const match = /^(\d{4})\/(\d{4})$/.exec(label);
  if (!match) return { valid: false, error: 'Format tahun ajaran harus YYYY/YYYY. Contoh: 2025/2026.' };

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) {
    return { valid: false, error: 'Tahun akhir harus satu tahun setelah tahun awal.' };
  }

  return { valid: true, startYear: start, endYear: end };
}

async function getAcademicYearUsage(db, label) {
  const [users, exams, examSessions] = await Promise.all([
    db.collection('users').countDocuments({ academicYearId: label }),
    db.collection('exams').countDocuments({ academicYearId: label }),
    db.collection('examSessions').countDocuments({ academicYearId: label }),
  ]);

  return {
    users,
    exams,
    examSessions,
    total: users + exams + examSessions,
  };
}

function formatUsageMessage(label, usage) {
  const parts = [
    usage.users ? `${usage.users} user/siswa` : '',
    usage.exams ? `${usage.exams} ujian` : '',
    usage.examSessions ? `${usage.examSessions} sesi ujian` : '',
  ].filter(Boolean);

  return `Tahun ajaran "${label}" masih dipakai oleh ${parts.join(', ')}. Pindahkan atau hapus data terkait terlebih dahulu.`;
}

export async function PUT(request, { params }) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tahun ajaran tidak valid.' }, { status: 400 });
    }

    const body = await request.json();
    const label = normalizeAcademicYearLabel(body?.label);
    const validation = validateAcademicYearLabel(label);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const duplicate = await db.collection('academicYears').findOne({
      label,
      _id: { $ne: new ObjectId(id) },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Tahun ajaran sudah ada.' }, { status: 409 });
    }

    const now = new Date();
    const isActive = body?.isActive !== false;

    if (isActive) {
      await db.collection('academicYears').updateMany(
        { _id: { $ne: new ObjectId(id) }, isActive: true },
        { $set: { isActive: false, updatedAt: now } }
      );
    }

    const result = await db.collection('academicYears').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          label,
          startYear: validation.startYear,
          endYear: validation.endYear,
          isActive,
          updatedAt: now,
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Tahun ajaran tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tahun ajaran tidak valid.' }, { status: 400 });
    }

    const target = await db.collection('academicYears').findOne({ _id: new ObjectId(id) });
    if (!target) {
      return NextResponse.json({ error: 'Tahun ajaran tidak ditemukan.' }, { status: 404 });
    }

    const usage = await getAcademicYearUsage(db, target.label);
    if (usage.total > 0) {
      return NextResponse.json(
        {
          error: formatUsageMessage(target.label, usage),
          usage,
        },
        { status: 409 }
      );
    }

    await db.collection('academicYears').deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ success: true });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
