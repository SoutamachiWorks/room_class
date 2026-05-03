'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import BottomNav from '@/components/BottomNav';
import NotificationBell from '@/components/NotificationBell';
import InstallPwaPrompt from '@/components/InstallPwaPrompt';
import styles from './dashboard.module.css';

// Navigation config per role
const navConfig = {
  admin: {
    label: 'Admin',
    sections: [
      {
        title: 'Menu Utama',
        links: [
          {
            label: 'Dashboard',
            href: '/dashboard/admin',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ),
          },
          {
            label: 'Semua Pengguna',
            href: '/dashboard/admin/users',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
          },
          {
            label: 'Kode Kelas',
            href: '/dashboard/admin/class-codes',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            ),
          },
          {
            label: 'Mata Pelajaran',
            href: '/dashboard/admin/subjects',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            ),
          },
          {
            label: 'Jadwal Pelajaran',
            href: '/dashboard/admin/schedules',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ),
          },
          {
            label: 'Kenaikan Kelas',
            href: '/dashboard/admin/promotion',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="19 8 22 11 19 14" />
                <line x1="15" y1="11" x2="22" y2="11" />
              </svg>
            ),
          },
        ],
      },
      {
        title: 'Sistem',
        links: [
          {
            label: 'Log Aktivitas',
            href: '/dashboard/admin/logs',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            ),
          },
        ],
      },
    ],
  },
  teacher: {
    label: 'Guru',
    sections: [
      {
        title: 'Menu Utama',
        links: [
          {
            label: 'Dashboard',
            href: '/dashboard/teacher',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ),
          },
          {
            label: 'Daftar Siswa',
            href: '/dashboard/teacher/students',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            ),
          },
          {
            label: 'Materi Pelajaran',
            href: '/dashboard/teacher/materials',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            ),
          },
          {
            label: 'Penugasan',
            href: '/dashboard/teacher/assignments',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            ),
          },
          {
            label: 'Ujian',
            href: '/dashboard/teacher/exams',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            ),
          },
          {
            label: 'Absensi',
            href: '/dashboard/teacher/attendance',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
            ),
          },
          {
            label: 'Jadwal Mengajar',
            href: '/dashboard/teacher/schedule',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ),
          },
        ],
      },
    ],
  },
  student: {
    label: 'Siswa',
    sections: [
      {
        title: 'Menu Utama',
        links: [
          {
            label: 'Dashboard',
            href: '/dashboard/student',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ),
          },
          {
            label: 'Tugas',
            href: '/dashboard/student/assignments',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            ),
          },
          {
            label: 'Materi',
            href: '/dashboard/student/materials',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            ),
          },
          {
            label: 'Ujian',
            href: '/dashboard/student/exams',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            ),
          },
          {
            label: 'Absensi',
            href: '/dashboard/student/attendance',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M9 16l2 2 4-4" />
              </svg>
            ),
          },
          {
            label: 'Jadwal Pelajaran',
            href: '/dashboard/student/schedule',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ),
          },
        ],
      },
    ],
  },
};

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-close mobile menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch((err) => {
        console.error('FATAL LOGOUT TRIGGER:', err);
        router.push('/login');
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper} suppressHydrationWarning>
        <div className={styles.spinner} />
      </div>
    );
  }

  const nav = navConfig[user?.role] || navConfig.student;
  const userRole = user?.role || 'student';

  // Determine if a nav link is active
  const isActive = (href) => {
    if (href === `/dashboard/${user?.role}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const isTaking = pathname?.includes('/dashboard/student/exams/') && pathname?.endsWith('/take');

  if (isTaking) {
    return (
      <div className={styles.dashboardRoot} suppressHydrationWarning>
        <main className={styles.content} style={{ padding: '0', overflow: 'auto' }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.dashboardRoot} suppressHydrationWarning>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''} ${isMobileMenuOpen ? styles.sidebarMobileOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.logoGroup}>
            <div className={styles.logoBox}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <span className={`${styles.logoText} ${isCollapsed ? styles.logoTextHidden : ''}`}>RoomClass</span>
          </div>
          {/* Desktop collapse button — hidden on mobile */}
          <button
            className={`${styles.collapseBtn} ${isCollapsed ? styles.collapseBtnRotated : ''}`}
            onClick={() => setIsCollapsed(c => !c)}
            title={isCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {/* Mobile close button */}
          <button
            className={styles.mobileCloseBtn}
            onClick={() => setIsMobileMenuOpen(false)}
            title="Tutup menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className={styles.navSection}>
          {nav.sections.map((section, idx) => (
            <div key={idx}>
              <div className={`${styles.navLabel} ${isCollapsed ? styles.navLabelHidden : ''}`}>{section.title}</div>
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.navLink} ${isActive(link.href) ? styles.navLinkActive : ''}`}
                  data-tooltip={isCollapsed ? link.label : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className={styles.navIcon}>{link.icon}</span>
                  <span className={`${styles.navLinkText} ${isCollapsed ? styles.navLinkTextHidden : ''}`}>
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className={styles.mainArea}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          {/* Hamburger — hidden on mobile (replaced by bottom nav) */}
          <button
            className={`${styles.hamburgerBtn} ${styles.hideOnMobile}`}
            onClick={() => setIsMobileMenuOpen(true)}
            title="Buka menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className={styles.greeting}>
            <span className={styles.greetingText}>Selamat datang kembali,</span>
            <span className={styles.greetingName}>{user?.fullName}</span>
          </div>
          <div className={styles.topBarRight}>
            <NotificationBell />
            <ThemeToggle />
            <span className={styles.roleBadge}>{nav.label}</span>
            <div className={styles.accountMenu} ref={dropdownRef}>
              <button
                type="button"
                className={styles.topBarAvatar}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="Menu Akun"
              >
                {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
              </button>

              {isDropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <Link
                    href={`/dashboard/${user?.role}/account`}
                    className={styles.dropdownItem}
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Akun Saya
                  </Link>
                  <button className={`${styles.dropdownItem} ${styles.dropdownLogout}`} onClick={handleLogout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.dropdownIcon}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={`${styles.content} ${styles.contentWithBottomNav}`}>
          {children}
        </main>
      </div>

      {/* PWA Install Prompt */}
      {userRole === 'student' && <InstallPwaPrompt />}

      {/* Bottom Navigation — All roles, mobile only */}
      <BottomNav role={userRole} />
    </div>
  );
}
