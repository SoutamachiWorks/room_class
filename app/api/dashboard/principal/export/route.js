import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { buildLegacyAcademicMatch, parseAcademicFilters, PASSING_SCORE, scoreExpression } from '@/lib/dashboardAnalytics';

async function getReportRows(db, filters) {
  const match = {
    ...buildLegacyAcademicMatch('', filters),
    status: { $in: ['submitted', 'locked'] },
  };

  return db.collection('examSessions').aggregate([
    { $match: match },
    {
      $addFields: {
        examObjectId: { $convert: { input: '$examId', to: 'objectId', onError: null, onNull: null } },
        calculatedScore: scoreExpression(),
      },
    },
    { $lookup: { from: 'exams', localField: 'examObjectId', foreignField: '_id', as: 'exam' } },
    { $unwind: { path: '$exam', preserveNullAndEmptyArrays: false } },
    { $match: buildLegacyAcademicMatch('exam', filters) },
    { $addFields: { subjectObjectId: { $convert: { input: '$exam.subjectId', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
    { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'users', localField: 'studentId', foreignField: 'studentId', as: 'student' } },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        classCodeFromCurrentYear: {
          $cond: [
            { $eq: ['$student.academicYearId', filters.academicYear] },
            '$student.classCode',
            null,
          ],
        },
        classCodeFromAcademicYear: {
          $let: {
            vars: {
              history: {
                $filter: {
                  input: { $ifNull: ['$student.enrolledYears', []] },
                  as: 'year',
                  cond: { $eq: ['$$year.academicYear', filters.academicYear] },
                },
              },
            },
            in: { $arrayElemAt: ['$$history.classCode', 0] },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        nis: '$studentId',
        nama: { $ifNull: ['$student.fullName', '$studentId'] },
        kelas: {
          $ifNull: [
            '$exam.classCodeSnapshot',
            {
              $ifNull: [
                '$classCodeSnapshot',
                {
                  $ifNull: [
                    '$classCodeFromCurrentYear',
                    { $ifNull: ['$classCodeFromAcademicYear', { $ifNull: ['$subject.classCode', '$student.classCode'] }] },
                  ],
                },
              ],
            },
          ],
        },
        mataPelajaran: { $ifNull: ['$subjectNameSnapshot', { $ifNull: ['$exam.subjectNameSnapshot', { $ifNull: ['$subject.subjectName', '$exam.title'] }] }] },
        nilai: { $round: ['$calculatedScore', 1] },
        statusLulus: {
          $cond: [{ $gte: ['$calculatedScore', PASSING_SCORE] }, 'Lulus', 'Tidak Lulus'],
        },
      },
    },
    { $match: { nilai: { $ne: null } } },
    { $sort: { kelas: 1, nama: 1, mataPelajaran: 1 } },
  ]).toArray();
}

function summarizeRows(rows) {
  const byStudent = new Map();

  for (const row of rows) {
    const key = row.nis || row.nama;
    if (!byStudent.has(key)) {
      byStudent.set(key, {
        NIS: row.nis || '-',
        Nama: row.nama || '-',
        Kelas: row.kelas || '-',
        scores: [],
      });
    }
    const entry = byStudent.get(key);
    entry[row.mataPelajaran || 'Mata Pelajaran'] = row.nilai ?? '-';
    if (typeof row.nilai === 'number') entry.scores.push(row.nilai);
  }

  return Array.from(byStudent.values()).map((entry) => {
    const average = entry.scores.length
      ? Number((entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length).toFixed(1))
      : 0;
    const { scores, ...rest } = entry;
    return {
      ...rest,
      'Rata-rata': average,
      'Status Lulus': average >= PASSING_SCORE ? 'Lulus' : 'Tidak Lulus',
    };
  });
}

export async function GET(request) {
  try {
    await requireRole(request, 'principal');
    const db = await getDb();
    const filters = parseAcademicFilters(request);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
    const rows = summarizeRows(await getReportRows(db, filters));

    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(16);
      doc.text('Laporan Rekapitulasi Nilai', 40, 42);
      doc.setFontSize(10);
      doc.text(`Tahun Ajaran: ${filters.academicYear}`, 40, 60);
      autoTable(doc, {
        startY: 82,
        head: [Object.keys(rows[0] || { NIS: '', Nama: '', Kelas: '', 'Rata-rata': '', 'Status Lulus': '' })],
        body: rows.map((row) => Object.values(row)),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [43, 45, 51] },
      });
      const finalY = doc.lastAutoTable?.finalY || 120;
      doc.text('Kepala Sekolah', 690, finalY + 48);
      doc.text('(................................)', 660, finalY + 100);

      const buffer = Buffer.from(doc.output('arraybuffer'));
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="rekap-nilai-${filters.academicYear.replace('/', '-')}.pdf"`,
        },
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rekap-nilai-${filters.academicYear.replace('/', '-')}.xlsx"`,
      },
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
