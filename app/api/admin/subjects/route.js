import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

function normalizeClassCodes(value) {
   const raw = Array.isArray(value) ? value : [value];
   return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))];
}

function subjectClassMatch(classCode) {
   return { $or: [{ classCode }, { classCodes: classCode }] };
}

/**
 * GET /api/admin/subjects
 * Retrieves subjects mapped directly to Teacher details via Aggegation pipeline ensuring UI gets display names.
 */
export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const classCodeFilter = searchParams.get('classCode') || ''; // Allow specific UI filtering later
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    // Build the primary match stage
    const filters = [];
    if (classCodeFilter) {
       filters.push(subjectClassMatch(classCodeFilter));
    }
    if (search) {
       filters.push({ $or: [
          { subjectName: { $regex: search, $options: 'i' } },
          { teacherId: { $regex: search, $options: 'i' } },
          { classCode: { $regex: search, $options: 'i' } },
          { classCodes: { $regex: search, $options: 'i' } }
       ] });
    }
    const matchStage = filters.length ? { $and: filters } : {};

    const aggregationPipeline = [
       { $match: matchStage },
       {
          $lookup: {
             from: 'users',
             localField: 'teacherId',
             foreignField: 'teacherId',
             as: 'teacherInfo'
          }
       },
       // Unwind safely just keeping it alive if teacher got purged bypassingly
       {
          $unwind: {
             path: '$teacherInfo',
             preserveNullAndEmptyArrays: true 
          }
       },
       {
          $project: {
             _id: 1,
             teacherId: 1,
             subjectName: 1,
             classCode: 1,
             classCodes: { $ifNull: ['$classCodes', ['$classCode']] },
             // Extract specifically just what we need safely mapped
             teacherName: { $ifNull: ['$teacherInfo.fullName', 'Unknown/Unlinked'] }
          }
       },
       { $sort: { classCode: 1, subjectName: 1 } },
       { $skip: skip },
       { $limit: limit }
    ];

    const countPipeline = [
       { $match: matchStage },
       { $count: 'total' }
    ];

    const [subjects, counts] = await Promise.all([
       db.collection('subjects').aggregate(aggregationPipeline).toArray(),
       db.collection('subjects').aggregate(countPipeline).toArray()
    ]);

    const totalCount = counts.length > 0 ? counts[0].total : 0;

    return NextResponse.json({
       subjects,
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
 * POST /api/admin/subjects
 * Creates a structural mapping binding a teacher, class, and logical string subject definition.
 */
export async function POST(request) {
   try {
     const admin = await requireRole(request, 'admin');
     const db = await getDb();
     const body = await request.json();
 
     const { teacherId, subjectName } = body;
     const classCodes = normalizeClassCodes(body.classCodes || body.classCode);
     const classCode = classCodes[0] || '';
 
     if (!teacherId || !subjectName || classCodes.length === 0) {
        return NextResponse.json(
          { error: 'Seluruh Parameter relasi (Teacher ID, Subject Name, minimal satu Class Code) wajib diisi' },
          { status: 400 }
        );
     }
 
     // Double check validation: Does the teacher actually exist?
     const verifTeacher = await db.collection('users').findOne({ role: 'teacher', teacherId });
     if (!verifTeacher) {
        return NextResponse.json({ error: 'Terdeteksi kegagalan relasi: Teacher ID tidak ditemukan dalam pangkalan parameter Guru.' }, { status: 404 });
     }
 
     // Double check validation: Does the class configuration exist?
     const validClasses = await db.collection('classCodes')
       .find({ code: { $in: classCodes } }, { projection: { code: 1 } })
       .toArray();
     const validClassSet = new Set(validClasses.map((item) => item.code));
     const invalidClasses = classCodes.filter((code) => !validClassSet.has(code));
     if (invalidClasses.length > 0) {
        return NextResponse.json({ error: `Kode Kelas referensi tidak ditemukan: ${invalidClasses.join(', ')}` }, { status: 404 });
     }
 
     // Check for overlap duplication mapping (Teacher X teaching Subject Y on any selected class)
     const existingMap = await db.collection('subjects').findOne({
        teacherId,
        subjectName: { $regex: `^${subjectName}$`, $options: 'i' },
        $or: [
          { classCode: { $in: classCodes } },
          { classCodes: { $in: classCodes } },
        ],
     });
 
     if (existingMap) {
        return NextResponse.json({ error: 'Duplikasi Terdeteksi: Guru terkait sudah disetel untuk mengajar mata pelajaran ini pada salah satu kelas yang dipilih.' }, { status: 409 });
     }
 
     // Safe deployment
     const newSubject = {
        teacherId,
        subjectName,
        classCode,
        classCodes,
        createdAt: new Date(),
        updatedAt: new Date()
     };
 
     const result = await db.collection('subjects').insertOne(newSubject);
 
     await logActivity(db, {
        userId: admin.userId,
        userName: admin.fullName,
        action: 'create',
        target: `Subjek: ${subjectName} [${classCodes.join(', ')}]`,
        details: { teacherId, classCodes }
     });
 
     return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
 
   } catch (err) {
     console.error('Create Subjects Logic Execution Fail:', err);
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }
