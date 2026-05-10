'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import styles from './schedule.module.css';

const DAYS = [
  { id: 1, name: 'Senin' },
  { id: 2, name: 'Selasa' },
  { id: 3, name: 'Rabu' },
  { id: 4, name: 'Kamis' },
  { id: 5, name: 'Jumat' },
  { id: 6, name: 'Sabtu' },
];

export default function StudentSchedulePage() {
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Ambil hari ini (1-6). Jika Minggu (0), set ke Senin (1)
  const today = new Date().getDay();
  const initialDay = today === 0 ? 1 : today;
  const [selectedDay, setSelectedDay] = useState(initialDay > 6 ? 1 : initialDay);

  const [studentClassCode, setStudentClassCode] = useState('');
  
  // Real-time time untuk indikator "Sedang Berlangsung"
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update real-time clock setiap menit
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Schedules
  const fetchSchedules = useCallback(async (day) => {
    setLoading(true);
    setError('');
    try {
      // Kita panggil tanpa classCode agar server yang mendeteksi via cookie (lebih aman)
      const url = yearId
        ? `/api/schedules?dayOfWeek=${day}&yearId=${encodeURIComponent(yearId)}`
        : `/api/schedules?dayOfWeek=${day}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (res.ok) {
        setSchedules(data.schedules || []);
      } else {
        setError(data.error || 'Gagal mengambil jadwal');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    fetchSchedules(selectedDay);
  }, [selectedDay, fetchSchedules]);

  // Helper function to check if a schedule is active right now
  const isCurrentlyActive = (startTime, endTime, dayOfWeek) => {
    // Pastikan hari ini sama dengan dayOfWeek jadwal
    if (new Date().getDay() !== dayOfWeek) return false;

    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = startTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;

    const [endH, endM] = endTime.split(':').map(Number);
    const endTotal = endH * 60 + endM;

    return currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Jadwal Pelajaran</h1>
        <p className={styles.subtitle}>Daily Timeline - Pantau jadwal Anda hari ini</p>
      </header>

      {/* Day Selector Component */}
      <div className={styles.daySelector}>
        {DAYS.map(day => (
          <button
            key={day.id}
            className={`${styles.dayPill} ${selectedDay === day.id ? styles.active : ''}`}
            onClick={() => setSelectedDay(day.id)}
          >
            <span className={styles.dayName}>{day.name}</span>
          </button>
        ))}
      </div>

      {/* Timeline Component */}
      <div className={styles.timelineContainer}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className="spinner"></div>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>{error}</div>
        ) : schedules.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>☕</div>
            <p>Tidak ada jadwal pelajaran untuk hari ini.</p>
          </div>
        ) : (
          <div className={styles.timeline}>
            {schedules.map((schedule) => {
              const active = isCurrentlyActive(schedule.startTime, schedule.endTime, schedule.dayOfWeek);
              
              return (
                <div key={schedule._id} className={`${styles.timelineItem} ${active ? styles.active : ''}`}>
                  <div className={styles.timeBlock}>
                    <span className={styles.startTime}>{schedule.startTime}</span>
                    <span className={styles.endTime}>{schedule.endTime}</span>
                  </div>
                  
                  <div className={styles.timeDot}></div>
                  
                  <div className={styles.subjectCard}>
                    <h4 className={styles.subjectTitle}>
                      {schedule.subjectDetails?.subjectName || 'Mata Pelajaran'}
                    </h4>
                    <div className={styles.teacherName}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      {schedule.teacherDetails?.fullName || schedule.teacherId || 'Guru Pengampu'}
                    </div>
                    
                    {active && (
                      <div className={styles.statusWrapper}>
                        <StatusBadge variant="info">Sedang Berlangsung</StatusBadge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
