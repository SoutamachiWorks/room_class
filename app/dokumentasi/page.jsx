'use client';
import Link from 'next/link';

export default function TestingDocumentPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ background: '#1E293B', color: 'white', padding: '32px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '2rem', fontWeight: 800 }}> Panduan Pengujian (Testing Guide)</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '1rem' }}>RoomClass - Sistem Manajemen Pembelajaran (Skripsi)</p>
        </div>

        <div style={{ padding: '32px' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px', marginBottom: '16px' }}>🔑 1. Akses Kredensial Default</h2>
            <p style={{ fontSize: '0.9375rem', color: '#475569', marginBottom: '16px' }}>Gunakan kombinasi otentikasi berikut untuk menguji masing-masing *Role* dalam sistem.</p>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', borderLeft: '4px solid #DC2626', padding: '16px', borderRadius: '4px 8px 8px 4px' }}>
                <div style={{ fontWeight: 700, color: '#DC2626', marginBottom: '8px' }}>Panel Administrator</div>
                <div style={{ fontSize: '0.875rem' }}>Username: <strong>admin</strong></div>
                <div style={{ fontSize: '0.875rem' }}>Password: <strong>admin123</strong></div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>*Gunakan akun ini untuk menambahkan Data Guru, Master Kelas, Modul Ujian Pokok, dsb.</div>
              </div>

              <div style={{ background: '#F8FAFC', borderLeft: '4px solid #2563EB', padding: '16px', borderRadius: '4px 8px 8px 4px' }}>
                <div style={{ fontWeight: 700, color: '#2563EB', marginBottom: '8px' }}>Sisi Guru (Teacher)</div>
                <div style={{ fontSize: '0.875rem', marginBottom: '4px' }}>*Akun guru dibuat melalui <strong>Panel Admin</strong>. Default yang disarankan:</div>
                <div style={{ fontSize: '0.875rem' }}>Username: <strong>[Sesuai yang Anda buat di Admin]</strong></div>
                <div style={{ fontSize: '0.875rem' }}>Password: <strong>[Sesuai yang Anda buat di Admin]</strong></div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px' }}>*Guru dapat memberikan Materi, Tugas, dan menilai Siswa.</div>
              </div>

              <div style={{ background: '#F8FAFC', borderLeft: '4px solid #10B981', padding: '16px', borderRadius: '4px 8px 8px 4px' }}>
                <div style={{ fontWeight: 700, color: '#10B981', marginBottom: '8px' }}>Sisi Siswa (Student)</div>
                <div style={{ fontSize: '0.875rem', marginBottom: '4px' }}>*Siswa didaftarkan melalui kode Register atau via Master Kelas:</div>
                <div style={{ fontSize: '0.875rem' }}>Username: <strong>contoh_siswa</strong> / (Sesuai Data Anda misal <i>Rusdi</i>)</div>
                <div style={{ fontSize: '0.875rem' }}>Password: <strong>(Sesuai Data Register Anda)</strong></div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px', marginBottom: '16px' }}>🔄 2. Skenario Pengujian Utama (Flow)</h2>
            <ul style={{ paddingLeft: '20px', color: '#334155', fontSize: '0.9375rem', lineHeight: 1.7 }}>
              <li style={{ marginBottom: '8px' }}><strong>Alur Materi:</strong> Guru me-login &rarr; Navigasi ke Materi &rarr; Tambah Materi (Pilih Mapel) &rarr; Siswa me-login &rarr; Buka Materi &rarr; Cek tampilan <i>Split-Pane</i> Elegan.</li>
              <li style={{ marginBottom: '8px' }}><strong>Alur Penugasan:</strong> Guru me-login &rarr; Buat Tugas &amp; Set Deadline &rarr; Siswa Me-login &rarr; Mengumpulkan Tugas &rarr; Guru memantau tombol <i>&quot;Koreksi Jawaban/Submissions&quot;</i> dan mengisi Poin 1-100.</li>
              <li><strong>Sistem Ujian Khusus Lulus/Gagal:</strong> Terkunci jika Browser Tab/Window minimize (Focus Out). Log terekam di sistem server. Siswa otomatis dikunci keluar ujian.</li>
            </ul>
          </div>

          <div>
             <h2 style={{ fontSize: '1.25rem', color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: '8px', marginBottom: '16px' }}>🚀 3. Navigasi Cepat</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link href="/api-tester" style={{ textDecoration: 'none', background: '#3B82F6', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>Coba Mock API Tester</Link>
                <Link href="/login" style={{ textDecoration: 'none', background: '#0F172A', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>Ke Halaman Login</Link>
                <Link href="/" style={{ textDecoration: 'none', background: '#F1F5F9', color: '#0F172A', padding: '10px 20px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, border: '1px solid #E2E8F0' }}>Ke Beranda</Link>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
