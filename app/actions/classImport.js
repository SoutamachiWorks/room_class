'use server';

import { getDb } from '@/lib/mongodb';
import { ClassImportDataSchema } from '@/lib/schemas';
import * as xlsx from 'xlsx';
import { z } from 'zod';

/**
 * Bulk Create Classes from Excel
 * @param {FormData} formData
 */
export async function importClassesFromExcel(formData) {
  try {
    const file = formData.get('file');
    if (!file) {
      throw new Error("File Excel tidak ditemukan.");
    }

    // 1. Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      throw new Error("File Excel kosong atau format tidak sesuai.");
    }

    // 2. Validate with Zod
    let validatedData;
    try {
      validatedData = ClassImportDataSchema.parse(jsonData);
    } catch (zodError) {
      if (zodError instanceof z.ZodError) {
        const errorMessages = zodError.errors.map(e => `Baris: ${Number(e.path[0]) + 2} -> ${e.message}`).join(', ');
        throw new Error(`Validasi Gagal: ${errorMessages}`);
      }
      throw zodError;
    }

    const db = await getDb();
    const codesToImport = validatedData.map(item => item.classCode);

    // 3. Integrity Check: Check existing classCodes
    const existingClasses = await db.collection('classCodes')
      .find({ code: { $in: codesToImport } })
      .project({ code: 1 })
      .toArray();
    
    const existingCodesSet = new Set(existingClasses.map(c => c.code));

    // 4. Prepare Bulk Operations
    const bulkOps = [];
    let successCount = 0;
    let duplicateCount = 0;
    const errorDetails = [];

    for (const item of validatedData) {
      if (existingCodesSet.has(item.classCode)) {
        duplicateCount++;
        errorDetails.push(`Kode ${item.classCode} sudah ada (Dilewati)`);
        continue;
      }

      bulkOps.push({
        insertOne: {
          document: {
            code: item.classCode,
            label: item.className,
            gradeLevel: item.gradeLevel,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        }
      });
      successCount++;
    }

    // 5. Database Operation
    if (bulkOps.length > 0) {
      await db.collection('classCodes').bulkWrite(bulkOps, { ordered: false });
    }

    return {
      success: true,
      successCount,
      duplicateCount,
      errorDetails,
      message: `Berhasil mengimpor ${successCount} kelas. ${duplicateCount} kelas dilewati karena duplikat.`
    };

  } catch (error) {
    console.error("Bulk Class Import Error:", error);
    return { 
      success: false, 
      error: error.message || "Terjadi kesalahan saat memproses file Excel." 
    };
  }
}
