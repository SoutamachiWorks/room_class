import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

/**
 * GET /api/admin/class-codes
 * List all class codes with optional pagination and search functionalities.
 */
export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    
    // Pagination (we fetch all normally for simple lookups, but allow for scaling)
    const rawPage = parseInt(searchParams.get('page') || '1');
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    
    // Safety caps
    const page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(100, Math.max(1, rawLimit));

    const filter = {};
    if (search) {
       filter.$or = [
          { code: { $regex: search, $options: 'i' } },
          { label: { $regex: search, $options: 'i' } }
       ];
    }

    const skip = (page - 1) * limit;

    const [classCodes, totalCount] = await Promise.all([
      db.collection('classCodes')
        .find(filter)
        .sort({ code: 1 }) // Order alphabetically by code
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('classCodes').countDocuments(filter)
    ]);

    return NextResponse.json({
       classCodes,
       pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
       }
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * POST /api/admin/class-codes
 * Create a new Class Code configuration. Prevents duplicates.
 */
export async function POST(request) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const body = await request.json();

    const { code, label } = body;

    if (!code || !label) {
       return NextResponse.json(
         { error: 'Kode dan Label kelas wajib diisi' },
         { status: 400 }
       );
    }

    // Check for exact duplicate Code strings
    const existingCode = await db.collection('classCodes').findOne({ 
       code: { $regex: `^${code}$`, $options: 'i' } 
    });

    if (existingCode) {
       return NextResponse.json({ error: 'Kode Kelas tersebut sudah digunakan' }, { status: 409 });
    }

    // Proceed mapping
    const newClassCode = {
       code,
       label,
       createdAt: new Date(),
       updatedAt: new Date()
    };

    const result = await db.collection('classCodes').insertOne(newClassCode);

    // Log this action securely
    await logActivity(db, {
       userId: admin.userId,
       userName: admin.fullName,
       action: 'create',
       target: `Kode Kelas: ${code}`,
       details: { label }
    });

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });

  } catch (err) {
    console.error('Create Class Code Error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
