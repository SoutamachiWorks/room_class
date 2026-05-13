'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadWithProgress } from '@/lib/xhrUpload';
import { ACCEPT_STR, validateFiles } from '@/lib/fileValidation';
import s from './assignments.module.css';

const TABS = ['Semua','Belum Dikumpulkan','Sudah Dikumpulkan','Terlambat'];
const CLIP_ICON = (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </>
);

function getStatus(asm) {
  if (!asm.submission) {
    const dl = asm.deadline ? new Date(asm.deadline) : null;
    if (dl && new Date() > dl) return 'late';
    return 'pending';
  }
  if (asm.submission.requiresRevision || asm.submission.status === 'revision-required') return 'revision';
  return asm.submission.isLate ? 'submitted-late' : 'submitted';
}

function StatusPill({ status }) {
  const map = {
    pending: [s.statusPending, 'Belum Dikumpulkan'],
    late: [s.statusLate, 'Terlambat'],
    'submitted-late': [s.statusLate, 'Terlambat Dikumpulkan'],
    submitted: [s.statusSubmitted, 'Sudah Dikumpulkan'],
    revision: [s.statusLate, 'Perlu Revisi'],
  };
  const [cls, label] = map[status] || [s.statusPending, status];
  return <span className={s.statusBadge + ' ' + cls}>{label}</span>;
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : null; }
function fmtTime(d) { return d ? new Date(d).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+' WIB' : null; }
function daysLate(dl) { return Math.max(0, Math.floor((new Date()-new Date(dl))/86400000)); }

function StatCard({label,value,desc,border,iconBg,iconCol,icon}) {
  return (
    <div className={s.statCard} style={{borderLeftColor:border}}>
      <div className={s.statTop}>
        <div className={s.statIconWrap} style={{background:iconBg}}>
          <svg viewBox="0 0 24 24" fill="none" stroke={iconCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
        </div>
        <span className={s.statValue}>{value}</span>
      </div>
      <div className={s.statLabel}>{label}</div>
      <div className={s.statDesc}>{desc}</div>
    </div>
  );
}

export default function StudentAssignmentsPage() {
  const isMobile = useIsMobile(640);
  const searchParams = useSearchParams();
  const yearId = searchParams.get('yearId');
  const [assignments, setAssignments] = useState([]);
  const [enrolledYears, setEnrolledYears] = useState([]);
  const [currentYear, setCurrentYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAsm, setSelectedAsm] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formText, setFormText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [retainedOld, setRetainedOld] = useState([]);
  const fileRef = useRef(null);
  const [formErr, setFormErr] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const [progress, setProgress] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = yearId ? '/api/student/assignments?yearId='+yearId : '/api/student/assignments';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.assignments || []);
        setEnrolledYears(data.enrolledYears || []);
        setCurrentYear(data.currentYear || null);
      }
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }, [yearId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const openForm = (asm, existing=null) => {
    setSelectedAsm(asm); setEditingSub(existing); setFormErr('');
    setFormText(existing?.text||''); setRetainedOld(existing?.files||[]); setAttachedFiles([]); setProgress(0);
    setIsFormOpen(true);
  };
  const closeForm = () => { setIsFormOpen(false); setSelectedAsm(null); setEditingSub(null); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormErr(''); setFormLoading(true);
    if (!formText && !attachedFiles.length && !retainedOld.length) { setFormErr('Isi teks atau lampirkan file.'); setFormLoading(false); return; }
    try {
      let total=0; for(const f of attachedFiles) total+=f.size;
      if(total>10*1024*1024){ setFormErr('File melebihi 10 MB.'); setFormLoading(false); return; }
      const fd = new FormData();
      fd.append('text', formText);
      if(editingSub) fd.append('retainedFiles', JSON.stringify(retainedOld.map(f=>f.fileKey||f.filename)));
      else fd.append('assignmentId', selectedAsm._id);
      for(const f of attachedFiles) fd.append('files', f);
      const url = editingSub ? '/api/student/submissions/'+editingSub._id : '/api/student/submissions';
      await uploadWithProgress(url, fd, editingSub?'PUT':'POST', v=>setProgress(v));
      fetchData(); closeForm();
    } catch(err){ setFormErr(err.message||'Gagal.'); } finally { setFormLoading(false); setProgress(0); }
  };

  const handleDelete = async () => {
    if(!deleteTarget) return; setDeleteLoading(true); setDeleteErr('');
    try {
      const res = await fetch('/api/student/submissions/'+deleteTarget._id,{method:'DELETE'});
      if(res.ok){ fetchData(); setIsDeleteOpen(false); }
      else { const d=await res.json(); setDeleteErr(d.error||'Gagal menghapus jawaban.'); }
    } catch { setDeleteErr('Koneksi gagal.'); } finally { setDeleteLoading(false); }
  };

  const currentYearId = currentYear?.yearId || null;
  const isArchive = Boolean(yearId && currentYearId && yearId !== currentYearId);

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase();
    const match = !q||(a.text||'').toLowerCase().includes(q)||(a.subjectDetails?.subjectName||'').toLowerCase().includes(q);
    const st = getStatus(a);
    if(activeTab===1) return match&&(st==='pending'||st==='late');
    if(activeTab===2) return match&&(st==='submitted'||st==='submitted-late');
    if(activeTab===3) return match&&(st==='late'||st==='submitted-late');
    return match;
  });

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total/PER));
  const paged = filtered.slice((page-1)*PER, page*PER);
  const stats = {
    total: assignments.length,
    done: assignments.filter(a=>getStatus(a)==='submitted').length,
    pending: assignments.filter(a=>getStatus(a)==='pending').length,
    late: assignments.filter(a=>['late','submitted-late'].includes(getStatus(a))).length,
    revision: assignments.filter(a=>getStatus(a)==='revision').length,
  };

  return (
    <div className={s.page}>
      <div className={s.pageHeaderRow}>
        <div className={s.pageTitleGroup}>
          <h1 className={s.pageTitle}>Tugas Saya</h1>
          <p className={s.pageSubtitle}>Kelola dan pantau tugas yang diberikan oleh guru.</p>
        </div>
        <button
          className={s.btnPrimary}
          onClick={()=>assignments[0]&&openForm(assignments[0])}
          disabled={isArchive}
          title={isArchive ? 'Mode arsip: pengumpulan tugas dinonaktifkan' : 'Kumpulkan tugas'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Kumpulkan Tugas
        </button>
      </div>

      {isArchive&&<div className={s.archiveBanner}>⚠️ Mode Arsip — Tampilan baca saja.</div>}

      <div className={s.controlsRow}>
        <div className={s.searchWrapper}>
          <svg className={s.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className={s.searchInput} placeholder="Cari tugas..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
        </div>
        <button className={s.btnFilter}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filter
        </button>
      </div>

      <div className={s.statsGrid}>
        <StatCard label="Total Tugas" value={stats.total} desc="Semua tugas yang diberikan" border="#78A3FF" iconBg="rgba(120,163,255,0.12)" iconCol="#78A3FF"
          icon={CLIP_ICON}/>
        <StatCard label="Selesai" value={stats.done} desc="Tugas yang sudah dikumpulkan" border="#22C55E" iconBg="rgba(34,197,94,0.12)" iconCol="#22C55E"
          icon={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>}/>
        <StatCard label="Belum Dikumpulkan" value={stats.pending} desc="Tugas yang perlu dikerjakan" border="#F59E0B" iconBg="rgba(245,158,11,0.12)" iconCol="#F59E0B"
          icon={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}/>
        <StatCard label="Terlambat" value={stats.late} desc="Tugas melewati batas waktu" border="#EF4444" iconBg="rgba(239,68,68,0.12)" iconCol="#EF4444"
          icon={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>}/>
      </div>

      <div className={s.mainCard}>
        <div className={s.tabsRow}>
          {TABS.map((t,i)=>(
            <button key={t} className={s.tabBtn+(activeTab===i?' '+s.tabBtnActive:'')} onClick={()=>{setActiveTab(i);setPage(1);}}>{t}</button>
          ))}
        </div>

        <div className={s.tableWrapper}>
          {loading ? (
            <div className={s.loadingBox}><div className="spinner"/>Memuat...</div>
          ) : paged.length===0 ? (
            <div className={s.emptyState}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div className={s.emptyTitle}>Tidak ada tugas</div>
              <div className={s.emptyDesc}>Belum ada tugas pada kategori ini.</div>
            </div>
          ) : (
            <>
              <table className={s.table}>
              <thead>
                <tr>
                  {['TUGAS','MATA PELAJARAN','DEADLINE','STATUS','AKSI'].map(h=>(
                    <th key={h}><span className={s.thSort}>{h}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="8 9 12 5 16 9"/><polyline points="16 15 12 19 8 15"/></svg>
                    </span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(asm=>{
                  const st=getStatus(asm), dl=asm.deadline?new Date(asm.deadline):null, late=dl?daysLate(dl):0;
                  return (
                    <tr key={asm._id}>
                      <td data-label="TUGAS">
                        <div className={s.taskCellInner}>
                          <div className={s.taskIconWrap}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{CLIP_ICON}</svg>
                          </div>
                          <div className={s.taskBody}>
                            <div className={s.taskTitle}>{asm.subjectDetails?.subjectName||'Tugas'}</div>
                            <div className={s.taskSubtitle}>{(asm.text||'').substring(0,60)||'-'}</div>
                            {asm.rubricText && <div className={s.taskSubtitle}>Rubrik tersedia</div>}
                            {(asm.files||[]).slice(0,1).map((f,i)=>(
                              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className={s.attachmentChip}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                <span className={s.attachmentName}>{f.originalName}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td data-label="MATA PELAJARAN">
                        <div className={s.subjectName}>{asm.subjectDetails?.subjectName||'-'}</div>
                        {asm.subjectDetails?.classCode&&<span className={s.classBadge}>{asm.subjectDetails.classCode}</span>}
                      </td>
                      <td data-label="DEADLINE">
                        {dl?(
                          <div className={s.deadlineCellInner}>
                            <div className={s.deadlineRow}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {fmtDate(dl)}
                            </div>
                            <div className={s.deadlineRow}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              <span className={s.deadlineTime}>{fmtTime(dl)}</span>
                            </div>
                            {(st==='late'||st==='submitted-late')&&late>0&&<span className={s.lateBadge}>Terlambat {late} hari</span>}
                          </div>
                        ):<span style={{color:'var(--color-subtext)',fontSize:'0.8rem'}}>Tidak ada</span>}
                      </td>
                      <td data-label="STATUS">
                        <StatusPill status={st}/>
                        {/* Nilai & feedback dari guru */}
                        {asm.submission?.score !== undefined && asm.submission?.score !== null && (
                          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className={s.scoreBadge}>Nilai: {asm.submission.score}</span>
                            {asm.submission.feedback && (
                              <span className={s.feedbackText} title={asm.submission.feedback}>
                                💬 {asm.submission.feedback.length > 40 ? asm.submission.feedback.substring(0, 40) + '...' : asm.submission.feedback}
                              </span>
                            )}
                          </div>
                        )}
                        {(asm.submission?.requiresRevision || asm.submission?.status === 'revision-required') && asm.submission?.feedback && (
                          <div className={s.feedbackText} style={{ marginTop: '6px' }}>
                            Revisi: {asm.submission.feedback}
                          </div>
                        )}
                      </td>
                      <td data-label="AKSI">
                        <div className={s.actionCell}>
                          {isArchive?(
                            <span style={{fontSize:'0.75rem',color:'var(--color-subtext)'}}>{asm.submission?'Dikumpulkan':'Tidak dikumpulkan'}</span>
                          ):!asm.submission?(
                            <button className={s.btnKumpulkan} onClick={()=>openForm(asm)}>Kumpulkan</button>
                          ):(
                            <>
                              <button className={s.iconBtn} title="Edit" onClick={()=>openForm(asm,asm.submission)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button className={s.iconBtn+' '+s.iconBtnDanger} title="Hapus" onClick={()=>{setDeleteTarget(asm.submission);setIsDeleteOpen(true);}}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className={s.mobileList}>
              {paged.map(asm => {
                const st = getStatus(asm), dl = asm.deadline ? new Date(asm.deadline) : null, late = dl ? daysLate(dl) : 0;
                return (
                  <article key={`m-${asm._id}`} className={s.mobileCard}>
                    <div className={s.mobileCardTop}>
                      <StatusPill status={st} />
                      <div className={s.actionCell}>
                        {isArchive ? (
                          <span style={{fontSize:'0.72rem',color:'var(--color-subtext)'}}>{asm.submission?'Dikumpulkan':'Tidak dikumpulkan'}</span>
                        ) : asm.submission ? (
                          <>
                            <button className={s.iconBtn} title="Edit" onClick={()=>openForm(asm,asm.submission)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className={s.iconBtn+' '+s.iconBtnDanger} title="Hapus" onClick={()=>{setDeleteTarget(asm.submission);setIsDeleteOpen(true);}}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className={s.mobileCardTitle}>{asm.subjectDetails?.subjectName || 'Tugas'}</div>
                    {asm.text && <div className={s.mobileCardSubtitle}>{(asm.text).substring(0, 80)}{asm.text.length > 80 ? '...' : ''}</div>}
                    {(asm.files||[]).length > 0 && (
                      <a href={asm.files[0].url} target="_blank" rel="noopener noreferrer" className={s.attachmentChip}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        <span className={s.attachmentName}>{asm.files[0].originalName}</span>
                      </a>
                    )}
                    <div className={s.mobileCardMeta}>
                      {dl && (
                        <span className={s.mobileMetaItem}>
                          <span className={s.mobileMetaIcon}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </span>
                          {fmtDate(dl)} · {fmtTime(dl)}
                        </span>
                      )}
                      {asm.subjectDetails?.classCode && (
                        <span className={s.classBadge}>{asm.subjectDetails.classCode}</span>
                      )}
                      {(st==='late'||st==='submitted-late') && late > 0 && (
                        <span className={s.lateBadge}>Terlambat {late} hari</span>
                      )}
                    </div>
                    {!isArchive && !asm.submission && (
                      <div className={s.mobileCardAction}>
                        <button className={`${s.btnKumpulkan} ${s.btnKumpulkanFull}`} onClick={()=>openForm(asm)}>Kumpulkan</button>
                      </div>
                    )}
                    {/* Nilai & feedback dari guru di mobile */}
                    {asm.submission?.score !== undefined && asm.submission?.score !== null && (
                      <div className={s.mobileGradeBox}>
                        <div className={s.mobileGradeRow}>
                          <span className={s.mobileGradeLabel}>Nilai Guru</span>
                          <span className={s.scoreBadge}>{asm.submission.score}</span>
                        </div>
                        {asm.submission.feedback && (
                          <div className={s.mobileFeedback}>
                            <span className={s.mobileGradeLabel}>Feedback:</span>
                            <p className={s.feedbackText}>{asm.submission.feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            </>
          )}
        </div>

        <div className={s.paginationFooter}>
          <span className={s.paginationInfo}>
            Menampilkan {total===0?0:(page-1)*PER+1} - {Math.min(page*PER,total)} dari {total} tugas
          </span>
          <div className={s.paginationControls}>
            <button className={s.pageBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {Array.from({length:pages},(_,i)=>i+1).map(n=>(
              <button key={n} className={s.pageBtn+(n===page?' '+s.pageBtnActive:'')} onClick={()=>setPage(n)}>{n}</button>
            ))}
            <button className={s.pageBtn} onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingSub?'Edit Jawaban':'Kumpulkan Jawaban'}>
        <form onSubmit={handleSubmit} className={s.form}>
          {formErr&&<div className={s.formError}>{formErr}</div>}
          <div className={s.contextBox}>
            <div className={s.contextLabel}>{selectedAsm?.subjectDetails?.subjectName}</div>
            <div className={s.contextText}>{selectedAsm?.text}</div>
            {selectedAsm?.rubricText && (
              <div className={s.contextText} style={{ marginTop: '10px', color: 'var(--color-subtext)' }}>
                Rubrik: {selectedAsm.rubricText}
              </div>
            )}
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Jawaban / Catatan</label>
            <textarea value={formText} onChange={e=>setFormText(e.target.value)} className={s.input+' '+s.inputTextarea} placeholder="Tuliskan jawaban Anda..."/>
          </div>
          <div className={s.fieldGroup}>
            <label className={s.fieldLabel}>Lampirkan File (Opsional)</label>
            <input type="file" multiple accept={ACCEPT_STR} ref={fileRef} className={s.input+' '+s.inputFile}
              onChange={e=>{
                const nf=Array.from(e.target.files);
                const v=validateFiles(nf);
                if(!v.valid){setFormErr(v.errors.join(' '));if(fileRef.current)fileRef.current.value='';return;}
                setAttachedFiles(p=>[...p,...nf]);
                if(fileRef.current)fileRef.current.value='';
              }}/>
            <div className={s.filePreviewList}>
              {retainedOld.map(f=>(
                <div key={f.fileKey || f.filename || f.originalName} className={s.fileChipRetained}>
                  <span className={s.fileChipRetainedLabel}>📎 {f.originalName} (Sebelumnya)</span>
                  <button type="button" className={s.fileChipRemoveBtn} onClick={()=>setRetainedOld(p=>p.filter(x=>(x.fileKey||x.filename)!==(f.fileKey||f.filename)))}>Hapus</button>
                </div>
              ))}
              {attachedFiles.map((f,i)=>(
                <div key={i} className={s.fileChipNew}>
                  <span className={s.fileChipNewLabel}>📄 {f.name} (Baru)</span>
                  <button type="button" className={s.fileChipRemoveBtn} onClick={()=>setAttachedFiles(p=>p.filter((_,j)=>j!==i))}>Batal</button>
                </div>
              ))}
            </div>
          </div>
          <div className={s.formActions}>
            {formLoading&&progress>0&&<span className={s.uploadProgressText}>Terkirim... {progress}%</span>}
            <button type="button" className={s.btnCancel} onClick={closeForm} disabled={formLoading}>Batal</button>
            <button type="submit" className={s.btnSubmit} disabled={formLoading}>{formLoading?'Memproses...':editingSub?'Perbarui':'Kirim'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={isDeleteOpen} onClose={()=>{ setIsDeleteOpen(false); setDeleteErr(''); }} onConfirm={handleDelete}
        title="Hapus Jawaban" message={deleteErr || "Yakin ingin menghapus jawaban ini? Tindakan tidak dapat dibatalkan."} loading={deleteLoading}/>
    </div>
  );
}
