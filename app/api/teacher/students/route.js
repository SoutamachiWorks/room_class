import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

/**
 * GET /api/teacher/students
 * Finds all students that belong to the classes this teacher teaches.
 */
export async function GET(request) {
  try {
    const teacher = await requireRole(request, 'teacher');
    const db = await getDb();

    // 1. Get teacher string id
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(teacher.userId) });
    const teacherId = userDoc?.teacherId;
    if (!teacherId) return NextResponse.json({ students: [] });

    // 1. Get all subjects taught by this teacher
    const subjects = await db.collection('subjects')
      .find({ teacherId })
      .toArray();

    // 2. Extract unique class codes
    const classCodesSet = new Set(subjects.map(s => s.classCode));
    const classCodes = Array.from(classCodesSet).filter(Boolean);

    if (classCodes.length === 0) {
      return NextResponse.json({ students: [] });
    }

    // 3. Find students matching those class codes
    const students = await db.collection('users')
      .find({ role: 'student', classCode: { $in: classCodes } })
      .project({ password: 0 }) // exclude password
      .sort({ classCode: 1, fullName: 1 })
      .toArray();

    // Map students with the subjects they are taking from this teacher
    const result = students.map(student => {
      const studentSubjects = subjects
        .filter(s => s.classCode === student.classCode)
        .map(s => s.subjectName);

      return {
        ...student,
        mappedSubjects: studentSubjects
      };
    });

    return NextResponse.json({ students: result });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
