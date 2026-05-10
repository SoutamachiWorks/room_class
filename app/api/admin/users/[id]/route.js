import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';
import { batchDeleteFromR2 } from '@/lib/s3Client';

/**
 * GET /api/admin/users/[id]
 * Get a single user by ID.
 */
export async function GET(request, { params }) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update user fields (except role).
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

    const existingUser = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) });

    if (!existingUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Build update object — exclude role from updates
    const updateFields = {};
    const allowedFields = ['fullName', 'username', 'email', 'phone', 'teacherId', 'studentId', 'classCode', 'academicYearId', 'isProctor'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (existingUser.role !== 'teacher' && updateFields.isProctor !== undefined) {
      delete updateFields.isProctor;
    }

    // Handle password update (re-hash if provided)
    if (body.password && body.password.trim() !== '') {
      updateFields.password = await bcrypt.hash(body.password, 12);
    }

    // Check username uniqueness if changed
    if (updateFields.username && updateFields.username !== existingUser.username) {
      const duplicate = await db.collection('users').findOne({
        username: updateFields.username,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Username sudah digunakan' },
          { status: 409 }
        );
      }
    }

    // Check teacherId uniqueness if changed
    if (updateFields.teacherId && updateFields.teacherId !== existingUser.teacherId) {
      const duplicate = await db.collection('users').findOne({
        teacherId: updateFields.teacherId,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Teacher ID sudah digunakan' },
          { status: 409 }
        );
      }
    }

    // Check studentId uniqueness if changed
    if (updateFields.studentId && updateFields.studentId !== existingUser.studentId) {
      const duplicate = await db.collection('users').findOne({
        studentId: updateFields.studentId,
        _id: { $ne: new ObjectId(id) },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Student ID sudah digunakan' },
          { status: 409 }
        );
      }
    }

    if (
      existingUser.role === 'student' &&
      updateFields.classCode &&
      updateFields.classCode !== existingUser.classCode
    ) {
      const classCodeDoc = await db.collection('classCodes').findOne({
        code: { $regex: `^${updateFields.classCode}$`, $options: 'i' },
      });
      if (!classCodeDoc) {
        return NextResponse.json(
          { error: 'Kode kelas tidak ditemukan. Buat kode kelas terlebih dahulu di menu Kode Kelas.' },
          { status: 400 }
        );
      }
    }

    updateFields.updatedAt = new Date();

    if (existingUser.role === 'student') {
      const nextClassCode = updateFields.classCode || existingUser.classCode || '';
      const nextAcademicYearId = updateFields.academicYearId || existingUser.academicYearId || '';

      if (nextClassCode && nextAcademicYearId) {
        const nextYearId = `${nextClassCode}_${String(nextAcademicYearId).replace(/\//g, '-')}`;
        const enrolledYears = Array.isArray(existingUser.enrolledYears) ? [...existingUser.enrolledYears] : [];
        const idx = enrolledYears.findIndex((item) => item?.yearId === nextYearId);
        const activeEntry = {
          yearId: nextYearId,
          classCode: nextClassCode,
          academicYear: nextAcademicYearId,
          label: `${nextAcademicYearId} (${nextClassCode})`,
          status: 'active',
          archivedAt: null,
        };

        const normalized = enrolledYears
          .filter(Boolean)
          .map((item) => ({ ...item, status: item.yearId === nextYearId ? 'active' : 'archived' }));

        if (idx >= 0) {
          normalized[idx] = { ...normalized[idx], ...activeEntry };
        } else {
          normalized.push(activeEntry);
        }

        updateFields.enrolledYears = normalized;
      }
    }

    await db
      .collection('users')
      .updateOne({ _id: new ObjectId(id) }, { $set: updateFields });

    // Log activity
    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'update',
      target: `${existingUser.role === 'teacher' ? 'Guru' : existingUser.role === 'student' ? 'Siswa' : 'Admin'}: ${existingUser.fullName}`,
      details: { updatedFields: Object.keys(updateFields).filter((k) => k !== 'password' && k !== 'updatedAt') },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Hard delete a user.
 */
export async function DELETE(request, { params }) {
  try {
    const admin = await requireRole(request, 'admin');
    const db = await getDb();
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const user = await db
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Prevent deleting yourself
    if (user._id.toString() === admin.userId) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    // Cleanup R2 files for deleted students while keeping score/grade documents.
    if (user.role === 'student') {
      const fileKeys = [];

      const submissions = await db.collection('submissions').find({
        studentId: user.studentId,
        files: { $exists: true, $not: { $size: 0 } },
      }).toArray();

      for (const submission of submissions) {
        for (const file of submission.files || []) {
          if (file?.fileKey) fileKeys.push(file.fileKey);
        }
      }

      const examSessions = await db.collection('examSessions').find({
        studentId: user.studentId,
      }).toArray();

      for (const session of examSessions) {
        for (const answer of session.answers || []) {
          for (const file of answer.uploadedFiles || []) {
            if (file?.fileKey) fileKeys.push(file.fileKey);
          }
        }
      }

      if (fileKeys.length > 0) {
        const uniqueKeys = [...new Set(fileKeys)];
        const chunkSize = 1000;
        for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
          await batchDeleteFromR2(uniqueKeys.slice(i, i + chunkSize));
        }
      }

      if (submissions.length > 0) {
        await db.collection('submissions').updateMany(
          { _id: { $in: submissions.map((s) => s._id) } },
          { $set: { files: [], isDeletedFromStorage: true, updatedAt: new Date() } }
        );
      }

      for (const session of examSessions) {
        let changed = false;
        const nextAnswers = (session.answers || []).map((answer) => {
          if (!Array.isArray(answer.uploadedFiles) || answer.uploadedFiles.length === 0) return answer;
          changed = true;
          return { ...answer, uploadedFiles: [] };
        });
        if (changed) {
          await db.collection('examSessions').updateOne(
            { _id: session._id },
            { $set: { answers: nextAnswers, updatedAt: new Date() } }
          );
        }
      }
    }

    await db.collection('users').deleteOne({ _id: new ObjectId(id) });

    // Log activity
    await logActivity(db, {
      userId: admin.userId,
      userName: admin.fullName,
      action: 'delete',
      target: `${user.role === 'teacher' ? 'Guru' : user.role === 'student' ? 'Siswa' : 'Admin'}: ${user.fullName}`,
      details: { deletedUserId: id, role: user.role, username: user.username },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
