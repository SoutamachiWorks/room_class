'use client';

import { useEffect, useState } from 'react';
import styles from './proctor-assignment.module.css';

export default function AdminProctorAssignmentPage() {
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState([]);
  const [proctorTeachers, setProctorTeachers] = useState([]);
  const [selectedProctorByExam, setSelectedProctorByExam] = useState({});
  const [assigningExamId, setAssigningExamId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/proctor-assignment');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Gagal memuat data pengawas ujian');

        setExams(data.exams || []);
        setProctorTeachers(data.proctorTeachers || []);
        const defaults = {};
        for (const exam of data.exams || []) defaults[exam.id] = exam.proctorId || '';
        setSelectedProctorByExam(defaults);
      } catch (e) {
        setError(e.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const assignProctor = async (examId) => {
    const teacherUserId = selectedProctorByExam[examId];
    if (!teacherUserId) return;

    setAssigningExamId(examId);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/assign-proctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Gagal menyimpan pengawas ujian');

      setExams((prev) =>
        prev.map((exam) =>
          exam.id === examId
            ? {
                ...exam,
                proctorId: teacherUserId,
                proctorName: proctorTeachers.find((t) => t.userId === teacherUserId)?.fullName || exam.proctorName,
                proctorTeacherId: proctorTeachers.find((t) => t.userId === teacherUserId)?.teacherId || exam.proctorTeacherId,
              }
            : exam
        )
      );
    } catch (e) {
      alert(e.message || 'Gagal menyimpan pengawas ujian');
    } finally {
      setAssigningExamId('');
    }
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Pengawas Ujian</h1>
        <p className={styles.subtitle}>Tetapkan guru pengawas untuk ujian tertentu.</p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.card}>
        {loading ? (
          <p>Memuat data ujian...</p>
        ) : exams.length === 0 ? (
          <p>Belum ada ujian yang tersedia.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ujian</th>
                  <th>Mata Pelajaran</th>
                  <th>Pengawas Saat Ini</th>
                  <th>Set Pengawas</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td>
                      <div className={styles.stack}>
                        <strong>{exam.title}</strong>
                        <span>{exam.status}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <span>{exam.subjectName}</span>
                        <span>{exam.classCode}</span>
                      </div>
                    </td>
                    <td>
                      {exam.proctorName ? (
                        <div className={styles.stack}>
                          <span>{exam.proctorName}</span>
                          <span>{exam.proctorTeacherId}</span>
                        </div>
                      ) : (
                        <span>Belum ditetapkan</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.assignRow}>
                        <select
                          className={styles.selectInput}
                          value={selectedProctorByExam[exam.id] || ''}
                          onChange={(e) =>
                            setSelectedProctorByExam((prev) => ({
                              ...prev,
                              [exam.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Pilih guru pengawas</option>
                          {proctorTeachers.map((teacher) => (
                            <option key={teacher.userId} value={teacher.userId}>
                              {teacher.fullName} ({teacher.teacherId})
                            </option>
                          ))}
                        </select>
                        <button
                          className={styles.saveBtn}
                          onClick={() => assignProctor(exam.id)}
                          disabled={!selectedProctorByExam[exam.id] || assigningExamId === exam.id}
                        >
                          {assigningExamId === exam.id ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
