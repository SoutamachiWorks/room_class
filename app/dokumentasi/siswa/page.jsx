import Link from 'next/link';
import styles from '../dokumentasi.module.css';

const studentGuides = [
  {
    title: 'Login dan dashboard',
    steps: [
      'Masuk menggunakan akun siswa yang sudah dibuat admin.',
      'Cek dashboard untuk melihat tugas, ujian tersedia, nilai terbaru, dan informasi kelas.',
      'Gunakan menu navigasi untuk membuka materi, tugas, dan ujian.',
    ],
  },
  {
    title: 'Membaca materi',
    steps: [
      'Buka menu Materi.',
      'Pilih materi berdasarkan mata pelajaran atau kelas yang tersedia.',
      'Baca isi materi dan buka lampiran jika guru menambahkan file pendukung.',
    ],
  },
  {
    title: 'Mengumpulkan tugas',
    steps: [
      'Buka menu Tugas atau pilih tugas dari dashboard.',
      'Baca instruksi dan perhatikan deadline.',
      'Unggah jawaban atau isi jawaban sesuai format yang diminta, lalu kirim tugas.',
    ],
  },
  {
    title: 'Mengikuti ujian',
    steps: [
      'Buka menu Ujian dan pilih ujian yang tersedia.',
      'Baca instruksi sebelum menekan mulai ujian.',
      'Kerjakan soal sampai selesai dan submit jawaban.',
      'Selama ujian, tetap berada pada tab ujian agar tidak tercatat sebagai aktivitas mencurigakan.',
    ],
  },
];

const studentScenario = [
  'Siswa login ke RoomClass.',
  'Siswa membuka dashboard utama untuk melihat tugas dan ujian yang tersedia.',
  'Siswa membuka materi dari guru dan membaca isi materi.',
  'Siswa membuka tugas, mengisi atau mengunggah jawaban, lalu mengirim tugas.',
  'Siswa membuka ujian yang sudah dipublish guru.',
  'Siswa mengerjakan ujian tanpa berpindah tab sebagai skenario normal.',
  'Pada simulasi terpisah, siswa berpindah tab sesuai arahan penguji untuk melihat pencatatan anti-cheat.',
  'Siswa submit ujian setelah semua jawaban selesai.',
];

function GuideCards() {
  return (
    <section className={styles.roleSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.studentTone}`}>Panduan Siswa</span>
        <h2>Cara pemakaian dashboard siswa</h2>
        <p>Siswa menggunakan RoomClass untuk membaca materi, mengumpulkan tugas, dan mengikuti ujian.</p>
      </div>
      <div className={styles.guideGrid}>
        {studentGuides.map((guide) => (
          <article key={guide.title} className={styles.guideCard}>
            <h3>{guide.title}</h3>
            <ol>
              {guide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function StudentScenario() {
  return (
    <section className={styles.flowSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.flowTone}`}>Alur Uji Coba Siswa</span>
        <h2>Urutan pengujian role siswa</h2>
        <p>Alur ini difokuskan pada fitur yang diuji di sekolah: materi, tugas, ujian, dan anti-cheat.</p>
      </div>
      <div className={styles.timeline}>
        {studentScenario.map((item, index) => (
          <div key={item} className={styles.timelineItem}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AntiCheatNotes() {
  return (
    <section className={styles.antiCheatSection}>
      <div>
        <span className={`${styles.eyebrow} ${styles.warningTone}`}>Anti-Cheat</span>
        <h2>Catatan siswa saat mengikuti ujian</h2>
        <p>
          Tab Activity Detection dipakai saat ujian berlangsung. Sistem dapat mencatat aktivitas
          seperti berpindah tab, minimize browser, atau kehilangan fokus dari halaman ujian.
        </p>
      </div>
      <ul>
        <li>Pastikan koneksi stabil sebelum memulai ujian.</li>
        <li>Jangan membuka tab atau aplikasi lain selama ujian berlangsung.</li>
        <li>Jika simulasi anti-cheat diperlukan, lakukan hanya ketika penguji memberikan arahan.</li>
        <li>Submit jawaban setelah selesai dan tunggu instruksi guru untuk melihat hasil.</li>
      </ul>
    </section>
  );
}

export default function StudentDocumentationPage() {
  return (
    <main className={styles.roleDocShell}>
      <header className={styles.roleDocHeader}>
        <Link href="/dokumentasi" className={styles.backLink}>Kembali ke Dokumentasi</Link>
        <span className={`${styles.eyebrow} ${styles.studentTone}`}>Dokumentasi Siswa</span>
        <h1>Alur siswa untuk materi, tugas, dan ujian</h1>
        <p>
          Halaman ini berisi panduan siswa dan alur uji coba. Screenshot siswa bisa ditambahkan
          nanti dengan format besar seperti halaman admin dan guru.
        </p>
      </header>

      <GuideCards />
      <StudentScenario />
      <AntiCheatNotes />
    </main>
  );
}
