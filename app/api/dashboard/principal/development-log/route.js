import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { requireRole, handleAuthError } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireRole(request, 'principal');
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const textMatch = search
      ? { $regex: search, $options: 'i' }
      : null;

    const [exams, assignments, materials] = await Promise.all([
      db.collection('exams').aggregate([
        { $match: { createdAt: { $gte: since }, ...(textMatch ? { title: textMatch } : {}) } },
        { $addFields: { subjectObjectId: { $convert: { input: '$subjectId', to: 'objectId', onError: null, onNull: null } } } },
        { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        { $project: { type: { $literal: 'Ujian' }, title: '$title', subjectName: '$subject.subjectName', classCode: '$subject.classCode', createdAt: 1 } },
      ]).toArray(),
      db.collection('assignments').aggregate([
        { $match: { createdAt: { $gte: since }, ...(textMatch ? { text: textMatch } : {}) } },
        { $addFields: { subjectObjectId: { $convert: { input: '$subjectId', to: 'objectId', onError: null, onNull: null } } } },
        { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        { $project: { type: { $literal: 'Tugas' }, title: '$text', subjectName: '$subject.subjectName', classCode: '$subject.classCode', createdAt: 1 } },
      ]).toArray(),
      db.collection('materials').aggregate([
        { $match: { createdAt: { $gte: since }, ...(textMatch ? { title: textMatch } : {}) } },
        { $addFields: { subjectObjectId: { $convert: { input: '$subjectId', to: 'objectId', onError: null, onNull: null } } } },
        { $lookup: { from: 'subjects', localField: 'subjectObjectId', foreignField: '_id', as: 'subject' } },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
        { $project: { type: { $literal: 'Materi' }, title: '$title', subjectName: '$subject.subjectName', classCode: '$subject.classCode', createdAt: 1 } },
      ]).toArray(),
    ]);

    const logs = [...exams, ...assignments, ...materials]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 300);

    return NextResponse.json({ logs });
  } catch (err) {
    const { status, error } = handleAuthError(err);
    return NextResponse.json({ error }, { status });
  }
}
