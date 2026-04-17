'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from '../admin.module.css';

// Reusing some of the admin styles, but we can override or add specific ones if needed

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        action: actionFilter,
      });
      const res = await fetch(`/api/admin/logs?${query}`);
      const data = await res.json();
      
      if (res.ok) {
        setLogs(data.logs);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Format Helper
  const getActionBadge = (action) => {
    switch(action) {
      case 'create': return <span className={`${styles.badge} ${styles.badgeTeacher}`} style={{background: '#D1F0D9', color: '#198754'}}>Create</span>;
      case 'update': return <span className={`${styles.badge} ${styles.badgeAdmin}`} style={{background: '#E1E8FF', color: '#4A7AFA'}}>Update</span>;
      case 'delete': return <span className={`${styles.badge}`} style={{background: '#FDE0DD', color: '#DC3545'}}>Delete</span>;
      case 'status_change': return <span className={`${styles.badge}`} style={{background: '#FDE68A', color: '#B45309'}}>Status</span>;
      default: return <span className={`${styles.badge}`}>{action}</span>;
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Log Aktivitas Sistem</h1>
      </div>

      <div className={styles.contentCard}>
        {/* Filters */}
        <div className={styles.filterSection}>
          <div className={styles.roleTabs}>
            <button className={actionFilter === '' ? styles.tabBtnActive : styles.tabBtn} onClick={() => { setActionFilter(''); setPage(1); }}>Semua Aksi</button>
            <button className={actionFilter === 'create' ? styles.tabBtnActive : styles.tabBtn} onClick={() => { setActionFilter('create'); setPage(1); }}>Create</button>
            <button className={actionFilter === 'update' ? styles.tabBtnActive : styles.tabBtn} onClick={() => { setActionFilter('update'); setPage(1); }}>Update</button>
            <button className={actionFilter === 'delete' ? styles.tabBtnActive : styles.tabBtn} onClick={() => { setActionFilter('delete'); setPage(1); }}>Delete</button>
            <button className={actionFilter === 'status_change' ? styles.tabBtnActive : styles.tabBtn} onClick={() => { setActionFilter('status_change'); setPage(1); }}>Status Change</button>
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableContainer}>
          {loading ? (
             <div className={styles.loadingBox}>
                <div className="spinner"></div> {/* From layout context */}
                Memuat data...
             </div>
          ) : logs.length === 0 ? (
            <div className={styles.emptyState}>Tidak ada log aktivitas ditemukan.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Dilakukan Oleh</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{new Date(log.timestamp).toLocaleDateString('id-ID')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td>
                       <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{log.userName}</div>
                       {log.userId && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>ID: {log.userId.slice(-6)}</div>}
                    </td>
                    <td>
                       <div style={{ fontSize: '0.875rem' }}>{log.target}</div>
                    </td>
                    <td>
                       <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext)', maxWidth: '250px', background: '#F9FAFB', padding: '6px 10px', borderRadius: '6px' }}>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                             {JSON.stringify(log.details, null, 2)}
                          </pre>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 0 && (
          <div className={styles.pagination}>
            <div className={styles.pageInfo}>
              Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} dari {totalCount} log
            </div>
            <div className={styles.pageControls}>
              <button 
                className={styles.pageBtn} 
                onClick={() => setPage(Math.max(1, page - 1))} 
                disabled={page === 1}
              >
                Sebelumnya
              </button>
              <button 
                className={styles.pageBtn} 
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', borderColor: 'transparent' }}
              >
                {page}
              </button>
              <button 
                className={styles.pageBtn} 
                onClick={() => setPage(Math.min(totalPages, page + 1))} 
                disabled={page === totalPages}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
