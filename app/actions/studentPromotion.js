'use server';

import { getDb } from '@/lib/mongodb';
import { batchDeleteFromR2 } from '@/lib/s3Client';
import { ExcelPromotionDataSchema } from '@/lib/schemas';
import * as xlsx from 'xlsx';
import { z } from 'zod';
import { ObjectId } from 'mongodb';

/**
 * Storage Cleanup: Deletes R2 files for a list of students' submissions
 * but keeps the submission text and grades intact.
 */
async function cleanupOldSubmissions(studentIds) {
  try {
    const db = await getDb();
    
    // Find all submissions for these students that still have files attached
    const submissions = await db.collection('submissions').find({
      studentId: { $in: studentIds },
      files: { $exists: true, $not: { $size: 0 } },
      isDeletedFromStorage: { $ne: true }
    }).toArray();

    if (submissions.length === 0) return;

    // Collect all file keys
    let fileKeysToDelete = [];
    for (const sub of submissions) {
      if (sub.files && Array.isArray(sub.files)) {
        sub.files.forEach(f => {
          if (f.fileKey) fileKeysToDelete.push(f.fileKey);
        });
      }
    }

    // Batch delete from R2
    if (fileKeysToDelete.length > 0) {
      await batchDeleteFromR2(fileKeysToDelete);
    }

    // Soft delete in DB: remove files but keep text and score
    const submissionIds = submissions.map(s => s._id);
    await db.collection('submissions').updateMany(
      { _id: { $in: submissionIds } },
      { 
        $set: { 
          files: [], 
          isDeletedFromStorage: true 
        } 
      }
    );

    console.log(`Cleaned up ${fileKeysToDelete.length} files from R2 for ${studentIds.length} students.`);
  } catch (error) {
    console.error("Failed during storage cleanup:", error);
    // We don't throw here to avoid failing the whole promotion process if cleanup fails
  }
}

/**
 * Method A: Bulk Move via UI
 */
export async function promoteClassBulk(sourceClassCode, targetClassCode, newAcademicYearId) {
  try {
    if (!sourceClassCode || !targetClassCode || !newAcademicYearId) {
      throw new Error("Missing required parameters (sourceClassCode, targetClassCode, newAcademicYearId).");
    }

    const db = await getDb();

    // Find the students to be promoted
    const students = await db.collection('users').find({
      role: 'student',
      classCode: sourceClassCode,
      status: 'active'
    }).toArray();

    if (students.length === 0) {
      return { success: false, message: "Tidak ada siswa aktif ditemukan di kelas sumber." };
    }

    const studentIds = students.map(s => s.studentId).filter(Boolean);

    // Determine if graduating
    const isGraduating = targetClassCode.toUpperCase() === 'GRADUATED';
    
    // Prepare update object
    const updateDoc = {
      $set: {
        academicYearId: newAcademicYearId,
        updatedAt: new Date()
      }
    };

    if (isGraduating) {
      updateDoc.$set.status = 'inactive'; // or 'graduated'
      updateDoc.$set.classCode = 'GRADUATED';
    } else {
      updateDoc.$set.classCode = targetClassCode;
    }

    // Perform bulk update
    const result = await db.collection('users').updateMany(
      { _id: { $in: students.map(s => s._id) } },
      updateDoc
    );

    // Trigger background cleanup
    if (studentIds.length > 0) {
      // Don't await this so the user isn't blocked by R2 network requests
      cleanupOldSubmissions(studentIds).catch(console.error);
    }

    return { 
      success: true, 
      message: `Berhasil memindahkan ${result.modifiedCount} siswa ke kelas ${targetClassCode}.` 
    };

  } catch (error) {
    console.error("Bulk promotion error:", error);
    return { success: false, error: error.message || "Terjadi kesalahan sistem." };
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
      throw new Error("File Excel dan Academic Year ID wajib diisi.");
    }

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    // Validate with Zod
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
    
    // Prepare BulkWrite operations
    const bulkOps = [];
    const studentIds = [];

    for (const row of validatedData) {
      studentIds.push(row.nis);
      
      const isGraduating = row.newClassCode.toUpperCase() === 'GRADUATED';
      
      const setFields = {
        academicYearId: newAcademicYearId,
        updatedAt: new Date()
      };

      if (isGraduating) {
        setFields.status = 'inactive';
        setFields.classCode = 'GRADUATED';
      } else {
        setFields.classCode = row.newClassCode;
      }

      bulkOps.push({
        updateOne: {
          filter: { role: 'student', studentId: row.nis },
          update: { $set: setFields }
        }
      });
    }

    if (bulkOps.length === 0) {
      throw new Error("Tidak ada data valid untuk diproses.");
    }

    // Execute bulkWrite
    const result = await db.collection('users').bulkWrite(bulkOps);

    // Trigger cleanup
    if (studentIds.length > 0) {
      cleanupOldSubmissions(studentIds).catch(console.error);
    }

    return { 
      success: true, 
      message: `Berhasil memproses ${result.modifiedCount} siswa melalui Excel.` 
    };

  } catch (error) {
    console.error("Excel promotion error:", error);
    return { success: false, error: error.message || "Gagal memproses file Excel." };
  }
}

/**
 * Method C: Manual Selection via UI
 */
export async function promoteManualSelection(studentMongoIds, targetClassCode, newAcademicYearId) {
  try {
    if (!studentMongoIds || studentMongoIds.length === 0 || !targetClassCode || !newAcademicYearId) {
      throw new Error("Missing required parameters (studentMongoIds, targetClassCode, newAcademicYearId).");
    }

    const db = await getDb();
    
    // Map string IDs to ObjectId
    const objectIds = studentMongoIds.map(id => {
       try { return new ObjectId(id); } catch(e) { return null; }
    }).filter(Boolean);

    if (objectIds.length === 0) {
       return { success: false, error: "Format ID siswa tidak valid." };
    }

    // Determine if graduating
    const isGraduating = targetClassCode.toUpperCase() === 'GRADUATED';
    
    // Prepare update object
    const updateDoc = {
      $set: {
        academicYearId: newAcademicYearId,
        updatedAt: new Date()
      }
    };

    if (isGraduating) {
      updateDoc.$set.status = 'inactive';
      updateDoc.$set.classCode = 'GRADUATED';
    } else {
      updateDoc.$set.classCode = targetClassCode;
    }

    // Perform bulk update
    const result = await db.collection('users').updateMany(
      { _id: { $in: objectIds }, role: 'student' },
      updateDoc
    );

    // To trigger background cleanup, we need their studentIds (NIS). Let's fetch them first.
    const students = await db.collection('users').find({ _id: { $in: objectIds } }).project({ studentId: 1 }).toArray();
    const nisList = students.map(s => s.studentId).filter(Boolean);

    // Trigger background cleanup
    if (nisList.length > 0) {
      cleanupOldSubmissions(nisList).catch(console.error);
    }

    return { 
      success: true, 
      message: `Berhasil memindahkan ${result.modifiedCount} siswa ke kelas ${targetClassCode}.` 
    };

  } catch (error) {
    console.error("Manual promotion error:", error);
    return { success: false, error: error.message || "Terjadi kesalahan sistem saat pemindahan manual." };
  }
}
