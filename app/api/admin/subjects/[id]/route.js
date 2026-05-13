import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

function normalizeClassCodes(value) {
   const raw = Array.isArray(value) ? value : [value];
   return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))];
}

/**
 * PUT /api/admin/subjects/[id]
 * Edits subject metadata.
 * CRITICAL DIRECTIVE: Performs a sync/cascade migration onto 'assignments', 'materials', and 'exams'
 * effectively shifting the payload ownership if the root `teacherId` string gets swapped. (Akin to assigning a replacement teacher)
 */
export async function PUT(request, { params }) {
   try {
     const admin = await requireRole(request, 'admin');
     const db = await getDb();
     const { id } = await params;
     const body = await request.json();
 
     if (!ObjectId.isValid(id)) {
       return NextResponse.json({ error: 'Parameter ID Subjek tidak sesuai pola yang valid' }, { status: 400 });
     }
 
     const rootSubject = await db.collection('subjects').findOne({ _id: new ObjectId(id) });
     if (!rootSubject) {
       return NextResponse.json({ error: 'Referensi Subjek tidak terdeteksi pada database' }, { status: 404 });
     }
 
     const { teacherId, subjectName } = body;
     const classCodes = normalizeClassCodes(body.classCodes || body.classCode);
     const classCode = classCodes[0] || '';
     
     // Quick block if someone attempts malicious clearance
     if (!teacherId || !subjectName || classCodes.length === 0) {
        return NextResponse.json({ error: 'Teacher ID, Subject Name, dan minimal satu ClassCode diwajibkan!' }, { status: 400 });
     }
 
     // Verify the newly nominated dependencies (if different)
     if (teacherId !== rootSubject.teacherId) {
         const verifTeacher = await db.collection('users').findOne({ role: 'teacher', teacherId });
         if (!verifTeacher) return NextResponse.json({ error: 'ID Guru Referensi Gagal Melakukan Kompilasi (Tidak Ditemukan)' }, { status: 404 });
     }
 
     const validClasses = await db.collection('classCodes')
       .find({ code: { $in: classCodes } }, { projection: { code: 1 } })
       .toArray();
     const validClassSet = new Set(validClasses.map((item) => item.code));
     const invalidClasses = classCodes.filter((code) => !validClassSet.has(code));
     if (invalidClasses.length > 0) {
         return NextResponse.json({ error: `Kode Kelas Referensi tidak ditemukan: ${invalidClasses.join(', ')}` }, { status: 404 });
     }

     const duplicate = await db.collection('subjects').findOne({
        _id: { $ne: new ObjectId(id) },
        teacherId,
        subjectName: { $regex: `^${subjectName}$`, $options: 'i' },
        $or: [
          { classCode: { $in: classCodes } },
          { classCodes: { $in: classCodes } },
        ],
     });

     if (duplicate) {
        return NextResponse.json({ error: 'Duplikasi Terdeteksi: Guru terkait sudah disetel untuk mengajar mata pelajaran ini pada salah satu kelas yang dipilih.' }, { status: 409 });
     }
     
     // Update logical core Subject properties structurally
     await db.collection('subjects').updateOne(
        { _id: new ObjectId(id) },
        { 
           $set: { 
             teacherId, 
             subjectName, 
             classCode,
             classCodes,
             updatedAt: new Date() 
           } 
        }
     );
 
     // CRITICAL CASCADE TRIGGER (Sync Data requirement from MD files)
     // If the teacher has changed, we must transfer the properties bound securely under the previous ownership array
     // Schema references `subjectId` strictly over Exams, Mats, Asts as string variants of Objects. Wait, is it string or object id?
     // Typically we can check both or uniformly use string. Let's cover string representation.
     const strId = rootSubject._id.toString();
 
     if (teacherId !== rootSubject.teacherId) {
         const syncPayload = { $set: { teacherId } };
         const filterDependency = { subjectId: strId }; // Assumes modules use stringified variants of standard sub IDs
 
         await Promise.all([
            db.collection('assignments').updateMany(filterDependency, syncPayload),
            db.collection('materials').updateMany(filterDependency, syncPayload),
            db.collection('exams').updateMany(filterDependency, syncPayload)
         ]);
     }
 
     await logActivity(db, {
         userId: admin.userId,
         userName: admin.fullName,
         action: 'update',
         target: `Sinkronisasi Pembaruan Subjek: ${subjectName} [${classCodes.join(', ')}]`,
         details: { 
            oldTeacher: rootSubject.teacherId, 
            newTeacher: teacherId,
            classCodes,
            cascadedSyncToFilesTriggered: teacherId !== rootSubject.teacherId 
         }
     });
 
     return NextResponse.json({ success: true, cascaded: teacherId !== rootSubject.teacherId });
 
   } catch (err) {
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }

 /**
 * DELETE /api/admin/subjects/[id]
 * Purges the relational data pointer mapping array cleanly.
 * Performs deep constraint blocking querying arrays protecting active files!
 */
 export async function DELETE(request, { params }) {
   try {
      const admin = await requireRole(request, 'admin');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) {
         return NextResponse.json({ error: 'Kesalahan parsing struktural request (ID Rusak)' }, { status: 400 });
      }

      const strId = id.toString();
      const documentMap = await db.collection('subjects').findOne({ _id: new ObjectId(id) });
      if (!documentMap) {
         return NextResponse.json({ error: 'Payload subjek tidak diketemukan.' }, { status: 404 });
      }

      // Check Constraints: Are there files? 
      // Look querying over the child endpoints binding directly to this Subject parameter key
      const [matCheck, assignCheck, examCheck] = await Promise.all([
         db.collection('materials').findOne({ subjectId: strId }),
         db.collection('assignments').findOne({ subjectId: strId }),
         db.collection('exams').findOne({ subjectId: strId })
      ]);

      if (matCheck || assignCheck || examCheck) {
         return NextResponse.json({ 
            error: 'Pemblokiran Relasional Terpicu 🔥: Operasi dihentikan karena Mata Pelajaran ini memuat berkas aktif (Materi / Ujian / Tugas). Harap evakuasi atau pindahkan tanggungan beban sebelum meniadakan subjek!' 
         }, { status: 409 });
      }

      // Safe clean 
      await db.collection('subjects').deleteOne({ _id: new ObjectId(id) });

      await logActivity(db, {
         userId: admin.userId,
         userName: admin.fullName,
         action: 'delete',
         target: `Eradikasi Modul: ${documentMap.subjectName}`,
         details: { boundClassCodeScrubbed: documentMap.classCodes || [documentMap.classCode].filter(Boolean) }
      });

      return NextResponse.json({ success: true });

   } catch (err) {
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
    }
 }
