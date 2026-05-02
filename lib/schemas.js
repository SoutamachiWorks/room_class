import { z } from 'zod';

export const ExcelPromotionRowSchema = z.object({
  nis: z.string({
    required_error: "Kolom 'nis' (Student ID) wajib ada",
    invalid_type_error: "Kolom 'nis' harus berupa teks atau angka",
  }).transform(val => String(val).trim()).refine(val => val.length > 0, {
    message: "NIS tidak boleh kosong",
  }),
  newClassCode: z.string({
    required_error: "Kolom 'newClassCode' wajib ada",
    invalid_type_error: "Kolom 'newClassCode' harus berupa teks atau angka",
  }).transform(val => String(val).trim()).refine(val => val.length > 0, {
    message: "newClassCode tidak boleh kosong",
  }),
});

// We expect an array of these rows
export const ExcelPromotionDataSchema = z.array(ExcelPromotionRowSchema);

export const ClassImportRowSchema = z.object({
  className: z.string({
    required_error: "Kolom 'className' wajib ada",
  }).transform(val => String(val).trim()),
  classCode: z.string({
    required_error: "Kolom 'classCode' wajib ada",
  }).transform(val => String(val).trim().toUpperCase()),
  gradeLevel: z.union([z.string(), z.number()]).transform(val => String(val).trim()),
});

export const ClassImportDataSchema = z.array(ClassImportRowSchema);
