'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './admin-home.module.css';

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent, href }) {
  const content = (
    <div className={styles.statCard} style={{ '--accent': accent }}>
      <div className={styles.statIconWrap}>{icon}</div>
      <div className={styles.statBody}>
        <span className={styles.statValue}>{value ?? '—'}</span>
        <span className={styles.statLabel}>{label}</span>
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href} className={styles.statCardLink}>{content}</Link> : content;
}

// ── Quick Action Button ──────────────────────────────────────────────────────
function QuickAction({ icon, label, href, onClick, accent }) {
  const cls = styles.quickAction;
  const inner = (
    <>
      <div className={styles.qaIcon} style={{ '--accent': accent }}>{icon}</div>
      <span className={styles.qaLabel}>{label}</span>
    </>
  );
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ h = 20, radius = 8 }) {
  return <div className={styles.skeleton} style={{ height: h, borderRadius: radius }} />;
}

const LOG_COLORS = {
  auth:   { bg: 'rgba(120,163,255,0.15)', color: 'var(--color-primary)',      dot: '🔐' },
  create: { bg: 'rgba(16,185,129,0.12)',  color: 'var(--color-success-text)', dot: '➕' },
  import: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B',                   dot: '📥' },
  update: { bg: 'rgba(120,163,255,0.12)', color: 'var(--color-primary)',      dot: '✏️' },
  delete: { bg: 'rgba(239,68,68,0.12)',   color: 'var(--color-failed-text)',  dot: '🗑️' },
};

export default function AdminHomePage() {
  const [stats, setStats] = useState(null);
  const [classes, setClasses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch all-in-one stats + storage in parallel
        const [overviewRes, storageRes] = await Promise.all([
          fetch('/api/admin/dashboard-overview'),
          fetch('/api/admin/storage'),
        ]);

        const overview = overviewRes.ok ? await overviewRes.json() : {};
        const storage  = storageRes.ok  ? await storageRes.json()  : { totalBytes: 0 };

        if (overview.stats) {
          setStats({
            ...overview.stats,
            storageBytes: storage.totalBytes ?? 0,
          });
        }
        
        setClasses(overview.classes || []);
        setLogs(overview.logs || []);
      } catch (e) {
        console.error('Admin dashboard load failed:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className={styles.page}>

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>🛡️ Panel Kontrol Admin</h1>
          <p className={styles.pageSubtitle}>Pusat kendali sistem RoomClass — pantau, kelola, dan konfigurasi semua data.</p>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.dateBadge}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Overview Stats ── */}
      <div className={styles.statsGrid}>
        {loading ? (
          [0,1,2,3].map(i => (
            <div key={i} className={styles.statCardSkeleton}>
              <Skeleton h={56} radius={14} />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              label="Total Siswa"
              value={stats.students.toLocaleString()}
              sub={`dari ${stats.total} total akun`}
              accent="#78A3FF"
              href="/dashboard/admin/users"
            />
            <StatCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
              label="Total Guru"
              value={stats.teachers.toLocaleString()}
              sub="tenaga pengajar aktif"
              accent="#6EE7B7"
              href="/dashboard/admin/users"
            />
            <StatCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
              label="Kelas Aktif"
              value={stats.classes.toLocaleString()}
              sub="kode kelas terdaftar"
              accent="#F59E0B"
              href="/dashboard/admin/class-codes"
            />
            <StatCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
              label="Penggunaan Storage"
              value={`${(stats?.storageBytes ? (stats.storageBytes / (1024 * 1024 * 1024)) : 0).toFixed(2)} GB`}
              sub="dari 10 GB kapasitas"
              accent="#A78BFA"
            />
          </>
        )}
      </div>

      {/* ── Storage Bar (decorative) ── */}
      {!loading && stats && (
        <div className={styles.storageCard}>
          <div className={styles.storageHeader}>
            <span className={styles.storageTitle}>Penggunaan Penyimpanan Server</span>
            <span className={styles.storagePercent}>{Math.min(100, (stats.storageBytes / (10 * 1024 * 1024 * 1024) * 100)).toFixed(1)}%</span>
          </div>
          <div className={styles.storageBar}>
            <div className={styles.storageBarFill} style={{ width: `${Math.min(100, (stats.storageBytes / (10 * 1024 * 1024 * 1024) * 100))}%` }} />
          </div>
          <div className={styles.storageFooter}>
            <span>{((stats.storageBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB terpakai</span>
            <span>{(10 - (stats.storageBytes / (1024 * 1024 * 1024))).toFixed(2)} GB tersedia</span>
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className={styles.mainGrid}>

        {/* ── LEFT: Quick Actions + Class Table ── */}
        <div className={styles.leftCol}>

          {/* Quick Actions */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>⚡ Aksi Cepat</h2>
                <p className={styles.cardSubtitle}>Pintasan ke fitur yang paling sering digunakan</p>
              </div>
            </div>
            <div className={styles.quickActions}>
              <QuickAction
                href="/dashboard/admin/users"
                label="Tambah Guru Baru"
                accent="#78A3FF"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/admin/users"
                label="Import Siswa"
                accent="#6EE7B7"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/admin/subjects"
                label="Kelola Mata Pelajaran"
                accent="#F59E0B"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/admin/class-codes"
                label="Kelola Kode Kelas"
                accent="#A78BFA"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/admin/users"
                label="Reset Password"
                accent="#F87171"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
              />
              <QuickAction
                href="/dashboard/admin/logs"
                label="Lihat Log Sistem"
                accent="#94A3B8"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Class Master Data Table */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>📋 Master Data Kelas</h2>
                <p className={styles.cardSubtitle}>Daftar kelas yang terdaftar di sistem</p>
              </div>
              <Link href="/dashboard/admin/class-codes" className={styles.cardAction}>Kelola semua →</Link>
            </div>
            {loading ? (
              <div className={styles.skeletonList}>
                {[0,1,2,3].map(i => <Skeleton key={i} h={48} radius={10} />)}
              </div>
            ) : classes.length === 0 ? (
              <div className={styles.emptyState}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 40, height: 40, opacity: 0.3 }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <p>Belum ada kelas terdaftar.</p>
                <Link href="/dashboard/admin/class-codes" className={styles.emptyLink}>Buat kelas baru →</Link>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Kode Kelas</th>
                      <th>Keterangan / Label</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls, i) => (
                      <tr key={cls._id ?? i}>
                        <td>
                          <span className={styles.classCodeBadge}>{cls.code}</span>
                        </td>
                        <td>
                          <span className={styles.gradeText}>{cls.label ?? '—'}</span>
                        </td>
                        <td>
                          <Link href="/dashboard/admin/class-codes" className={styles.btnMini}>Detail</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: System Logs ── */}
        <div className={styles.rightCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>🕐 Log Aktivitas Terbaru</h2>
                <p className={styles.cardSubtitle}>Aktivitas sistem dalam 24 jam terakhir</p>
              </div>
              <Link href="/dashboard/admin/logs" className={styles.cardAction}>Lihat semua →</Link>
            </div>
            <div className={styles.logList}>
              {loading ? (
                [0, 1, 2, 3].map(i => (
                  <div key={i} className={styles.logItem}>
                    <Skeleton h={40} radius={8} />
                  </div>
                ))
              ) : logs.length === 0 ? (
                <p className={styles.emptyLogs}>Belum ada aktivitas tercatat.</p>
              ) : (
                logs.map(log => {
                  const meta = LOG_COLORS[log.action] ?? LOG_COLORS.auth;
                  const logDate = new Date(log.timestamp);
                  const isToday = logDate.toDateString() === new Date().toDateString();
                  const timeStr = logDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  const dateLabel = isToday ? 'Hari ini' : logDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

                  return (
                    <div key={log._id} className={styles.logItem}>
                      <div className={styles.logDot} style={{ background: meta.bg }}>
                        <span style={{ fontSize: '0.85rem' }}>{meta.dot}</span>
                      </div>
                      <div className={styles.logBody}>
                        <p className={styles.logMsg}>
                          {log.userName && <strong>{log.userName}: </strong>}
                          {log.action === 'auth' ? 'Login berhasil' : `${log.action} ${log.target || ''}`}
                        </p>
                        <span className={styles.logTime}>{dateLabel}, {timeStr} WIB</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className={styles.logFooter}>
              <Link href="/dashboard/admin/logs" className={styles.logMoreLink}>
                Lihat semua log aktivitas →
              </Link>
            </div>
          </div>

          {/* User Distribution Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>👥 Distribusi Pengguna</h2>
                <p className={styles.cardSubtitle}>Komposisi akun di sistem</p>
              </div>
            </div>
            {loading ? (
              <div className={styles.skeletonList}>
                {[0,1,2].map(i => <Skeleton key={i} h={36} radius={8} />)}
              </div>
            ) : (
              <div className={styles.distList}>
                {[
                  { label: 'Siswa',   count: stats?.students ?? 0, color: '#78A3FF', icon: '🎓' },
                  { label: 'Guru',    count: stats?.teachers ?? 0, color: '#6EE7B7', icon: '👨‍🏫' },
                  { label: 'Admin',   count: (stats?.total ?? 0) - (stats?.students ?? 0) - (stats?.teachers ?? 0), color: '#F59E0B', icon: '🛡️' },
                ].map(item => {
                  const total = stats?.total || 1;
                  const pct   = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.label} className={styles.distItem}>
                      <div className={styles.distMeta}>
                        <span className={styles.distIcon}>{item.icon}</span>
                        <span className={styles.distLabel}>{item.label}</span>
                        <span className={styles.distCount}>{item.count}</span>
                      </div>
                      <div className={styles.distBar}>
                        <div className={styles.distBarFill} style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                  );
                })}
                <div className={styles.distTotal}>
                  Total: <strong>{stats?.total ?? 0}</strong> akun terdaftar
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
