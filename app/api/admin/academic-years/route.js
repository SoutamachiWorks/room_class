import { NextResponse } from 'next/server';
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

export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const rows = await db.collection('academicYears')
      .find({})
      .sort({ startYear: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({
      academicYears: rows.map((row) => ({
        _id: row._id.toString(),
        label: row.label,
        startYear: row.startYear,
        endYear: row.endYear,
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const body = await request.json();

    const label = normalizeAcademicYearLabel(body?.label);
    const validation = validateAcademicYearLabel(label);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const exists = await db.collection('academicYears').findOne({ label });
    if (exists) {
      return NextResponse.json({ error: 'Tahun ajaran sudah ada.' }, { status: 409 });
    }

    const now = new Date();
    const doc = {
      label,
      startYear: validation.startYear,
      endYear: validation.endYear,
      isActive: body?.isActive !== false,
      createdAt: now,
      updatedAt: now,
    };

    if (doc.isActive) {
      await db.collection('academicYears').updateMany({ isActive: true }, { $set: { isActive: false, updatedAt: now } });
    }

    const result = await db.collection('academicYears').insertOne(doc);
    return NextResponse.json({ success: true, id: result.insertedId.toString() }, { status: 201 });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

