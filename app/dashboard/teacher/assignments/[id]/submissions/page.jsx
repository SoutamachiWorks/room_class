'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';
import styles from '../../../../admin/admin.module.css';

function getClassCodes(source) {
  return Array.isArray(source?.classCodes) && source.classCodes.length
    ? source.classCodes
    : [source?.classCode].filter(Boolean);
}

function formatClassCodes(source) {
  const codes = getClassCodes(source);
  return codes.length ? codes.join(', ') : '-';
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSubmissionStatus(student) {
  if (!student.submission) return 'Belum Mengumpulkan';
  if (student.submission.requiresRevision || student.submission.status === 'revision-required') return 'Perlu Revisi';
  return student.submission.isLate ? 'Terlambat' : 'Tepat Waktu';
}

export default function TeacherSubmissionPage({ params }) {
  const router = useRouter();
  
  // Unwrap parameters cleanly matching NextJS 15+ architectural requirements
  const resolvedParams = use(params);
  const assignmentId = resolvedParams.id;

  const [assignmentMeta, setAssignmentMeta] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  // Grading states natively
  const [gradingStudentId, setGradingStudentId] = useState(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [gradeLoading, setGradeLoading] = useState(false);
  // Grading state inside the detail modal
  const [isGradingInModal, setIsGradingInModal] = useState(false);
  const [modalGradeInput, setModalGradeInput] = useState('');
  const [modalFeedbackInput, setModalFeedbackInput] = useState('');
  const [modalRequiresRevision, setModalRequiresRevision] = useState(false);
  const [modalGradeLoading, setModalGradeLoading] = useState(false);
  
  // Search and Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const itemsPerPage = 10;
  const mappedClassLabel = formatClassCodes(assignmentMeta?.subjectDetails);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/submissions`);
      const data = await res.json();
      if (res.ok) {
        setAssignmentMeta(data.assignment);
        setStudents(data.students || []);
      } else {
        alert(data.error || 'Server menolak pelacakan submission.');
      }
    } catch (err) {
      console.error('Core Logic fail:', err);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
  }, [fetchData]);

  const submitGrade = async (studentId) => {
    if (gradeInput === '' || isNaN(gradeInput)) {
      alert('Format nilai harus diisi murni dengan angka bulat.');
      return;
    }
    
    setGradeLoading(true);
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/submissions/${studentId}/grade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          score: Number(gradeInput),
          feedback: feedbackInput
        })
      });

      if (res.ok) {
        setGradingStudentId(null);
        setGradeInput('');
        setFeedbackInput('');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Eksekusi mutasi gagal, data tak simetri.');
      }
    } catch (e) {
      alert('Koneksi terputus saat meramban database.');
    } finally {
      setGradeLoading(false);
    }
  };

  const submitGradeInModal = async () => {
    if (!modalRequiresRevision && (modalGradeInput === '' || isNaN(modalGradeInput))) {
      alert('Nilai harus berupa angka.');
      return;
    }
    setModalGradeLoading(true);
    try {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}/submissions/${selectedStudentDetail.studentId}/grade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: modalGradeInput === '' ? null : Number(modalGradeInput),
          feedback: modalFeedbackInput,
          requiresRevision: modalRequiresRevision,
        })
      });
      if (res.ok) {
        // Update local state so modal reflects new values immediately
        setSelectedStudentDetail(prev => ({
          ...prev,
          submission: {
            ...prev.submission,
            score: modalGradeInput === '' ? null : Number(modalGradeInput),
            feedback: modalFeedbackInput,
            requiresRevision: modalRequiresRevision,
            status: modalRequiresRevision ? 'revision-required' : 'graded',
          }
        }));
        setIsGradingInModal(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal menyimpan nilai.');
      }
    } catch {
      alert('Koneksi gagal.');
    } finally {
      setModalGradeLoading(false);
    }
  };

  const handleDownloadAllSelected = (filesArray) => {
    filesArray.forEach(file => {
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = file.url;
      a.download = file.originalName || file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  // Calculate statistics
  const totalStudents = students.length;
  const submittedCount = students.filter(s => s.submission).length;
  const notSubmittedCount = totalStudents - submittedCount;
  const lateCount = students.filter(s => s.submission?.isLate).length;
  const gradedCount = students.filter(s => s.submission?.score !== undefined && s.submission?.score !== null).length;
  const notGradedCount = submittedCount - gradedCount;
  const averageScore = gradedCount > 0 
    ? (students.reduce((acc, s) => acc + (s.submission?.score || 0), 0) / gradedCount).toFixed(1)
    : '0';
  const progressPercentage = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  // Filter students based on active tab and search query
  const filteredStudents = students.filter(student => {
    const sub = student.submission;
    const nameMatch = (student.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const idMatch = (student.studentId || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!nameMatch && !idMatch) return false;

    switch (activeTab) {
      case 'submitted': return sub && !sub.isLate;
      case 'not-submitted': return !sub;
      case 'late': return sub?.isLate;
      case 'graded': return sub?.score !== undefined && sub?.score !== null;
      case 'not-graded': return sub && (sub?.score === undefined || sub?.score === null);
      default: return true;
    }
  });

  // Dynamic Pagination Logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExportResults = () => {
    if (filteredStudents.length === 0) return;

    const rows = filteredStudents.map((student, index) => {
      const files = Array.isArray(student.submission?.files) ? student.submission.files : [];
      return {
        NO: index + 1,
        'NAMA SISWA': student.name || '-',
        'NIS/ID': student.studentId || '-',
        KELAS: student.classCode || '-',
        STATUS: formatSubmissionStatus(student),
        'WAKTU SUBMIT': student.submission ? formatDateTime(student.submission.submittedAt) : '-',
        NILAI: student.submission?.score ?? '-',
        FEEDBACK: student.submission?.feedback || '-',
        'PESAN SISWA': student.submission?.text || '-',
        'JUMLAH FILE': files.length,
        'NAMA FILE': files.map((file) => file.originalName).filter(Boolean).join('; ') || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 22 },
      { wch: 10 },
      { wch: 36 },
      { wch: 36 },
      { wch: 12 },
      { wch: 42 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Penugasan');
    XLSX.writeFile(workbook, `hasil-penugasan-${assignmentId}.xlsx`);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };


  return (
    <div className={styles.teacherSubmissionPage}>
      {/* Page Header with Back Button */}
      {/* Header Section */}
      <div className={styles.submissionHero} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <button 
              onClick={() => router.push('/dashboard/teacher/assignments')}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--color-heading)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-heading)', margin: 0 }}>Monitor Evaluasi Penugasan</h1>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-subtext)', marginBottom: '16px', marginLeft: '48px' }}>
            <span>Tugas: <span style={{ color: 'var(--color-heading)', fontWeight: 500 }}>{assignmentMeta?.title || 'Test Modul'}</span></span>
            <span>Kelas: <span style={{ color: '#3B82F6', fontWeight: 600 }}>{mappedClassLabel}</span></span>
          </div>
          <div style={{ marginLeft: '48px' }}>
            <StatusBadge variant={assignmentMeta?.deadline ? 'danger' : 'success'}>
              {assignmentMeta?.deadline 
                ? `BATAS WAKTU: ${new Date(assignmentMeta.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`.toUpperCase()
                : 'TIDAK BERBATAS RUANG / INFINITY'}
            </StatusBadge>
          </div>
        </div>

        {/* Progress Card */}
        <div style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--color-border)', 
          borderRadius: '16px', 
          padding: '24px', 
          minWidth: '320px',
          flex: '1',
          maxWidth: '500px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-heading)' }}>Progress Pengumpulan</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#3B82F6' }}>{progressPercentage}%</span>
          </div>
          <div style={{ height: '8px', background: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ width: `${progressPercentage}%`, height: '100%', background: '#3B82F6', borderRadius: '4px', transition: 'width 1s ease' }} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-subtext)' }}>
            <strong>{submittedCount}</strong> dari {totalStudents} siswa sudah mengumpulkan
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className={styles.submissionStatsGrid} style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '32px' 
      }}>
        {[
          { label: 'Total Siswa', value: totalStudents, sub: `Semua siswa di kelas ${mappedClassLabel}`, color: '#3B82F6', icon: 'users' },
          { label: 'Sudah Mengumpulkan', value: submittedCount, sub: `${progressPercentage}% dari total siswa`, color: '#10B981', icon: 'check' },
          { label: 'Belum Mengumpulkan', value: notSubmittedCount, sub: `${Math.round((notSubmittedCount/totalStudents)*100) || 0}% dari total siswa`, color: '#F59E0B', icon: 'clock' },
          { label: 'Terlambat', value: lateCount, sub: `${Math.round((lateCount/totalStudents)*100) || 0}% dari total siswa`, color: '#EF4444', icon: 'alert' },
          { label: 'Rata-rata Nilai', value: averageScore, sub: `Dari ${gradedCount} siswa dinilai`, color: '#8B5CF6', icon: 'star' },
        ].map((stat, i) => (
          <div key={i} style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--color-border)', 
            borderRadius: '16px', 
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: `rgba(${parseInt(stat.color.slice(1,3), 16)}, ${parseInt(stat.color.slice(3,5), 16)}, ${parseInt(stat.color.slice(5,7), 16)}, 0.1)`,
              color: stat.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {stat.icon === 'users' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              {stat.icon === 'check' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
              {stat.icon === 'clock' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              {stat.icon === 'alert' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
              {stat.icon === 'star' && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-heading)' }}>{stat.value}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-subtext)', whiteSpace: 'nowrap' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      {/* Filters & Tabs Row */}
      <div className={styles.submissionFiltersCard} style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '24px', boxShadow: 'var(--shadow-sm)', marginBottom: '24px' }}>
        <div className={styles.submissionFiltersTop} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div className={styles.submissionFiltersLeft} style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
            <div className={styles.searchBox} style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: '10px' }}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input 
                type="text" 
                placeholder="Cari nama siswa..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className={styles.submissionFilterButton} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 16px',
              background: 'var(--bg-app)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text)',
              cursor: 'pointer'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              Filter Status
            </button>
          </div>
          <button 
            className={styles.submissionExportButton}
            onClick={handleExportResults}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-heading)',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Excel
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.submissionTabs} style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { key: 'all', label: 'Semua', count: totalStudents },
            { key: 'submitted', label: 'Sudah Dikumpulkan', count: submittedCount - lateCount, color: '#10B981' },
            { key: 'not-submitted', label: 'Belum Dikumpulkan', count: notSubmittedCount, color: '#F59E0B' },
            { key: 'late', label: 'Terlambat', count: lateCount, color: '#EF4444' },
            { key: 'graded', label: 'Sudah Dinilai', count: gradedCount, color: '#3B82F6' },
            { key: 'not-graded', label: 'Belum Dinilai', count: notGradedCount, color: 'var(--color-subtext)' },
          ].map((tab) => (
            <button
              className={styles.submissionTabBtn}
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: activeTab === tab.key ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                border: activeTab === tab.key ? '1px solid #3B82F6' : '1px solid transparent',
                borderRadius: '99px',
                fontSize: '13px',
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? '#3B82F6' : 'var(--color-subtext)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
              <span style={{
                padding: '2px 8px',
                background: activeTab === tab.key ? '#3B82F6' : 'rgba(0,0,0,0.1)',
                color: activeTab === tab.key ? 'white' : 'var(--color-subtext)',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <ContentCard>
        {/* Desktop table */}
        <div className={`${styles.tableContainer} ${styles.desktopOnlyBlock}`}>
          {loading ? (
            <div className={styles.loadingBox}>
              <div className="spinner"></div> 
              Memuat data pengumpulan siswa...
            </div>
          ) : paginatedStudents.length === 0 ? (
            <EmptyState
              title="Tidak Ada Data"
              description="Tidak ada siswa yang sesuai dengan kriteria pencarian atau filter."
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>NO</th>
                  <th style={{ width: '20%' }}>NAMA SISWA</th>
                  <th style={{ width: '15%' }}>STATUS</th>
                  <th style={{ width: '15%' }}>WAKTU PENGUMPULAN</th>
                  <th style={{ width: '15%' }}>FILE TERKUMPUL</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>NILAI</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>FEEDBACK</th>
                  <th style={{ width: '17%', textAlign: 'center' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student, index) => {
                  const sub = student.submission;
                  const isGrading = gradingStudentId === student.studentId;
                  const avatarColor = getAvatarColor(student.name || '');

                  return (
                    <tr key={student._id} style={{ transition: 'background 0.2s', borderBottom: '1px solid var(--color-border)' }}>
                      <td data-label="NO" style={{ textAlign: 'center', color: 'var(--color-subtext)', fontSize: '13px', fontWeight: 600 }}>
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td data-label="NAMA SISWA">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: avatarColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'white',
                            flexShrink: 0,
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                          }}>
                            {getInitials(student.name)}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-heading)', fontSize: '14px', marginBottom: '2px' }}>{student.name || 'Siswa'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-subtext)', letterSpacing: '0.5px' }}>{student.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="STATUS">
                        {sub ? (
                          <div style={{ 
                            padding: '6px 12px', 
                            background: sub.isLate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: sub.isLate ? '#EF4444' : '#10B981',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textAlign: 'center',
                            display: 'inline-block',
                            width: '100%'
                          }}>
                            {sub.isLate ? 'Terlambat' : 'Sudah Dikumpulkan'}
                          </div>
                        ) : (
                          <div style={{ 
                            padding: '6px 12px', 
                            background: 'rgba(245, 158, 11, 0.1)',
                            color: '#F59E0B',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textAlign: 'center',
                            display: 'inline-block',
                            width: '100%'
                          }}>
                            Belum Dikumpulkan
                          </div>
                        )}
                      </td>
                      <td data-label="WAKTU PENGUMPULAN">
                        {sub ? (
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-heading)' }}>
                              {new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-subtext)' }}>
                              {new Date(sub.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-subtext)' }}>-</span>
                        )}
                      </td>
                      <td data-label="FILE TERKUMPUL">
                        {sub?.files && sub.files.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {sub.files.map((fl, x) => (
                              <div key={x} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '11px', color: 'var(--color-heading)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{fl.originalName}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--color-subtext)' }}>{formatFileSize(fl.size)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-subtext)' }}>-</span>
                        )}
                      </td>
                      <td data-label="NILAI" style={{ textAlign: 'center' }}>
                        {sub?.score !== undefined && sub?.score !== null ? (
                          <button
                            onClick={() => setSelectedStudentDetail(student)}
                            title="Klik untuk lihat detail & edit nilai"
                            style={{
                              display: 'inline-flex', minWidth: '36px', height: '36px',
                              padding: '0 10px',
                              background: sub.score >= 80 ? 'rgba(16,185,129,0.15)' : sub.score >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                              color: sub.score >= 80 ? '#10B981' : sub.score >= 60 ? '#F59E0B' : '#EF4444',
                              borderRadius: '8px', fontSize: '13px', fontWeight: 800,
                              alignItems: 'center', justifyContent: 'center',
                              border: 'none', cursor: 'pointer',
                              transition: 'opacity 0.15s'
                            }}
                          >
                            {sub.score}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-subtext)' }}>-</span>
                        )}
                      </td>
                      <td data-label="FEEDBACK" style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedStudentDetail(student)}
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: sub?.feedback ? 'rgba(59,130,246,0.1)' : 'var(--bg-app)',
                            border: '1px solid var(--color-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: sub?.feedback ? '#3B82F6' : 'var(--color-subtext)',
                            cursor: 'pointer', margin: '0 auto'
                          }}
                          title={sub?.feedback || 'Belum ada feedback'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                          </svg>
                        </button>
                      </td>
                      <td data-label="AKSI">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => setSelectedStudentDetail(student)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '8px 14px',
                              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                              borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                              color: '#3B82F6', cursor: 'pointer'
                            }}
                          >
                            Detail
                          </button>
                          {sub && (
                            <button
                              onClick={() => {
                                setSelectedStudentDetail(student);
                                // Pre-open grading form inside modal after state settles
                                setTimeout(() => {
                                  setModalGradeInput(sub.score ?? '');
                                  setModalFeedbackInput(sub.feedback || '');
                                  setModalRequiresRevision(!!sub.requiresRevision || sub.status === 'revision-required');
                                  setIsGradingInModal(true);
                                }, 0);
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 14px',
                                background: 'var(--bg-app)', border: '1px solid var(--color-border)',
                                borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                                color: 'var(--color-heading)', cursor: 'pointer'
                              }}
                            >
                              Nilai
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile card list */}
        {!loading && (
          <div className={styles.mobileOnlyBlock}>
            {paginatedStudents.length === 0 ? (
              <EmptyState
                title="Tidak Ada Data"
                description="Tidak ada siswa yang sesuai dengan kriteria pencarian atau filter."
              />
            ) : (
              <div className={styles.mobileSubmissionList}>
                {paginatedStudents.map((student, index) => {
                  const sub = student.submission;
                  const isGrading = gradingStudentId === student.studentId;
                  const avatarColor = getAvatarColor(student.name || '');

                  return (
                    <div key={student._id} className={styles.mobileSubmissionCard}>
                      {/* Top: avatar + name + status */}
                      <div className={styles.mobileSubmissionHead}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            backgroundColor: avatarColor, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '14px', fontWeight: 700,
                            color: 'white', flexShrink: 0
                          }}>
                            {getInitials(student.name)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-heading)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {student.name || 'Siswa'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-subtext)' }}>{student.studentId}</div>
                          </div>
                        </div>
                        {/* Status badge */}
                        <div style={{
                          padding: '5px 10px',
                          background: sub ? (sub.isLate ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)') : 'rgba(245,158,11,0.1)',
                          color: sub ? (sub.isLate ? '#EF4444' : '#10B981') : '#F59E0B',
                          borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                          whiteSpace: 'nowrap', flexShrink: 0
                        }}>
                          {sub ? (sub.isLate ? 'Terlambat' : 'Dikumpulkan') : 'Belum Kumpul'}
                        </div>
                      </div>

                      {/* Meta: waktu + nilai */}
                      {sub && (
                        <div className={styles.mobileSubmissionMeta}>
                          <div>
                            <div className={styles.mobileMetaLabel}>Waktu</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 500 }}>
                              {new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}
                              {new Date(sub.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div>
                            <div className={styles.mobileMetaLabel}>Nilai</div>
                            {isGrading ? (
                              <input
                                type="number"
                                value={gradeInput}
                                onChange={e => setGradeInput(e.target.value)}
                                style={{ width: '60px', padding: '4px 8px', border: '1px solid #3B82F6', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 700, textAlign: 'center' }}
                                autoFocus
                              />
                            ) : (
                              /* Nilai badge — clickable, opens detail modal */
                              <button
                                onClick={() => setSelectedStudentDetail(student)}
                                title="Klik untuk lihat detail & edit nilai"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  minWidth: '36px', height: '28px', padding: '0 10px',
                                  background: sub.score !== undefined && sub.score !== null
                                    ? (sub.score >= 80 ? 'rgba(16,185,129,0.15)' : sub.score >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)')
                                    : 'var(--bg-surface)',
                                  color: sub.score !== undefined && sub.score !== null
                                    ? (sub.score >= 80 ? '#10B981' : sub.score >= 60 ? '#F59E0B' : '#EF4444')
                                    : 'var(--color-subtext)',
                                  borderRadius: '6px', fontSize: '0.82rem', fontWeight: 800,
                                  border: 'none', cursor: 'pointer'
                                }}
                              >
                                {sub.score !== undefined && sub.score !== null ? sub.score : '—'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Files */}
                      {sub?.files && sub.files.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {sub.files.map((fl, x) => (
                            <a key={x} href={fl.url} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '4px 8px', background: 'var(--color-primary-light)',
                                borderRadius: '6px', fontSize: '0.7rem', color: 'var(--color-primary)',
                                textDecoration: 'none', maxWidth: '160px', overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                              }}
                            >
                              📎 {fl.originalName}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Actions — both open detail modal */}
                      <div className={styles.mobileSubmissionActions}>
                        <button
                          onClick={() => setSelectedStudentDetail(student)}
                          style={{
                            flex: 1, padding: '10px', background: 'rgba(59,130,246,0.1)',
                            border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px',
                            color: '#3B82F6', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                          }}
                        >
                          Detail
                        </button>
                        {sub && (
                          <button
                            onClick={() => {
                              setSelectedStudentDetail(student);
                              setTimeout(() => {
                                setModalGradeInput(sub.score ?? '');
                                setModalFeedbackInput(sub.feedback || '');
                                setModalRequiresRevision(!!sub.requiresRevision || sub.status === 'revision-required');
                                setIsGradingInModal(true);
                              }, 0);
                            }}
                            style={{
                              flex: 1, padding: '10px', background: 'var(--bg-surface)',
                              border: '1px solid var(--color-border)', borderRadius: '8px',
                              color: 'var(--color-heading)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                            }}
                          >
                            Nilai
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ContentCard>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className={styles.submissionPagination} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginTop: '24px',
          padding: '0 4px'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--color-subtext)', fontWeight: 500 }}>
            Menampilkan <span style={{ color: 'var(--color-heading)', fontWeight: 600 }}>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredStudents.length)}</span> sampai <span style={{ color: 'var(--color-heading)', fontWeight: 600 }}>{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> dari <span style={{ color: 'var(--color-heading)', fontWeight: 600 }}>{filteredStudents.length}</span> Siswa
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--bg-card)',
                color: currentPage === 1 ? 'var(--color-subtext)' : 'var(--color-heading)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentPage === 1 ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                onClick={() => setCurrentPage(page)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: currentPage === page ? 'none' : '1px solid var(--color-border)',
                  background: currentPage === page ? '#3B82F6' : 'var(--bg-card)',
                  color: currentPage === page ? 'white' : 'var(--color-heading)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  boxShadow: currentPage === page ? '0 4px 10px rgba(59, 130, 246, 0.3)' : 'none'
                }}
              >
                {page}
              </button>
            ))}

            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--bg-card)',
                color: currentPage === totalPages ? 'var(--color-subtext)' : 'var(--color-heading)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentPage === totalPages ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      <Modal
        isOpen={!!selectedStudentDetail}
        onClose={() => { setSelectedStudentDetail(null); setIsGradingInModal(false); }}
        title="Detail Pengumpulan Siswa"
        maxWidth="800px"
      >
        {selectedStudentDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Student Info Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                backgroundColor: getAvatarColor(selectedStudentDetail.name || ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: 700, color: 'white'
              }}>
                {getInitials(selectedStudentDetail.name)}
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-heading)', margin: 0 }}>{selectedStudentDetail.name}</h3>
                <p style={{ fontSize: '14px', color: 'var(--color-subtext)', margin: '4px 0 0 0' }}>NIM: {selectedStudentDetail.studentId} • Kelas: {selectedStudentDetail.classCode}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <StatusBadge variant={selectedStudentDetail.submission ? (selectedStudentDetail.submission.isLate ? 'danger' : 'success') : 'warning'}>
                  {selectedStudentDetail.submission ? (selectedStudentDetail.submission.isLate ? 'Terlambat' : 'Tepat Waktu') : 'Belum Mengumpulkan'}
                </StatusBadge>
              </div>
            </div>

            {/* Submission Content */}
            {selectedStudentDetail.submission ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '10px' }}>Pesan / Jawaban:</h4>
                    <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '8px', fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text)', minHeight: '100px', whiteSpace: 'pre-wrap', border: '1px solid var(--color-border)' }}>
                      {selectedStudentDetail.submission.text || <span style={{ fontStyle: 'italic', color: 'var(--color-subtext)' }}>Tidak ada pesan tambahan.</span>}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '10px' }}>Metadata:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--color-border)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-subtext)' }}>Waktu Pengumpulan</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {new Date(selectedStudentDetail.submission.submittedAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--color-border)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-subtext)' }}>Status Nilai</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: selectedStudentDetail.submission.score !== null && selectedStudentDetail.submission.score !== undefined ? '#10B981' : '#F59E0B' }}>
                          {selectedStudentDetail.submission.score !== null && selectedStudentDetail.submission.score !== undefined ? 'Sudah Dinilai' : 'Belum Dinilai'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--color-border)' }}>
                        <span style={{ fontSize: '13px', color: 'var(--color-subtext)' }}>Total File</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {selectedStudentDetail.submission.files?.length || 0} File
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Files Section */}
                {selectedStudentDetail.submission.files?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-heading)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      File Terlampir
                      {selectedStudentDetail.submission.files.length > 1 && (
                        <button onClick={() => handleDownloadAllSelected(selectedStudentDetail.submission.files)} style={{ fontSize: '12px', color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Download Semua
                        </button>
                      )}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                      {selectedStudentDetail.submission.files.map((file, idx) => (
                        <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '8px', textDecoration: 'none' }}
                        >
                          <div style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.originalName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-subtext)' }}>{formatFileSize(file.size)}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Grading Section ── */}
                {isGradingInModal ? (
                  /* Form input nilai + feedback */
                  <div style={{ padding: '20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#3B82F6' }}>
                      {selectedStudentDetail.submission.score !== null && selectedStudentDetail.submission.score !== undefined ? 'Edit Nilai & Feedback' : 'Beri Nilai & Feedback'}
                    </h4>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-subtext)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nilai (0–100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={modalGradeInput}
                          onChange={e => setModalGradeInput(e.target.value)}
                          placeholder="0"
                          autoFocus
                          style={{ width: '100px', padding: '10px 12px', border: '2px solid #3B82F6', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', background: 'var(--bg-card)', color: 'var(--color-heading)', outline: 'none' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-subtext)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Feedback untuk Siswa
                          <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--color-primary)', fontWeight: 500, textTransform: 'none' }}>(akan terlihat oleh siswa)</span>
                        </label>
                        <textarea
                          value={modalFeedbackInput}
                          onChange={e => setModalFeedbackInput(e.target.value)}
                          placeholder="Tuliskan feedback untuk siswa... (opsional)"
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--color-text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>
                      <input
                        type="checkbox"
                        checked={modalRequiresRevision}
                        onChange={(e) => setModalRequiresRevision(e.target.checked)}
                      />
                      Minta revisi dari siswa
                    </label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={submitGradeInModal}
                        disabled={modalGradeLoading}
                        style={{ flex: 1, padding: '11px', background: '#10B981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        {modalGradeLoading ? 'Menyimpan...' : (modalRequiresRevision ? 'Kirim Permintaan Revisi' : 'Simpan Nilai & Feedback')}
                      </button>
                      <button
                        onClick={() => setIsGradingInModal(false)}
                        style={{ padding: '11px 20px', background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display nilai + feedback (read mode) */
                  <div style={{ padding: '16px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selectedStudentDetail.submission.feedback ? '12px' : 0 }}>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#3B82F6', margin: 0 }}>Hasil Penilaian</h4>
                      {(selectedStudentDetail.submission.requiresRevision || selectedStudentDetail.submission.status === 'revision-required') && (
                        <span style={{ padding: '4px 10px', background: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
                          Perlu Revisi
                        </span>
                      )}
                      {selectedStudentDetail.submission.score !== null && selectedStudentDetail.submission.score !== undefined ? (
                        <div style={{ padding: '4px 14px', background: '#3B82F6', color: 'white', borderRadius: '20px', fontSize: '16px', fontWeight: 800 }}>
                          {selectedStudentDetail.submission.score}
                        </div>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--color-subtext)', fontStyle: 'italic' }}>Belum dinilai</span>
                      )}
                    </div>
                    {selectedStudentDetail.submission.feedback && (
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-subtext)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Feedback Guru:</span>
                        <p style={{ fontSize: '13px', color: 'var(--color-text)', margin: '8px 0 0 0', lineHeight: '1.5' }}>{selectedStudentDetail.submission.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-app)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(245,158,11,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-heading)' }}>Siswa Belum Mengumpulkan</h4>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-subtext)' }}>Belum ada data pengumpulan yang tersedia.</p>
              </div>
            )}

            {/* Modal Footer */}
            <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={() => { setSelectedStudentDetail(null); setIsGradingInModal(false); }}
                style={{ flex: 1, padding: '12px', background: 'var(--bg-app)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}
              >
                Tutup
              </button>
              {selectedStudentDetail.submission && !isGradingInModal && (
                <button
                  onClick={() => {
                    setModalGradeInput(selectedStudentDetail.submission.score ?? '');
                    setModalFeedbackInput(selectedStudentDetail.submission.feedback || '');
                    setModalRequiresRevision(!!selectedStudentDetail.submission.requiresRevision || selectedStudentDetail.submission.status === 'revision-required');
                    setIsGradingInModal(true);
                  }}
                  style={{ flex: 1, padding: '12px', background: '#3B82F6', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}
                >
                  {selectedStudentDetail.submission.score !== null && selectedStudentDetail.submission.score !== undefined ? 'Edit Nilai / Feedback' : 'Beri Nilai & Feedback'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
