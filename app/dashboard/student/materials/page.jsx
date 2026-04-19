'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../../admin/admin.module.css';

export default function StudentMaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState(null);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/materials');
      const data = await res.json();
      if (res.ok) setMaterials(data.materials || []);
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Materi Pelajaran</h1>
      </div>

      <div className={styles.contentCard} style={{ padding: '24px' }}>
        <p style={{ color: 'var(--color-subtext)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Materi yang dipublikasikan oleh guru untuk kelas Anda. Klik file untuk mengunduh.
        </p>

        {loading ? (
          <div className={styles.loadingBox}>
            <div className="spinner"></div>
            Memuat materi...
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.emptyState}>Belum ada materi untuk kelas Anda saat ini.</div>
        ) : !selectedSubject ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
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
                   onClick={() => setSelectedSubject(subjectName)}
                   style={{ 
                     background: 'var(--bg-card)', 
                     borderRadius: '16px', 
                     border: '1px solid var(--color-border)',
                     overflow: 'hidden',
                     cursor: 'pointer',
                     transition: 'all 0.2s ease',
                     boxShadow: 'var(--shadow-card)'
                   }}
                   onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                   }}
                   onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                   }}
                 >
                   <div style={{ height: '120px', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                     <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48, opacity: 0.8 }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                   </div>
                   <div style={{ padding: '20px' }}>
                     <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-heading)', margin: '0 0 8px 0', lineHeight: 1.3 }}>{subjectName}</h3>
                     <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext)', display: 'block', marginBottom: '16px' }}>Kelas: <span style={{ color: 'var(--color-primary)' }}>{classCode}</span></span>
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext)' }}>{groupItems.length} Materi Tersedia</span>
                        <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '6px 16px', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 700 }}>Akses</div>
                     </div>
                   </div>
                 </div>
               );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header Subject Details */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <button 
                  onClick={() => setSelectedSubject(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--color-subtext)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', padding: 0 }}
               >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  Kembali ke Daftar Mapel
               </button>
               <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-heading)', margin: '0 0 4px 0' }}>{selectedSubject}</h2>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-subtext)' }}>Daftar Modul & Materi Referensi Aktif</span>
               </div>
            </div>

            {(() => {
               const subjectMaterials = materials.filter(m => (m.subjectDetails?.subjectName || 'Aset Lepas / Mata Pelajaran Lainnya') === selectedSubject);
               const selectedMat = subjectMaterials.find(m => m._id === expandedMaterialId) || subjectMaterials[0];

               return (
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', minHeight: '500px' }}>
                     {/* Left Sidebar: List of Material Titles */}
                     <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {subjectMaterials.map(mat => {
                           const isSelected = selectedMat && selectedMat._id === mat._id;
                           return (
                              <div
                                 key={mat._id}
                                 onClick={() => setExpandedMaterialId(mat._id)}
                                 style={{
                                    padding: '16px',
                                    background: isSelected ? 'var(--color-primary-light)' : 'var(--bg-card)',
                                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    borderLeft: isSelected ? '4px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected ? '0 2px 4px rgba(120, 163, 255, 0.15)' : 'none',
                                 }}
                              >
                                 <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-heading)', marginBottom: '6px' }}>
                                    {mat.title || 'Materi Pembelajaran'}
                                 </div>
                                 <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', fontWeight: 500 }}>
                                    {new Date(mat.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                 </div>
                              </div>
                           );
                        })}
                     </div>

                     {/* Right Pane: Material Details */}
                     <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-card)' }}>
                        {selectedMat ? (
                           <>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--color-subtext)', fontWeight: 600, marginBottom: '12px', display: 'inline-block', background: 'var(--color-primary-light)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                 Diunggah pada: {new Date(selectedMat.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-heading)', marginBottom: '24px', lineHeight: 1.3 }}>
                                 {selectedMat.title || 'Materi Pembelajaran'}
                              </h2>
                              
                              <div style={{ fontSize: '1rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: '40px' }}>
                                 {selectedMat.text}
                              </div>

                              {selectedMat.files && selectedMat.files.length > 0 && (
                                 <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-heading)', marginBottom: '16px' }}>
                                       Lampiran Berkas ({selectedMat.files.length})
                                    </h3>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                       {selectedMat.files.map((f, i) => (
                                          <a
                                             key={i}
                                             href={f.url}
                                             download={f.originalName}
                                             style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '12px 20px',
                                                background: 'var(--color-primary-light)',
                                                borderRadius: '8px',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                                color: 'var(--color-primary)',
                                                textDecoration: 'none',
                                                border: '1px solid var(--color-border)',
                                                transition: 'all 0.2s',
                                             }}
                                             onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,163,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                             onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                          >
                                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
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
                           <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
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
