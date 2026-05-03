'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import styles from '../../admin/admin.module.css';
import localStyles from './student-materials.module.css';

export default function StudentMaterialsPage() {
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');

  const [materials, setMaterials] = useState([]);
  const [enrolledYears, setEnrolledYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState(null);
  const [isMobileDetailView, setIsMobileDetailView] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const url = yearId ? `/api/student/materials?yearId=${yearId}` : '/api/student/materials';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setMaterials(data.materials || []);
        setEnrolledYears(data.enrolledYears || []);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const isArchiveMode = yearId && enrolledYears.length > 0 && yearId !== enrolledYears[enrolledYears.length - 1].yearId;

  return (
    <>
      <PageHeader
        title={<>Materi Pelajaran {isArchiveMode && <span className={styles.archiveTag}>(Mode Arsip)</span>}</>}
        subtitle="Materi yang dipublikasikan oleh guru untuk kelas Anda. Klik file untuk mengunduh."
      />

      {isArchiveMode && (
        <div className={styles.archiveBanner}>
          ⚠️ Anda sedang melihat materi tahun ajaran sebelumnya. Berkas tetap dapat diunduh.
        </div>
      )}

      <div>

        {loading ? (
          <div className={styles.loadingBox}>
            <div className="spinner"></div>
            Memuat materi...
          </div>
        ) : materials.length === 0 ? (
          <EmptyState
            title="Belum Ada Materi"
            description="Belum ada materi untuk kelas Anda saat ini."
          />
        ) : !selectedSubject ? (
          <div className={localStyles.subjectGrid}>
            {Object.keys(materials.reduce((acc, cur) => {
               const sName = cur.subjectDetails?.subjectName || 'Aset Lepas / Mata Pelajaran Lainnya';
               if(!acc[sName]) acc[sName] = [];
               acc[sName].push(cur);
               return acc;
            }, {})).map((subjectName, idx) => {
               const groupItems = materials.filter(m => (m.subjectDetails?.subjectName || 'Aset Lepas / Mata Pelajaran Lainnya') === subjectName);
               const classCode = groupItems[0]?.subjectDetails?.classCode || '-';

               return (
                 <div 
                   key={idx} 
                   onClick={() => {
                     setSelectedSubject(subjectName);
                     setExpandedMaterialId(null);
                     setIsMobileDetailView(false);
                   }}
                   className={localStyles.subjectCard}
                 >
                   <div className={localStyles.subjectCardBanner}>
                     <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={localStyles.subjectCardIcon}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                   </div>
                   <div className={localStyles.subjectCardBody}>
                     <h3 className={localStyles.subjectCardTitle}>{subjectName}</h3>
                     <span className={localStyles.subjectCardClass}>Kelas: <span className={localStyles.subjectCardClassCode}>{classCode}</span></span>
                     <div className={localStyles.subjectCardFooter}>
                        <span className={localStyles.subjectCardCount}>{groupItems.length} Materi Tersedia</span>
                        <div className={localStyles.subjectCardBtn}>Akses</div>
                     </div>
                   </div>
                 </div>
               );
            })}
          </div>
        ) : (
          <div className={localStyles.detailLayout}>
            {/* Header Subject Details */}
            <div className={localStyles.subjectHeader}>
               <button 
                  onClick={() => {
                    setSelectedSubject(null);
                    setExpandedMaterialId(null);
                    setIsMobileDetailView(false);
                  }}
                  className={localStyles.backBtn}
               >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={localStyles.backBtnIcon}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Kembali ke Daftar Mapel
               </button>
               <div>
                  <h2 className={localStyles.subjectDetailTitle}>{selectedSubject}</h2>
                  <span className={localStyles.subjectDetailSub}>Daftar Modul & Materi Referensi Aktif</span>
               </div>
            </div>

            {(() => {
               const subjectMaterials = materials.filter(m => (m.subjectDetails?.subjectName || 'Aset Lepas / Mata Pelajaran Lainnya') === selectedSubject);
               const selectedMat = subjectMaterials.find(m => m._id === expandedMaterialId) || subjectMaterials[0];

               return (
                  <div className={`${localStyles.splitContainer} ${isMobileDetailView ? localStyles.detailActive : ''}`}>
                     {/* Left Sidebar: List of Material Titles */}
                     <div className={localStyles.sidebar}>
                        {subjectMaterials.map(mat => {
                           const isSelected = selectedMat && selectedMat._id === mat._id;
                           return (
                              <div
                                 key={mat._id}
                                 onClick={() => {
                                    setExpandedMaterialId(mat._id);
                                    setIsMobileDetailView(true);
                                 }}
                                 className={`${localStyles.sidebarItem} ${isSelected ? localStyles.sidebarItemActive : ''}`}
                              >
                                 <div className={`${localStyles.sidebarItemTitle} ${isSelected ? localStyles.sidebarItemTitleActive : ''}`}>
                                    {mat.title || 'Materi Pembelajaran'}
                                 </div>
                                 <div className={localStyles.sidebarItemDate}>
                                    {new Date(mat.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                 </div>
                              </div>
                           );
                        })}
                     </div>

                     {/* Right Pane: Material Details */}
                     <div className={localStyles.contentPane}>
                        {selectedMat ? (
                           <>
                              <div className={localStyles.mobileBackNav}>
                                 <button onClick={() => setIsMobileDetailView(false)} className={localStyles.mobileBackBtn}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={localStyles.backBtnIcon}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                                    Kembali ke Daftar Materi
                                 </button>
                              </div>

                              <div className={localStyles.materialDate}>
                                 Diunggah pada: {new Date(selectedMat.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <h2 className={localStyles.materialTitle}>
                                 {selectedMat.title || 'Materi Pembelajaran'}
                              </h2>
                              
                              <div className={localStyles.materialBody}>
                                 {selectedMat.text}
                              </div>

                              {selectedMat.files && selectedMat.files.length > 0 && (
                                 <div className={localStyles.attachmentSection}>
                                    <h3 className={localStyles.attachmentTitle}>
                                       Lampiran Berkas ({selectedMat.files.length})
                                    </h3>
                                    <div className={localStyles.attachmentList}>
                                       {selectedMat.files.map((f, i) => (
                                          <a
                                             key={i}
                                             href={f.url || '#'}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             download={f.originalName}
                                             className={localStyles.fileItem}
                                          >
                                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={localStyles.fileItemIcon}>
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="7 10 12 15 17 10"/>
                                                <line x1="12" y1="15" x2="12" y2="3"/>
                                             </svg>
                                             Unduh {f.originalName}
                                          </a>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </>
                        ) : (
                           <div className={localStyles.emptyPane}>
                              Pilih materi dari daftar di samping kiri
                           </div>
                        )}
                     </div>
                  </div>
               );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
