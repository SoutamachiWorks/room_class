import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';

/**
 * PUT /api/admin/class-codes/[id]
 * Updates a class code definition. To map cleanly over relations safely, 
 * edits to the unique `code` tag are strictly prohibited in UX. Only labels adjust.
 */
export async function PUT(request, { params }) {
   try {
     const admin = await requireRole(request, 'admin');
     const db = await getDb();
     const { id } = await params;
     const body = await request.json();
 
     if (!ObjectId.isValid(id)) {
       return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
     }
 
     const classCodeRef = await db.collection('classCodes').findOne({ _id: new ObjectId(id) });
     if (!classCodeRef) {
       return NextResponse.json({ error: 'Kode Kelas tidak ditemukan' }, { status: 404 });
     }
 
     // We intentionally only parse the label for updates out of safety
     const { label } = body;
     if (!label) {
        return NextResponse.json({ error: 'Label kelas wajib disertakan' }, { status: 400 });
     }
 
     await db.collection('classCodes').updateOne(
        { _id: new ObjectId(id) },
        { $set: { label, updatedAt: new Date() } }
     );
 
     await logActivity(db, {
         userId: admin.userId,
         userName: admin.fullName,
         action: 'update',
         target: `Kode Kelas: ${classCodeRef.code}`,
         details: { previousLabel: classCodeRef.label, newLabel: label }
     });
 
     return NextResponse.json({ success: true });
   } catch (err) {
     const { status, error } = handleAuthError(err);
     return NextResponse.json({ error }, { status });
   }
 }

 /**
 * DELETE /api/admin/class-codes/[id]
 * Attempts to permanently erase a structural class classification.
 * CRITICAL CONSTRAINT FIXTURE: Analyzes `users.classCode` AND `subjects.classCode`.
 */
 export async function DELETE(request, { params }) {
   try {
      const admin = await requireRole(request, 'admin');
      const db = await getDb();
      const { id } = await params;

      if (!ObjectId.isValid(id)) {
         return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
      }

      const targetDocument = await db.collection('classCodes').findOne({ _id: new ObjectId(id) });

      if (!targetDocument) {
         return NextResponse.json({ error: 'Data tidak terdaftar' }, { status: 404 });
      }

      // 1. Cross reference: Users Document (Enrolled Student Array Search)
      const isMappedToStudent = await db.collection('users').findOne({
         role: 'student',
         classCode: targetDocument.code
      });

      if (isMappedToStudent) {
         return NextResponse.json({ 
            error: 'Pemblokiran Keamanan Data: Kode Kelas sedang aktif digunakan oleh akun Siswa. Harap pindahkan siswa terkait sebelum penghapusan atau hapus akun siswanya terlebih dahulu.' 
         }, { status: 409 });
      }

      // 2. Cross reference: Subject Map Links (Teacher handling class references)
      const isMappedToSubject = await db.collection('subjects').findOne({
         classCode: targetDocument.code
      });

      if (isMappedToSubject) {
         return NextResponse.json({ 
            error: 'Pemblokiran Keamanan Data: Kode Kelas terikat (linked) pada pengaturan parameter Mata Pelajaran di dashboard. Harap un-link (hapus subjek yang berkaitan) lalu coba kembali.' 
         }, { status: 409 });
      }

      // Safe to scrub!
      await db.collection('classCodes').deleteOne({ _id: new ObjectId(id) });

      await logActivity(db, {
         userId: admin.userId,
         userName: admin.fullName,
         action: 'delete',
         target: `Kode Kelas: ${targetDocument.code}`,
         details: { labelInfoDeleted: targetDocument.label }
      });

      return NextResponse.json({ success: true });

   } catch (err) {
      console.error('Delete Event Execution Fail:', err);
      const { status, error } = handleAuthError(err);
      return NextResponse.json({ error }, { status });
    }
 }
