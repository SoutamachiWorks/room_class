import { NextResponse } from 'next/server';
import { requireRole, handleAuthError } from '@/lib/auth';
import * as xlsx from 'xlsx';

export async function GET(request) {
  try {
    // Only teacher or admin can download template
    const adminOrTeacher = await requireRole(request, ['admin', 'teacher']);
    
    // Create an array of arrays representing rows
    const data = [
      ['Nama Lengkap', 'NPM/NIS', 'Email', 'Kode Kelas'], // Header
      ['Contoh Siswa', '12345678', 'siswa@example.com', 'KODEKLS01'] // Example Row
    ];
    
    // Create Worksheet
    const worksheet = xlsx.utils.aoa_to_sheet(data);
    
    // Make columns wider for better formatting
    worksheet['!cols'] = [
      { wch: 30 }, // Nama Lengkap
      { wch: 15 }, // NPM/NIS
      { wch: 25 }, // Email
      { wch: 15 }  // Kode Kelas
    ];

    // Create Workbook
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Template Import');
    
    // Write to buffer
    const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Template_Import_Siswa.xlsx"'
      }
    });

  } catch (err) {
    console.error('Template Download error:', err);
    if (err.status) {
        return NextResponse.json({ error: err.error }, { status: err.status });
    }
    return NextResponse.json({ error: err.message || 'Error tidak diketahui' }, { status: 500 });
  }
}
