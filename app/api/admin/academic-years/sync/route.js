import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

function deriveAcademicYearFromDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export async function POST(request) {
  try {
    await requireRole(request, 'admin');
    const db = await getDb();

    const subjects = await db.collection('subjects').find({}, { projection: { _id: 1, classCode: 1, subjectName: 1 } }).toArray();
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));

    const exams = await db.collection('exams').find({}).toArray();
    let examUpdated = 0;
    for (const exam of exams) {
      const subject = subjectMap.get(String(exam.subjectId));
      const nextAcademicYearId =
        exam.academicYearId ||
        deriveAcademicYearFromDate(exam.updatedAt) ||
        deriveAcademicYearFromDate(exam.createdAt);
      const nextClassCode = exam.classCodeSnapshot || subject?.classCode || null;
      const nextSubjectName = exam.subjectNameSnapshot || subject?.subjectName || null;

      const needsUpdate =
        exam.academicYearId !== nextAcademicYearId ||
        exam.classCodeSnapshot !== nextClassCode ||
        exam.subjectNameSnapshot !== nextSubjectName;

      if (!needsUpdate) continue;

      await db.collection('exams').updateOne(
        { _id: exam._id },
        {
          $set: {
            academicYearId: nextAcademicYearId,
            classCodeSnapshot: nextClassCode,
            subjectNameSnapshot: nextSubjectName,
            updatedAt: new Date(),
          },
        }
      );
      examUpdated += 1;
    }

    const refreshedExams = await db.collection('exams').find({}, { projection: { _id: 1, academicYearId: 1, classCodeSnapshot: 1, subjectNameSnapshot: 1 } }).toArray();
    const examMap = new Map(refreshedExams.map((e) => [e._id.toString(), e]));

    const sessions = await db.collection('examSessions').find({}).toArray();
    let sessionUpdated = 0;
    for (const session of sessions) {
      const exam = examMap.get(String(session.examId));
      const nextAcademicYearId =
        session.academicYearId ||
        exam?.academicYearId ||
        deriveAcademicYearFromDate(session.submittedAt) ||
        deriveAcademicYearFromDate(session.startedAt);
      const nextClassCode = session.classCodeSnapshot || exam?.classCodeSnapshot || null;
      const nextSubjectName = session.subjectNameSnapshot || exam?.subjectNameSnapshot || null;

      const needsUpdate =
        session.academicYearId !== nextAcademicYearId ||
        session.classCodeSnapshot !== nextClassCode ||
        session.subjectNameSnapshot !== nextSubjectName;

      if (!needsUpdate) continue;

      await db.collection('examSessions').updateOne(
        { _id: session._id },
        {
          $set: {
            academicYearId: nextAcademicYearId,
            classCodeSnapshot: nextClassCode,
            subjectNameSnapshot: nextSubjectName,
          },
        }
      );
      sessionUpdated += 1;
    }

    return NextResponse.json({
      success: true,
      updated: {
        exams: examUpdated,
        examSessions: sessionUpdated,
      },
    });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
