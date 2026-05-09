'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import ContentCard from '@/components/ContentCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import styles from '../admin.module.css';

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

  // Action badge using StatusBadge
  const getActionBadge = (action) => {
    switch(action) {
      case 'create': return <StatusBadge variant="success">Create</StatusBadge>;
      case 'update': return <StatusBadge variant="info">Update</StatusBadge>;
      case 'delete': return <StatusBadge variant="danger">Delete</StatusBadge>;
      case 'status_change': return <StatusBadge variant="warning">Status</StatusBadge>;
      default: return <StatusBadge variant="neutral">{action}</StatusBadge>;
    }
  };

  // ── Filter bar ────────────────────────────────────────────────────────
  const filterBar = (
    <div className={styles.filterSection}>
      <div className={styles.roleTabs}>
        <button className={`${styles.tabBtn} ${actionFilter === '' ? styles.tabBtnActive : ''}`} onClick={() => { setActionFilter(''); setPage(1); }}>Semua Aksi</button>
        <button className={`${styles.tabBtn} ${actionFilter === 'create' ? styles.tabBtnActive : ''}`} onClick={() => { setActionFilter('create'); setPage(1); }}>Create</button>
        <button className={`${styles.tabBtn} ${actionFilter === 'update' ? styles.tabBtnActive : ''}`} onClick={() => { setActionFilter('update'); setPage(1); }}>Update</button>
        <button className={`${styles.tabBtn} ${actionFilter === 'delete' ? styles.tabBtnActive : ''}`} onClick={() => { setActionFilter('delete'); setPage(1); }}>Delete</button>
        <button className={`${styles.tabBtn} ${actionFilter === 'status_change' ? styles.tabBtnActive : ''}`} onClick={() => { setActionFilter('status_change'); setPage(1); }}>Status Change</button>
      </div>
    </div>
  );

  // ── Pagination footer ─────────────────────────────────────────────────
  const paginationFooter = !loading && totalPages > 0 ? (
    <>
      <div className={styles.pageInfo}>
        Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} dari {totalCount} log
      </div>
      <div className={styles.pageControls}>
        <button className={styles.pageBtn} onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Sebelumnya</button>
        <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>{page}</button>
        <button className={styles.pageBtn} onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>Selanjutnya</button>
      </div>
    </>
  ) : null;

  return (
    <>
      <PageHeader title="Log Aktivitas Sistem" />

      <ContentCard header={filterBar} footer={paginationFooter}>
        <div className={`${styles.tableContainer} ${styles.desktopOnlyBlock}`}>
          {loading ? (
             <div className={styles.loadingBox}>
                <div className="spinner"></div>
                Memuat data...
             </div>
          ) : logs.length === 0 ? (
            <EmptyState
              title="Tidak Ada Log"
              description="Tidak ada log aktivitas ditemukan untuk filter ini."
            />
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
                    <td className={styles.cellNoWrap}>
                      <div className={styles.cellMedium}>{new Date(log.timestamp).toLocaleDateString('id-ID')}</div>
                      <div className={styles.cellSecondary}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td data-label="Aksi">{getActionBadge(log.action)}</td>
                    <td data-label="Dilakukan Oleh">
                       <div className={styles.cellBold}>{log.userName}</div>
                       {log.userId && <div className={styles.cellSecondary}>ID: {log.userId.slice(-6)}</div>}
                    </td>
                    <td data-label="Target">
                       <div className={styles.cellPrimary}>{log.target}</div>
                    </td>
                    <td data-label="Detail">
                       <div className={styles.detailBox}>
                          <pre className={styles.detailPre}>
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

        {!loading && logs.length > 0 && (
          <div className={styles.mobileUserList}>
            {logs.map((log) => (
              <article key={`mobile-log-${log._id}`} className={styles.mobileUserCard}>
                <div className={styles.mobileLogHead}>
                  <div>
                    <div className={styles.cellMedium}>{new Date(log.timestamp).toLocaleDateString('id-ID')}</div>
                    <div className={styles.cellSecondary}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</div>
                  </div>
                  <div className={styles.mobileLogBadge}>{getActionBadge(log.action)}</div>
                </div>

                <div className={styles.mobileUserMeta}>
                  <div>
                    <div className={styles.mobileMetaLabel}>Dilakukan Oleh</div>
                    <div className={styles.cellPrimary}>{log.userName}</div>
                    {log.userId && <div className={styles.cellSecondary}>ID: {log.userId.slice(-6)}</div>}
                  </div>
                  <div>
                    <div className={styles.mobileMetaLabel}>Target</div>
                    <div className={styles.cellPrimary}>{log.target}</div>
                  </div>
                </div>

                <div className={styles.mobileLogDetailBox}>
                  <div className={styles.mobileMetaLabel}>Detail</div>
                  <pre className={styles.mobileLogPre}>{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              </article>
            ))}
          </div>
        )}
      </ContentCard>
    </>
  );
}
