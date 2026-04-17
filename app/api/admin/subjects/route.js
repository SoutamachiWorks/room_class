import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

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
    const matchStage = {};
    if (classCodeFilter) {
       matchStage.classCode = classCodeFilter;
    }
    if (search) {
       matchStage.$or = [
          { subjectName: { $regex: search, $options: 'i' } },
          { teacherId: { $regex: search, $options: 'i' } },
          { classCode: { $regex: search, $options: 'i' } }
       ];
    }

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
 
     const { teacherId, subjectName, classCode } = body;
 
     if (!teacherId || !subjectName || !classCode) {
        return NextResponse.json(
          { error: 'Seluruh Parameter relasi (Teacher ID, Subject Name, Class Code) wajib diisi' },
          { status: 400 }
        );
     }
 
     // Double check validation: Does the teacher actually exist?
     const verifTeacher = await db.collection('users').findOne({ role: 'teacher', teacherId });
     if (!verifTeacher) {
        return NextResponse.json({ error: 'Terdeteksi kegagalan relasi: Teacher ID tidak ditemukan dalam pangkalan parameter Guru.' }, { status: 404 });
     }
 
     // Double check validation: Does the class configuration exist?
     const verifClass = await db.collection('classCodes').findOne({ code: classCode });
     if (!verifClass) {
        return NextResponse.json({ error: 'Terdeteksi kegagalan relasi: Kode Kelas referensi tidak ditemukan dalam struktur data kelas.' }, { status: 404 });
     }
 
     // Check for exact duplication mapping (Teacher X teaching Subject Y on Class Z structurally overlaps)
     const existingMap = await db.collection('subjects').findOne({
        teacherId,
        subjectName: { $regex: `^${subjectName}$`, $options: 'i' },
        classCode
     });
 
     if (existingMap) {
        return NextResponse.json({ error: 'Duplikasi Terdeteksi: Guru terkait sudah disetel untuk mengajar mata pelajaran ini pada kelas spesifik yang sama.' }, { status: 409 });
     }
 
     // Safe deployment
     const newSubject = {
        teacherId,
        subjectName,
        classCode,
        createdAt: new Date(),
        updatedAt: new Date()
     };
 
     const result = await db.collection('subjects').insertOne(newSubject);
 
     await logActivity(db, {
        userId: admin.userId,
        userName: admin.fullName,
        action: 'create',
        target: `Subjek: ${subjectName} [${classCode}]`,
        details: { teacherId }
     });
 
     return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
 
   } catch (err) {
     console.error('Create Subjects Logic Execution Fail:', err);
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }
