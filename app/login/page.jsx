'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import styles from './login.module.css';

// ── Feature data for left panel ─────────────────────────────────────────────
const FEATURES = [
  {
    icon: '📚',
    iconClass: 'blue',
    title: 'Manajemen Materi & Tugas',
    desc: 'Upload, atur, dan distribusikan materi ke kelas dengan mudah.',
  },
  {
    icon: '📝',
    iconClass: 'green',
    title: 'Ujian Online Cerdas',
    desc: 'Buat soal acak, pantau sesi, dan cegah kecurangan otomatis.',
  },
  {
    icon: '🏫',
    iconClass: 'purple',
    title: 'Multi-Kelas & Multi-Peran',
    desc: 'Satu platform untuk Admin, Guru, dan Siswa secara bersamaan.',
  },
  {
    icon: '📊',
    iconClass: 'amber',
    title: 'Pantau Kehadiran Real-time',
    desc: 'Rekap absensi siswa lengkap dengan status dan catatan guru.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router  = useRouter();
  const [identifier,   setIdentifier]   = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login gagal. Periksa kembali kredensial Anda.');
        setLoading(false);
        return;
      }
      router.push(data.redirectTo);
    } catch {
      setError('Tidak dapat terhubung ke server. Coba lagi sebentar.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginWrapper}>

      {/* ══════════════ LEFT PANEL — Branding ══════════════ */}
      <div className={styles.leftPanel}>
        <div className={styles.gridOverlay} />

        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandLogo}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <div className={styles.brandName}>Classroom</div>
            <div className={styles.brandTagline}>Sistem Manajemen Pembelajaran</div>
          </div>
        </div>

        {/* Hero Content */}
        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>
            <span />
            Platform Pendidikan Digital
          </div>

          <h1 className={styles.heroTitle}>
            Kelola Kelas{' '}
            <span className={styles.heroTitleAccent}>Lebih Cerdas</span>,{' '}
            Lebih Efisien
          </h1>

          <p className={styles.heroDesc}>
            Satu tempat untuk mengelola tugas, materi, ujian, dan kehadiran siswa.
            Dirancang untuk guru, siswa, dan administrator sekolah.
          </p>

          {/* Feature list */}
          <div className={styles.featureList}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureItem}>
                <div className={`${styles.featureIcon} ${styles[f.iconClass]}`}>
                  {f.icon}
                </div>
                <div className={styles.featureText}>
                  <span className={styles.featureTitle}>{f.title}</span>
                  <span className={styles.featureDesc}>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className={styles.statRow}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>3</span>
            <span className={styles.statLabel}>Peran Pengguna</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>100%</span>
            <span className={styles.statLabel}>Berbasis Web</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>∞</span>
            <span className={styles.statLabel}>Kelas & Mata Pelajaran</span>
          </div>
        </div>
      </div>

      {/* ══════════════ RIGHT PANEL — Form ══════════════ */}
      <div className={styles.rightPanel}>

        {/* Theme Toggle */}
        <div className={styles.themeTogglePos}>
          <ThemeToggle />
        </div>

        <div className={styles.formCard}>

          {/* Form Header */}
          <div className={styles.formHeader}>
            <p className={styles.formGreeting}>
              👋 Selamat datang kembali!
            </p>
            <h2 className={styles.formTitle}>Masuk ke Akun</h2>
            <p className={styles.formSubtitle}>
              Gunakan username, ID Guru, atau NIS Siswa Anda bersama password untuk masuk.
            </p>
          </div>

          {/* Login Form */}
          <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>

            {/* Identifier */}
            <div className={styles.fieldGroup}>
              <label htmlFor="identifier" className={styles.fieldLabel}>
                Username / ID
              </label>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="identifier"
                  type="text"
                  className={styles.inputField}
                  placeholder="Username, ID Guru, atau NIS"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.fieldLabel}>
                Password
              </label>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.inputField}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: '52px' }}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className={styles.errorBox}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span className={styles.errorText}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? (
                <>
                  <div className={styles.spinner} />
                  Memproses...
                </>
              ) : (
                <>
                  Masuk ke Dashboard
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ width: 16, height: 16 }}>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Form Footer */}
          <div className={styles.formFooter}>
            <a href="/dokumentasi" className={styles.docsLink}>
              📖 Buka Panduan Pengujian
            </a>
            <p className={styles.footerText}>
              © 2026{' '}
              <span className={styles.footerBrand}>Classroom</span>
              {' '}— Sistem Manajemen Kelas
            </p>
          </div>

          {/* Security note */}
          <div className={styles.securityBadge}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Koneksi aman & terenkripsi · RBAC Otentikasi
          </div>
        </div>
      </div>
    </div>
  );
}
