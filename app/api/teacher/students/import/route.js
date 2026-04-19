import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import * as xlsx from 'xlsx';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const adminOrTeacher = await requireRole(request, ['admin', 'teacher']);
    const db = await getDb();
    
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel using xlsx
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Output JSON array of objects (header: 1 means use the first row as headers)
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawData.length < 2) {
      return NextResponse.json({ error: 'File Excel kosong atau tidak sesuai template' }, { status: 400 });
    }

    // Process headers and map indexes
    const headers = rawData[0].map(h => typeof h === 'string' ? h.trim().toLowerCase() : '');
    const idxNama = headers.findIndex(h => h.includes('nama'));
    const idxNis = headers.findIndex(h => h.includes('npm') || h.includes('nis'));
    const idxEmail = headers.findIndex(h => h.includes('email'));
    const idxKelas = headers.findIndex(h => h.includes('kode class') || h.includes('kode kelas') || h.includes('kelas'));

    if (idxNama === -1 || idxNis === -1 || idxEmail === -1 || idxKelas === -1) {
      return NextResponse.json({ error: 'Format kolom salah. Pastikan menggunakan Template yang diberikan.' }, { status: 400 });
    }

    const studentsToProcess = [];
    const errors = [];
    const parsedEmails = new Set();
    const parsedNis = new Set();
    
    // Parse valid rows
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0 || !row.some(Boolean)) continue; // skip empty rows

        const fullName = row[idxNama] ? String(row[idxNama]).trim() : '';
        const studentId = row[idxNis] ? String(row[idxNis]).trim() : '';
        const email = row[idxEmail] ? String(row[idxEmail]).trim() : '';
        const classCode = row[idxKelas] ? String(row[idxKelas]).trim() : '';

        if (!fullName || !studentId || !email || !classCode) {
            errors.push({ row: i + 1, email, reason: 'Baris memiliki data yang kosong (incomplete)' });
            continue;
        }

        // Duplicate check within the Excel file itself
        if (parsedEmails.has(email) || parsedNis.has(studentId)) {
            errors.push({ row: i + 1, email, reason: 'Duplikasi di dalam file yang sama' });
            continue;
        }

        parsedEmails.add(email);
        parsedNis.add(studentId);

        studentsToProcess.push({ fullName, studentId, email, classCode, rowIdx: i + 1 });
    }

    if (studentsToProcess.length === 0) {
        return NextResponse.json({ error: 'Tidak ada data valid yang bisa diolah', failedCount: errors.length, errors }, { status: 400 });
    }

    // Verify existing users in DB to prevent duplicates
    const existingUsers = await db.collection('users').find({
        $or: [
            { email: { $in: Array.from(parsedEmails) } },
            { studentId: { $in: Array.from(parsedNis) } }
        ]
    }).toArray();

    const existingEmails = new Set(existingUsers.map(u => u.email));
    const existingNis = new Set(existingUsers.map(u => u.studentId));

    const readyInsertionDocs = [];

    for (const s of studentsToProcess) {
        if (existingEmails.has(s.email)) {
            errors.push({ row: s.rowIdx, email: s.email, reason: 'Email sudah terdaftar di Database' });
            continue;
        }
        if (existingNis.has(s.studentId)) {
            errors.push({ row: s.rowIdx, email: s.email, reason: `NPM/NIS (${s.studentId}) sudah terpakai` });
            continue;
        }

        // Generate username (e.g. student_12345001). To ensure extreme safety, append a fast random code if needed, but studentId should be unique
        const usernameBase = `student_${s.studentId}`;
        
        readyInsertionDocs.push({
             ...s,
             username: usernameBase,
             rawPassword: s.studentId // fallback indicator
        });
    }

    let successCount = 0;
    
    // Batch Hashing and Insertion
    if (readyInsertionDocs.length > 0) {
        // We hash passwords in parallel using Promise.all to maximize CPU usage safely
        // Using salt rounds = 10 instead of 12 for BULK operation to prevent dangerous request timeouts 
        // 10 rounds is acceptable security for academic systems and roughly 4-8 times faster than 12 rounds.
        const hashPromises = readyInsertionDocs.map(async (doc) => {
            const hashedPassword = await bcrypt.hash(doc.rawPassword, 10);
            return {
                role: 'student',
                fullName: doc.fullName,
                username: doc.username,
                password: hashedPassword,
                email: doc.email,
                phone: '-', // default
                studentId: doc.studentId,
                classCode: doc.classCode,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        });

        const finalDocs = await Promise.all(hashPromises);

        // Bulk insert to DB
        const result = await db.collection('users').insertMany(finalDocs);
        successCount = result.insertedCount;

        // Log the bulk activity
        await logActivity(db, {
            userId: adminOrTeacher.userId,
            userName: adminOrTeacher.fullName,
            action: 'create',
            target: `Import Excel: ${successCount} Siswa`,
            details: { count: successCount, firstEmail: finalDocs[0]?.email },
        });
    }

    return NextResponse.json({
        success: true,
        total: rawData.length - 1,
        successCount: successCount,
        failedCount: errors.length,
        errors: errors
    }, { status: 200 });

  } catch (err) {
    console.error('Import Error:', err);
    if (err.status) {
        return NextResponse.json({ error: err.error }, { status: err.status });
    }
    return NextResponse.json({ error: 'Gagal memproses file Excel: ' + (err.message || 'Error tidak diketahui') }, { status: 500 });
  }
}
