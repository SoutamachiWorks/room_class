import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    // Sum sizes across collections
    let totalBytes = 0;

    // 1. Materials
    const materialsAggr = await db.collection('materials').aggregate([
      { $unwind: "$files" },
      { $group: { _id: null, total: { $sum: "$files.size" } } }
    ]).toArray();
    if (materialsAggr.length > 0) totalBytes += materialsAggr[0].total || 0;

    // 2. Assignments
    const assignmentsAggr = await db.collection('assignments').aggregate([
      { $unwind: "$files" },
      { $group: { _id: null, total: { $sum: "$files.size" } } }
    ]).toArray();
    if (assignmentsAggr.length > 0) totalBytes += assignmentsAggr[0].total || 0;

    // 3. Submissions
    const submissionsAggr = await db.collection('submissions').aggregate([
      { $unwind: "$files" },
      { $group: { _id: null, total: { $sum: "$files.size" } } }
    ]).toArray();
    if (submissionsAggr.length > 0) totalBytes += submissionsAggr[0].total || 0;

    // 4. Exam Sessions
    const examsAggr = await db.collection('examSessions').aggregate([
      { $unwind: "$answers" },
      { $unwind: { path: "$answers.uploadedFiles", preserveNullAndEmptyArrays: false } },
      { $group: { _id: null, total: { $sum: "$answers.uploadedFiles.size" } } }
    ]).toArray();
    if (examsAggr.length > 0) totalBytes += examsAggr[0].total || 0;

    return NextResponse.json({ totalBytes });
  } catch (error) {
    if (error && error.status && error.error) {
      const { status, error: authError } = handleAuthError(error);
      return NextResponse.json({ error: authError }, { status });
    }
    console.error('Storage stats failed:', error);
    return NextResponse.json({ error: 'Failed to fetch storage stats' }, { status: 500 });
  }
}
