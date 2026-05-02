import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { handleAuthError } from '@/lib/auth';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { ObjectId } from 'mongodb';

/**
 * GET /api/schedules
 * Mengambil jadwal pelajaran. Mendukung filter via query string:
 * - classCode (string)
 * - teacherId (string)
 * - dayOfWeek (number)
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    const { payload } = await jose.jwtVerify(token, secret);
    
    const db = await getDb();

    const url = new URL(request.url);
    let classCode = url.searchParams.get('classCode');
    let teacherId = url.searchParams.get('teacherId');
    const dayOfWeek = url.searchParams.get('dayOfWeek');

    // Jika yang login adalah student, paksa gunakan classCode miliknya (keamanan)
    if (payload.role === 'student') {
      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(payload.userId) });
      if (userDoc && userDoc.classCode) {
        classCode = userDoc.classCode;
      }
    } else if (payload.role === 'teacher') {
      const userDoc = await db.collection('users').findOne({ _id: new ObjectId(payload.userId) });
      if (userDoc && userDoc.teacherId) {
        teacherId = userDoc.teacherId;
      }
    }

    // Bangun query
    const query = {};
    if (classCode) query.classCode = classCode;
    if (teacherId) query.teacherId = teacherId;
    if (dayOfWeek !== null && dayOfWeek !== undefined) {
      query.dayOfWeek = parseInt(dayOfWeek, 10);
    }

    // Gunakan aggregation pipeline untuk men-join data Subject dan Guru (jika perlu)
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subjectDetails'
        }
      },
      {
        $unwind: {
          path: '$subjectDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'teacherId',
          foreignField: 'teacherId', // Hubungkan dengan profile Guru
          as: 'teacherDetails'
        }
      },
      {
        $unwind: {
          path: '$teacherDetails',
          preserveNullAndEmptyArrays: true
        }
      },
      { $sort: { startTime: 1 } } // Selalu urutkan dari jam paling pagi
    ];

    const schedules = await db.collection('schedules').aggregate(pipeline).toArray();

    return NextResponse.json({ schedules });

  } catch (err) {
    // Gunakan handleAuthError jika butuh pembatasan ketat, sementara kita anggap semua user terautentikasi bisa baca.
    // Jika ada error auth, asumsikan user tidak terdaftar.
    console.error('API Schedules Error:', err);
    return NextResponse.json({ error: 'Gagal memuat jadwal' }, { status: 500 });
  }
}
