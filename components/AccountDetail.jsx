'use client';

import { useState, useEffect } from 'react';
import styles from './AccountDetail.module.css';

const ROLE_LABEL = {
  admin: 'Admin',
  teacher: 'Guru',
  student: 'Siswa',
  principal: 'Kepala Sekolah',
  curriculum: 'Kepala Kurikulum',
  proctor: 'Pengawas Ujian',
};

const ROLE_COLOR = {
  admin: { bg: '#E1E8FF', text: '#4A7AFA' },
  teacher: { bg: '#FDE68A', text: '#B45309' },
  student: { bg: '#D1F0D9', text: '#198754' },
  principal: { bg: '#FCE7F3', text: '#9D174D' },
  curriculum: { bg: '#E0F2FE', text: '#0369A1' },
  proctor: { bg: '#FEF3C7', text: '#92400E' },
};

export default function AccountDetail() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/auth/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setEmail(data.user.email || '');
          setPhone(data.user.phone || '');
        } else {
          setFetchError('Gagal memuat profil.');
        }
      })
      .catch(() => setFetchError('Gagal menghubungi server.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');

    // Validate password fields if user wants to change password
    if (newPassword || currentPassword || confirmPassword) {
      if (!currentPassword) {
        setSaveError('Masukkan password saat ini untuk mengubah password.');
        return;
      }
      if (newPassword.length < 6) {
        setSaveError('Password baru minimal 6 karakter.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveError('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { email, phone };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error || 'Terjadi kesalahan.');
      } else {
        setSaveSuccess('Profil berhasil diperbarui!');
        // Clear password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Update local profile state
        setProfile((prev) => ({ ...prev, email, phone }));
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch {
      setSaveError('Gagal menghubungi server.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span>Memuat profil...</span>
      </div>
    );
  }

  if (fetchError) {
    return <div className={styles.errorBanner}>{fetchError}</div>;
  }

  const roleColor = ROLE_COLOR[profile?.role] || ROLE_COLOR.student;
  const initials = profile?.fullName
    ? profile.fullName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';

  return (
    <div className={styles.pageWrap}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Detail Akun</h1>
          <p className={styles.pageSubtitle}>Kelola informasi profil dan keamanan akun Anda</p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* LEFT — Profile Card */}
        <div className={styles.profileCard}>
          {/* Avatar */}
          <div className={styles.avatarWrap}>
            <div className={styles.avatarCircle}>
              {initials}
            </div>
            <div
              className={styles.rolePill}
              style={{ background: roleColor.bg, color: roleColor.text }}
            >
              {ROLE_LABEL[profile?.role] || profile?.role}
            </div>
          </div>

          {/* Basic Info */}
          <div className={styles.profileName}>{profile?.fullName}</div>
          <div className={styles.profileUsername}>@{profile?.username}</div>

          <div className={styles.divider} />

          {/* Info List */}
          <div className={styles.infoList}>
            <InfoRow
              icon={<EmailIcon />}
              label="Email"
              value={profile?.email || '-'}
            />
            <InfoRow
              icon={<PhoneIcon />}
              label="No. HP"
              value={profile?.phone || '-'}
            />
            {profile?.role === 'teacher' && (
              <InfoRow
                icon={<IdIcon />}
                label="ID Guru"
                value={profile?.teacherId || '-'}
              />
            )}
            {profile?.role === 'student' && (
              <>
                <InfoRow
                  icon={<IdIcon />}
                  label="NIS"
                  value={profile?.studentId || '-'}
                />
                <InfoRow
                  icon={<ClassIcon />}
                  label="Kode Kelas"
                  value={profile?.classCode || '-'}
                />
              </>
            )}
            <InfoRow
              icon={<StatusIcon active={profile?.status === 'active'} />}
              label="Status Akun"
              value={
                <span
                  className={styles.statusBadge}
                  style={{
                    background: profile?.status === 'active' ? 'var(--color-success-bg)' : 'var(--color-process-bg)',
                    color: profile?.status === 'active' ? 'var(--color-success-text)' : 'var(--color-subtext)',
                  }}
                >
                  {profile?.status === 'active' ? 'Aktif' : 'Nonaktif'}
                </span>
              }
            />
          </div>

          {/* Read-only note */}
          <div className={styles.readOnlyNote}>
            <LockIcon />
            Nama, username, dan ID tidak dapat diubah. Hubungi Admin jika ada perubahan data ini.
          </div>
        </div>

        {/* RIGHT — Edit Form */}
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <h2 className={styles.formCardTitle}>Ubah Informasi</h2>
            <p className={styles.formCardSubtitle}>
              Hanya email, nomor HP, dan password yang dapat diubah secara mandiri.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSave}>
            {/* Section: Informasi Kontak */}
            <div className={styles.formSection}>
              <div className={styles.sectionLabel}>Informasi Kontak</div>
              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Email*</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>No. HP</label>
                  <input
                    type="tel"
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>
            </div>

            {/* Section: Ganti Password */}
            <div className={styles.formSection}>
              <div className={styles.sectionLabel}>Ganti Password</div>
              <p className={styles.sectionNote}>Kosongkan jika tidak ingin mengganti password.</p>
              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Password Saat Ini</label>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      className={styles.input}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowCurrentPwd((v) => !v)}
                      aria-label="Toggle visibility"
                    >
                      {showCurrentPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Password Baru</label>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      className={styles.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      autoComplete="new-password"
                      minLength={newPassword ? 6 : undefined}
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowNewPwd((v) => !v)}
                      aria-label="Toggle visibility"
                    >
                      {showNewPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Konfirmasi Password Baru</label>
                  <div className={styles.passwordWrap}>
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      className={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowConfirmPwd((v) => !v)}
                      aria-label="Toggle visibility"
                    >
                      {showConfirmPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {/* Password match indicator */}
                  {confirmPassword && newPassword && (
                    <span
                      className={styles.matchHint}
                      style={{
                        color: newPassword === confirmPassword
                          ? 'var(--color-success-text)'
                          : 'var(--color-failed-text)',
                      }}
                    >
                      {newPassword === confirmPassword ? '✓ Password cocok' : '✗ Password tidak cocok'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Feedback Messages */}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            {saveSuccess && <div className={styles.successBanner}>{saveSuccess}</div>}

            {/* Submit */}
            <div className={styles.formFooter}>
              <button type="submit" className={styles.btnSave} disabled={saving}>
                {saving ? (
                  <>
                    <span className={styles.btnSpinner} />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <SaveIcon />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <div className={styles.infoContent}>
        <span className={styles.infoLabel}>{label}</span>
        <span className={styles.infoValue}>{value}</span>
      </div>
    </div>
  );
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.11h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IdIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function ClassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function StatusIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
