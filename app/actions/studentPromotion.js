'use server';

import { getDb } from '@/lib/mongodb';
import { batchDeleteFromR2 } from '@/lib/s3Client';
import { ExcelPromotionDataSchema } from '@/lib/schemas';
import * as xlsx from 'xlsx';
import { z } from 'zod';
import { ObjectId } from 'mongodb';

/**
 * Storage Cleanup: Deletes R2 files for a list of students' submissions AND exam sessions.
 * Keeps submission text, score, and grade intact.
 * Saves archivedFiles audit trail on each document.
 */
async function cleanupOldSubmissions(studentIds, sourceClassCode, newAcademicYearId) {
  try {
    const db = await getDb();
    const now = new Date();

    // ─── SUBMISSIONS ──────────────────────────────────────────────────────────
    const submissions = await db.collection('submissions').find({
      studentId: { $in: studentIds },
      files: { $exists: true, $not: { $size: 0 } },
      isDeletedFromStorage: { $ne: true }
    }).toArray();

    let fileKeysToDelete = [];

    for (const sub of submissions) {
      if (sub.files && Array.isArray(sub.files)) {
        sub.files.forEach(f => { if (f.fileKey) fileKeysToDelete.push(f.fileKey); });
      }
    }

    // ─── EXAM SESSIONS ────────────────────────────────────────────────────────
    // Find subjects for this class, then exams, then sessions
    const subjects = await db.collection('subjects').find({ classCode: sourceClassCode }).toArray();
    const subjectIds = subjects.map(s => s._id.toString());
    const exams = await db.collection('exams').find({ subjectId: { $in: subjectIds } }).toArray();
    const examIds = exams.map(e => e._id.toString());

    const examSessions = await db.collection('examSessions').find({
      examId: { $in: examIds },
      studentId: { $in: studentIds },
    }).toArray();

    const examSessionUpdates = [];
    for (const session of examSessions) {
      let hasFiles = false;
      const newAnswers = (session.answers || []).map(ans => {
        if (ans.uploadedFiles && ans.uploadedFiles.length > 0) {
          ans.uploadedFiles.filter(f => f.fileKey).forEach(f => fileKeysToDelete.push(f.fileKey));
          hasFiles = true;
          return {
            ...ans,
            uploadedFiles: [],
            archivedFiles: ans.uploadedFiles.map(f => ({
              originalName: f.originalName,
              deletedFromR2At: now,
              reason: 'class_archived'
            }))
          };
        }
        return ans;
      });
      if (hasFiles) {
        examSessionUpdates.push({ id: session._id, answers: newAnswers });
      }
    }

    // ─── BATCH DELETE FROM R2 ─────────────────────────────────────────────────
    if (fileKeysToDelete.length > 0) {
      const CHUNK = 1000;
      for (let i = 0; i < fileKeysToDelete.length; i += CHUNK) {
        await batchDeleteFromR2(fileKeysToDelete.slice(i, i + CHUNK));
      }
    }

    // ─── UPDATE SUBMISSIONS IN MONGO ──────────────────────────────────────────
    if (submissions.length > 0) {
      const submissionIds = submissions.map(s => s._id);
      await db.collection('submissions').updateMany(
        { _id: { $in: submissionIds } },
        {
          $set: { files: [], isDeletedFromStorage: true },
          $push: {
            archivedFiles: {
              $each: submissions.flatMap(s =>
                (s.files || []).map(f => ({
                  originalName: f.originalName,
                  deletedFromR2At: now,
                  reason: 'class_archived'
                }))
              )
            }
          }
        }
      );
    }

    // ─── UPDATE EXAM SESSIONS IN MONGO ───────────────────────────────────────
    for (const upd of examSessionUpdates) {
      await db.collection('examSessions').updateOne(
        { _id: upd.id },
        { $set: { answers: upd.answers } }
      );
    }

    console.log(
      `Archive cleanup: ${fileKeysToDelete.length} files deleted from R2, ` +
      `${submissions.length} submissions + ${examSessionUpdates.length} exam sessions updated.`
    );
  } catch (error) {
    console.error('Failed during storage cleanup:', error);
    // Don't throw — cleanup failure should not block the promotion
  }
}

/**
 * Saves enrollment history to each student's enrolledYears array.
 */
async function saveEnrollmentHistory(studentObjectIds, sourceClassCode, oldAcademicYearId) {
  try {
    const db = await getDb();
    const yearId = sourceClassCode + '_' + (oldAcademicYearId || 'unknown').replace(/\//g, '-');

    const historyEntry = {
      yearId,
      classCode: sourceClassCode,
      academicYear: oldAcademicYearId || 'Unknown Year',
      label: `${oldAcademicYearId || 'Unknown Year'} (${sourceClassCode})`,
      archivedAt: new Date(),
      status: 'archived'
    };

    // Use a single updateMany with a more robust filter
    // We want to push if yearId doesn't exist in enrolledYears
    // OR if enrolledYears doesn't exist at all.
    await db.collection('users').updateMany(
      {
        _id: { $in: studentObjectIds },
        role: 'student',
        enrolledYears: { $not: { $elemMatch: { yearId: yearId } } }
      },
      {
        $push: {
          enrolledYears: historyEntry
        }
      }
    );

    console.log(`History saved for ${studentObjectIds.length} students. YearId: ${yearId}`);
  } catch (error) {
    console.error('Failed to save enrollment history:', error);
  }
}

async function upsertCurrentEnrollment(studentObjectIds, classCode, academicYearId) {
  try {
    const db = await getDb();
    if (!classCode || !academicYearId || !Array.isArray(studentObjectIds) || studentObjectIds.length === 0) return;

    const yearId = `${classCode}_${String(academicYearId).replace(/\//g, '-')}`;
    const users = await db.collection('users')
      .find({ _id: { $in: studentObjectIds }, role: 'student' })
      .project({ enrolledYears: 1 })
      .toArray();

    for (const user of users) {
      const enrolled = Array.isArray(user.enrolledYears) ? [...user.enrolledYears] : [];
      const normalized = enrolled
        .filter(Boolean)
        .map((entry) => ({ ...entry, status: entry.yearId === yearId ? 'active' : 'archived' }));
      const idx = normalized.findIndex((entry) => entry.yearId === yearId);
      const activeEntry = {
        yearId,
        classCode,
        academicYear: academicYearId,
        label: `${academicYearId} (${classCode})`,
        status: 'active',
        archivedAt: null,
      };
      if (idx >= 0) normalized[idx] = { ...normalized[idx], ...activeEntry };
      else normalized.push(activeEntry);

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { enrolledYears: normalized } }
      );
    }
  } catch (error) {
    console.error('Failed to upsert current enrollment:', error);
  }
}

/**
 * Method A: Bulk Move via UI
 */
export async function promoteClassBulk(sourceClassCode, targetClassCode, newAcademicYearId) {
  try {
    if (!sourceClassCode || !targetClassCode || !newAcademicYearId) {
      throw new Error('Missing required parameters (sourceClassCode, targetClassCode, newAcademicYearId).');
    }

    const db = await getDb();

    const students = await db.collection('users').find({
      role: 'student',
      classCode: sourceClassCode,
      status: 'active'
    }).toArray();

    if (students.length === 0) {
      return { success: false, message: 'Tidak ada siswa aktif ditemukan di kelas sumber.' };
    }

    const studentIds = students.map(s => s.studentId).filter(Boolean);
    const objectIds = students.map(s => s._id);
    const oldAcademicYearId = students[0].academicYearId; // Get the year being archived
    const isGraduating = targetClassCode.toUpperCase() === 'GRADUATED';

    const updateDoc = {
      $set: {
        academicYearId: newAcademicYearId,
        updatedAt: new Date(),
        classCode: isGraduating ? 'GRADUATED' : targetClassCode,
        ...(isGraduating ? { status: 'inactive' } : {})
      }
    };

    const result = await db.collection('users').updateMany(
      { _id: { $in: objectIds } },
      updateDoc
    );

    // Save enrollment history (awaited) - use the OLD year
    await saveEnrollmentHistory(objectIds, sourceClassCode, oldAcademicYearId);
    await upsertCurrentEnrollment(objectIds, isGraduating ? 'GRADUATED' : targetClassCode, newAcademicYearId);

    // Trigger background cleanup
    if (studentIds.length > 0) {
      cleanupOldSubmissions(studentIds, sourceClassCode, newAcademicYearId).catch(console.error);
    }

    return {
      success: true,
      message: `Berhasil memindahkan ${result.modifiedCount} siswa ke kelas ${targetClassCode}.`
    };

  } catch (error) {
    console.error('Bulk promotion error:', error);
    return { success: false, error: error.message || 'Terjadi kesalahan sistem.' };
  }
}

/**
 * Method B: Excel Import
 */
export async function promoteViaExcel(formData) {
  try {
    const file = formData.get('file');
    const newAcademicYearId = formData.get('academicYearId');

    if (!file || !newAcademicYearId) {
      throw new Error('File Excel dan Academic Year ID wajib diisi.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    let validatedData;
    try {
      validatedData = ExcelPromotionDataSchema.parse(jsonData);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        const errorMessages = zodError.errors.map(e => `Baris: ${e.path[0] + 2} -> ${e.message}`).join(', ');
        throw new Error(`Validasi Data Gagal: ${errorMessages}`);
      }
      throw zodError;
    }

    const db = await getDb();

    // Group by source class for cleanup
    const nisList = [];
    const bulkOps = [];

    for (const row of validatedData) {
      nisList.push(row.nis);
      const isGraduating = row.newClassCode.toUpperCase() === 'GRADUATED';
      bulkOps.push({
        updateOne: {
          filter: { role: 'student', studentId: row.nis },
          update: {
            $set: {
              academicYearId: newAcademicYearId,
              updatedAt: new Date(),
              classCode: isGraduating ? 'GRADUATED' : row.newClassCode,
              ...(isGraduating ? { status: 'inactive' } : {})
            }
          }
        }
      });
    }

    if (bulkOps.length === 0) {
      throw new Error('Tidak ada data valid untuk diproses.');
    }

    // Capture current student mapping BEFORE update (source class/year for history + cleanup)
    const existingStudents = await db.collection('users')
      .find({ role: 'student', studentId: { $in: nisList } })
      .project({ _id: 1, studentId: 1, classCode: 1, academicYearId: 1 })
      .toArray();
    const existingByNis = new Map(existingStudents.map((s) => [s.studentId, s]));

    const result = await db.collection('users').bulkWrite(bulkOps);

    // Save enrollment history per student based on PRE-UPDATE class/year
    const byClass = {};
    for (const nis of nisList) {
      const s = existingByNis.get(nis);
      if (!s) continue;
      const cc = s.classCode;
      if (!byClass[cc]) byClass[cc] = { ids: [], oldYear: s.academicYearId };
      byClass[cc].ids.push(s._id);
    }

    for (const [classCode, group] of Object.entries(byClass)) {
      await saveEnrollmentHistory(group.ids, classCode, group.oldYear);
      const targetByNis = new Map(validatedData.map((row) => [row.nis, row.newClassCode]));
      for (const s of existingStudents.filter((item) => item.classCode === classCode)) {
        const nextClass = targetByNis.get(s.studentId);
        if (!nextClass) continue;
        await upsertCurrentEnrollment([s._id], nextClass.toUpperCase() === 'GRADUATED' ? 'GRADUATED' : nextClass, newAcademicYearId);
      }
      const sIds = existingStudents.filter(s => s.classCode === classCode).map(s => s.studentId).filter(Boolean);
      cleanupOldSubmissions(sIds, classCode, group.oldYear).catch(console.error);
    }

    return {
      success: true,
      message: `Berhasil memproses ${result.modifiedCount} siswa melalui Excel.`
    };

  } catch (error) {
    console.error('Excel promotion error:', error);
    return { success: false, error: error.message || 'Gagal memproses file Excel.' };
  }
}

/**
 * Method C: Manual Selection via UI
 */
export async function promoteManualSelection(studentMongoIds, targetClassCode, newAcademicYearId) {
  try {
    if (!studentMongoIds || studentMongoIds.length === 0 || !targetClassCode || !newAcademicYearId) {
      throw new Error('Missing required parameters.');
    }

    const db = await getDb();

    const objectIds = studentMongoIds.map(id => {
      try { return new ObjectId(id); } catch (e) { return null; }
    }).filter(Boolean);

    if (objectIds.length === 0) {
      return { success: false, error: 'Format ID siswa tidak valid.' };
    }

    // Fetch students first to get their current classCode, studentId, and year
    const students = await db.collection('users')
      .find({ _id: { $in: objectIds }, role: 'student' })
      .project({ _id: 1, studentId: 1, classCode: 1, academicYearId: 1 })
      .toArray();

    const isGraduating = targetClassCode.toUpperCase() === 'GRADUATED';

    const result = await db.collection('users').updateMany(
      { _id: { $in: objectIds }, role: 'student' },
      {
        $set: {
          academicYearId: newAcademicYearId,
          updatedAt: new Date(),
          classCode: isGraduating ? 'GRADUATED' : targetClassCode,
          ...(isGraduating ? { status: 'inactive' } : {})
        }
      }
    );

    // Group by source classCode for history + cleanup
    const byClass = {};
    for (const s of students) {
      const cc = s.classCode;
      if (!byClass[cc]) byClass[cc] = { ids: [], studentIds: [], oldYear: s.academicYearId };
      byClass[cc].ids.push(s._id);
      if (s.studentId) byClass[cc].studentIds.push(s.studentId);
    }

    for (const [classCode, group] of Object.entries(byClass)) {
      await saveEnrollmentHistory(group.ids, classCode, group.oldYear);
      await upsertCurrentEnrollment(group.ids, isGraduating ? 'GRADUATED' : targetClassCode, newAcademicYearId);
      cleanupOldSubmissions(group.studentIds, classCode, group.oldYear).catch(console.error);
    }

    return {
      success: true,
      message: `Berhasil memindahkan ${result.modifiedCount} siswa ke kelas ${targetClassCode}.`
    };

  } catch (error) {
    console.error('Manual promotion error:', error);
    return { success: false, error: error.message || 'Terjadi kesalahan sistem saat pemindahan manual.' };
  }
}
