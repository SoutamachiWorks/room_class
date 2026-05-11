import Link from 'next/link';
import styles from './dokumentasi.module.css';

export default function DocumentationPage() {
  return (
    <main className={styles.pageShell}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroTopBar}>
            <Link href="/" className={styles.homeBadgeLink}>Ke Halaman Awal</Link>
            <span className={styles.heroBadge}>Panduan Pemakaian RoomClass</span>
          </div>
          <h1>Dokumentasi dashboard untuk admin, guru, dan siswa</h1>
          <p>
            Halaman ini menjadi pintu masuk dokumentasi RoomClass. Panduan detail, alur uji coba,
            dan catatan anti-cheat dipisahkan ke halaman masing-masing role agar screenshot tampil
            lebih besar dan mudah dibaca.
          </p>
          <div className={styles.heroActions}>
            <Link href="/dokumentasi/admin" className={styles.secondaryAction}>Panduan Admin</Link>
            <Link href="/dokumentasi/guru" className={styles.secondaryAction}>Panduan Guru</Link>
            <Link href="/dokumentasi/siswa" className={styles.secondaryAction}>Panduan Siswa</Link>
          </div>
        </div>
        <div className={styles.heroPanel} aria-label="Ringkasan dokumentasi RoomClass">
          <div>
            <span>01</span>
            <strong>Admin</strong>
            <p>Menyiapkan akun, kelas, tahun ajaran, dan mata pelajaran sebelum uji coba.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Guru</strong>
            <p>Mengelola materi, tugas, ujian, publikasi ujian, dan monitoring.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Siswa</strong>
            <p>Membaca materi, mengumpulkan tugas, dan mengikuti ujian dengan aturan anti-cheat.</p>
          </div>
        </div>
      </section>

      <section className={styles.rolePortalGrid} aria-label="Pilih dokumentasi berdasarkan role">
        <Link href="/dokumentasi/admin" className={styles.rolePortalCard}>
          <span className={`${styles.eyebrow} ${styles.adminTone}`}>Dokumentasi Admin</span>
          <h2>Admin</h2>
          <p>Lihat alur dari login, dashboard utama, kode kelas, tahun ajaran, user, sampai mata pelajaran.</p>
        </Link>
        <Link href="/dokumentasi/guru" className={styles.rolePortalCard}>
          <span className={`${styles.eyebrow} ${styles.teacherTone}`}>Dokumentasi Guru</span>
          <h2>Guru</h2>
          <p>Lihat alur materi, penugasan, pembuatan ujian, publish ujian, dan monitoring ujian.</p>
        </Link>
        <Link href="/dokumentasi/siswa" className={styles.rolePortalCard}>
          <span className={`${styles.eyebrow} ${styles.studentTone}`}>Dokumentasi Siswa</span>
          <h2>Siswa</h2>
          <p>Lihat alur memakai materi, mengumpulkan tugas, mengikuti ujian, dan catatan anti-cheat.</p>
        </Link>
      </section>

      <section className={styles.noticeGrid}>
        <article className={styles.noticeCard}>
          <span className={styles.noticeLabel}>Fokus uji coba</span>
          <h2>Role utama: admin, guru, dan siswa.</h2>
          <p>
            Role kepala sekolah dan kepala kurikulum belum dimasukkan ke dokumentasi ini karena
            pengujian sekolah saat ini difokuskan pada penggunaan fitur inti.
          </p>
        </article>
        <article className={styles.noticeCard}>
          <span className={styles.noticeLabel}>Judul penelitian</span>
          <h2>RoomClass dengan fitur anti-cheat.</h2>
          <p>
            Detail Tab Activity Detection tidak ditaruh di halaman utama, tetapi dijelaskan pada
            halaman guru dan siswa karena fitur tersebut muncul saat alur ujian diuji.
          </p>
        </article>
      </section>
    </main>
  );
}
